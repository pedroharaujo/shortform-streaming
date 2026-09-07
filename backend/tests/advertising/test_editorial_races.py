from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event
from time import monotonic, sleep
from typing import Any
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, connections, transaction
from django.test import Client, RequestFactory
from django.urls import reverse
from django.utils import timezone

from apps.catalog.admin import ContentRightAdmin, SeriesAdmin
from apps.catalog.locking import lock_series_for_access
from apps.catalog.models import ContentRight, ContentSegment, Series
from apps.entitlements.models import EpisodeEntitlement
from tests.advertising.test_callbacks import CALLBACK, signed_query
from tests.advertising.test_rewards_api import create_intent, headers
from tests.catalog.builders import make_right


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("operation", ["rename", "delete", "bulk_delete"])
def test_segment_admin_cannot_revoke_audience_during_verified_grant(
    reward_setup: Any,
    ephemeral_signer: ec.EllipticCurvePrivateKey,
    settings: Any,
    operation: str,
) -> None:
    profile, episode = reward_setup
    segment = ContentSegment.objects.create(name="Synthetic audience", slug="synthetic-audience")
    episode.series.content_segments.add(segment)
    settings.CATALOG_LAUNCH_CONTEXT = {
        **settings.CATALOG_LAUNCH_CONTEXT,
        "audience_segment": segment.slug,
    }
    operator = get_user_model().objects.create_superuser(username="synthetic-segment-editor")
    operator_client = Client()
    operator_client.force_login(operator)
    response = create_intent(Client(), episode)
    assert response.status_code == 201
    query = signed_query(ephemeral_signer, response.json())
    holding = Event()
    release = Event()
    pids: dict[str, int] = {}

    def callback() -> int:
        close_old_connections()
        database = connections["default"]
        try:
            pids["callback"] = backend_pid()
            original_commit = database.commit

            def paused_commit() -> None:
                # Real verified grant has checked eligibility and written its evidence,
                # but neither grant nor parent lock has committed yet.
                holding.set()
                assert release.wait(timeout=10)
                original_commit()

            with patch.object(database, "commit", side_effect=paused_commit):
                return Client().get(f"{CALLBACK}?{query}").status_code
        finally:
            database.close()

    def operator_change() -> int:
        close_old_connections()
        try:
            pids["operator"] = backend_pid()
            if operation == "rename":
                return operator_client.post(
                    reverse("admin:catalog_contentsegment_change", args=[segment.pk]),
                    {"name": segment.name, "slug": "synthetic-renamed", "_save": "Save"},
                ).status_code
            if operation == "delete":
                return operator_client.post(
                    reverse("admin:catalog_contentsegment_delete", args=[segment.pk]),
                    {"post": "yes"},
                ).status_code
            return operator_client.post(
                reverse("admin:catalog_contentsegment_changelist"),
                {"action": "delete_selected", "_selected_action": [segment.pk], "post": "yes"},
            ).status_code
        finally:
            connections["default"].close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        granting = pool.submit(callback)
        try:
            assert holding.wait(timeout=10)
            # The complete Admin request must finish while the grant remains paused.
            status = pool.submit(operator_change).result(timeout=10)
            assert pids["callback"] != pids["operator"]
            assert status == {"rename": 302, "delete": 403, "bulk_delete": 200}[operation]
            assert ContentSegment.objects.filter(pk=segment.pk, slug=segment.slug).exists()
            assert episode.series.content_segments.filter(pk=segment.pk).exists()
            assert not EpisodeEntitlement.objects.filter(episode=episode).exists()
        finally:
            release.set()
        assert granting.result(timeout=10) == 200
    assert EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode).count() == 1
    assert Client().get(f"/v1/rewards/{response.json()['id']}", **headers()).json()["status"] == (
        "granted"
    )


def backend_pid() -> int:
    with connections["default"].cursor() as cursor:
        cursor.execute("SELECT pg_backend_pid()")
        return int(cursor.fetchone()[0])


def wait_for_database_block(waiter: int, holder: int) -> None:
    deadline = monotonic() + 10
    while monotonic() < deadline:
        with connection.cursor() as cursor:
            cursor.execute("SELECT %s = ANY(pg_blocking_pids(%s))", [holder, waiter])
            if cursor.fetchone()[0]:
                return
        sleep(0.01)
    pytest.fail("The second transaction did not wait for the catalog parent lock.")


def revoke_through_admin(series_id: int, right_id: int | None, operator: Any) -> None:
    request = RequestFactory().post("/admin/catalog/synthetic-change/")
    request.user = operator
    if right_id is not None:
        right = ContentRight.objects.get(pk=right_id)
        right.rewarded_ad_permission = False
        ContentRightAdmin(ContentRight, admin.site).save_model(request, right, None, True)
    else:
        series = Series.objects.get(pk=series_id)
        series.rewarded_ads_enabled = False
        SeriesAdmin(Series, admin.site).save_model(request, series, None, True)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("revocation", ["policy", "rights"])
@pytest.mark.parametrize("first", ["operator", "callback"])
def test_admin_revocation_and_verified_grant_share_a_transaction_boundary(
    reward_setup: Any,
    ephemeral_signer: ec.EllipticCurvePrivateKey,
    revocation: str,
    first: str,
) -> None:
    _, episode = reward_setup
    operator = get_user_model().objects.create_user(username="synthetic-access-editor")
    right_id = None
    if revocation == "rights":
        right_id = make_right(episode.series).pk
        episode.series.self_owned = False
        episode.series.save(update_fields=["self_owned"])
    data = create_intent(Client(), episode).json()
    query = signed_query(ephemeral_signer, data)
    holding = Event()
    second_started = Event()
    release = Event()
    pids: dict[str, int] = {}

    def operator_change() -> None:
        close_old_connections()
        try:
            pids["operator"] = backend_pid()
            if first == "callback":
                second_started.set()
            with transaction.atomic():
                revoke_through_admin(episode.series_id, right_id, operator)
                if first == "operator":
                    holding.set()
                    assert release.wait(timeout=10)
        finally:
            connections["default"].close()

    def callback() -> int:
        close_old_connections()
        database = connections["default"]
        try:
            pids["callback"] = backend_pid()
            if first == "operator":
                second_started.set()
                return Client().get(f"{CALLBACK}?{query}").status_code
            original_commit = database.commit

            def paused_commit() -> None:
                holding.set()
                assert release.wait(timeout=10)
                original_commit()

            with patch.object(database, "commit", side_effect=paused_commit):
                return Client().get(f"{CALLBACK}?{query}").status_code
        finally:
            database.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        leading = pool.submit(operator_change if first == "operator" else callback)
        try:
            assert holding.wait(timeout=10)
            trailing = pool.submit(callback if first == "operator" else operator_change)
            assert second_started.wait(timeout=10)
            other = "callback" if first == "operator" else "operator"
            wait_for_database_block(pids[other], pids[first])
        finally:
            release.set()
        leading_result = leading.result(timeout=10)
        trailing_result = trailing.result(timeout=10)

    status = trailing_result if first == "operator" else leading_result
    assert status == (400 if first == "operator" else 200)
    assert EpisodeEntitlement.objects.count() == (0 if first == "operator" else 1)
    if first == "callback":
        assert Client().get(f"{CALLBACK}?{query}").status_code == 200
    if revocation == "rights":
        response = Client().post(f"/v1/playback/{episode.public_id}/authorize", **headers())
        assert response.status_code == 404


@pytest.mark.django_db(transaction=True)
def test_episode_window_expiry_is_rechecked_after_callback_lock_wait(
    reward_setup: Any,
    ephemeral_signer: ec.EllipticCurvePrivateKey,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, episode = reward_setup
    clock = [timezone.now()]
    episode.window_ends_at = clock[0] + timedelta(seconds=1)
    episode.save(update_fields=["window_ends_at"])
    data = create_intent(Client(), episode).json()
    query = signed_query(ephemeral_signer, data)
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock[0])
    holding = Event()
    callback_started = Event()
    release = Event()
    pids: dict[str, int] = {}

    def hold_catalog_parent() -> None:
        close_old_connections()
        try:
            pids["operator"] = backend_pid()
            with transaction.atomic():
                lock_series_for_access(episode.series_id)
                holding.set()
                assert release.wait(timeout=10)
        finally:
            connections["default"].close()

    def callback() -> int:
        close_old_connections()
        try:
            pids["callback"] = backend_pid()
            callback_started.set()
            return Client().get(f"{CALLBACK}?{query}").status_code
        finally:
            connections["default"].close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        holder = pool.submit(hold_catalog_parent)
        try:
            assert holding.wait(timeout=10)
            granting = pool.submit(callback)
            assert callback_started.wait(timeout=10)
            wait_for_database_block(pids["callback"], pids["operator"])
            clock[0] = episode.window_ends_at
        finally:
            release.set()
        holder.result(timeout=10)
        assert granting.result(timeout=10) == 400
    assert not EpisodeEntitlement.objects.exists()

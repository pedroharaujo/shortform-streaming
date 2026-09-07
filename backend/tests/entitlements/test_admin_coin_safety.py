from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic, sleep
from typing import Any

import pytest
from django.db import close_old_connections, connection, connections, transaction
from django.test import Client
from django.urls import reverse

from apps.accounts.models import UserProfile
from apps.accounts.profiles import lock_account_identity
from apps.catalog.locking import lock_episode_for_access
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from tests.catalog.builders import make_published_title


def grant_fixture(source: str = EntitlementSource.STAFF) -> EpisodeEntitlement:
    profile = UserProfile.objects.create(firebase_uid="synthetic-admin-coin-account")
    _, episode = make_published_title(title="Synthetic Admin Coin Safety")
    return EpisodeEntitlement.objects.create(user_profile=profile, episode=episode, source=source)


@pytest.mark.django_db
@pytest.mark.parametrize("existing", [False, True])
def test_admin_rejects_manufactured_coin_source(admin_client: Client, existing: bool) -> None:
    entitlement = grant_fixture()
    data = {
        "user_profile": entitlement.user_profile_id,
        "episode": entitlement.episode_id,
        "source": EntitlementSource.COIN,
        "_save": "Save",
    }
    if existing:
        url = reverse("admin:entitlements_episodeentitlement_change", args=[entitlement.pk])
    else:
        entitlement.delete()
        url = reverse("admin:entitlements_episodeentitlement_add")

    response = admin_client.post(url, data)

    assert response.status_code == 200
    assert "source" in response.context["adminform"].form.errors
    assert not EpisodeEntitlement.objects.filter(source=EntitlementSource.COIN).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("operation", ["change", "delete", "bulk_delete"])
def test_coin_grants_cannot_be_changed_or_deleted(admin_client: Client, operation: str) -> None:
    entitlement = grant_fixture(EntitlementSource.COIN)
    if operation == "change":
        response = admin_client.post(
            reverse("admin:entitlements_episodeentitlement_change", args=[entitlement.pk]),
            {
                "user_profile": entitlement.user_profile_id,
                "episode": entitlement.episode_id,
                "source": EntitlementSource.STAFF,
                "_save": "Save",
            },
        )
    elif operation == "delete":
        response = admin_client.post(
            reverse("admin:entitlements_episodeentitlement_delete", args=[entitlement.pk]),
            {"post": "yes"},
        )
    else:
        # A mixed selection must not partly delete staff evidence before failing.
        other_profile = UserProfile.objects.create(firebase_uid="synthetic-admin-other-account")
        other = EpisodeEntitlement.objects.create(
            user_profile=other_profile, episode=entitlement.episode, source=EntitlementSource.STAFF
        )
        response = admin_client.post(
            reverse("admin:entitlements_episodeentitlement_changelist"),
            {
                "action": "delete_selected",
                "_selected_action": [entitlement.pk, other.pk],
                "post": "yes",
            },
        )
        assert EpisodeEntitlement.objects.filter(pk=other.pk).exists()

    assert response.status_code == 403
    entitlement.refresh_from_db()
    assert entitlement.source == EntitlementSource.COIN


@pytest.mark.django_db
def test_existing_grant_account_and_episode_cannot_be_reassigned(admin_client: Client) -> None:
    entitlement = grant_fixture()
    other_profile = UserProfile.objects.create(firebase_uid="synthetic-admin-other-account")
    _, other_episode = make_published_title(title="Synthetic Other Episode")

    response = admin_client.post(
        reverse("admin:entitlements_episodeentitlement_change", args=[entitlement.pk]),
        {
            "user_profile": other_profile.pk,
            "episode": other_episode.pk,
            "source": EntitlementSource.STAFF,
            "_save": "Save",
        },
    )

    assert response.status_code == 302
    entitlement.refresh_from_db()
    assert entitlement.user_profile_id != other_profile.pk
    assert entitlement.episode_id != other_episode.pk


def database_pid() -> int:
    with connections["default"].cursor() as cursor:
        cursor.execute("SELECT pg_backend_pid()")
        return int(cursor.fetchone()[0])


def wait_for_block(waiter: int, holder: int) -> None:
    deadline = monotonic() + 10
    while monotonic() < deadline:
        with connection.cursor() as cursor:
            cursor.execute("SELECT %s = ANY(pg_blocking_pids(%s))", [holder, waiter])
            if cursor.fetchone()[0]:
                return
        sleep(0.01)
    pytest.fail("The Admin writer did not wait for the access transaction.")


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("boundary", ["account", "catalog"])
def test_admin_add_serializes_with_existing_access_writers(admin_user: Any, boundary: str) -> None:
    entitlement = grant_fixture()
    profile, episode = entitlement.user_profile, entitlement.episode
    entitlement.delete()
    holding, started, release = Event(), Event(), Event()
    pids: dict[str, int] = {}

    def access_writer() -> None:
        close_old_connections()
        try:
            pids["coin"] = database_pid()
            with transaction.atomic():
                if boundary == "account":
                    lock_account_identity(profile.firebase_uid)
                lock_episode_for_access(episode.pk)
                if boundary == "account":
                    EpisodeEntitlement.objects.create(
                        user_profile=profile, episode=episode, source=EntitlementSource.COIN
                    )
                holding.set()
                assert release.wait(timeout=10)
        finally:
            connections["default"].close()

    def staff_grant() -> int:
        close_old_connections()
        try:
            operator = Client()
            operator.force_login(admin_user)
            pids["admin"] = database_pid()
            started.set()
            return operator.post(
                reverse("admin:entitlements_episodeentitlement_add"),
                {
                    "user_profile": profile.pk,
                    "episode": episode.pk,
                    "source": EntitlementSource.STAFF,
                    "_save": "Save",
                },
            ).status_code
        finally:
            connections["default"].close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        leading = pool.submit(access_writer)
        try:
            assert holding.wait(timeout=10)
            trailing = pool.submit(staff_grant)
            assert started.wait(timeout=10)
            wait_for_block(pids["admin"], pids["coin"])
        finally:
            release.set()
        leading.result(timeout=10)
        assert trailing.result(timeout=10) == (200 if boundary == "account" else 302)

    saved = EpisodeEntitlement.objects.get(user_profile=profile, episode=episode)
    assert saved.source == (
        EntitlementSource.COIN if boundary == "account" else EntitlementSource.STAFF
    )

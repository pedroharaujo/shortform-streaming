from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from io import StringIO
from typing import Any
from unittest.mock import patch

import pytest
from django.core.management import CommandError, call_command
from django.db import close_old_connections
from django.test import Client, override_settings
from django.utils import timezone

from apps.accounts.lifecycle import delete_firebase_user
from apps.accounts.models import AccountDeletion, UserProfile
from apps.accounts.verification import VerifiedToken
from apps.entitlements.models import EpisodeEntitlement
from apps.progress.models import WatchProgress
from tests.catalog.builders import make_published_title

HEADERS: dict[str, Any] = {"HTTP_AUTHORIZATION": "Bearer mock.lifecycle-user"}
DELETE = "/v1/me/deletion"


def delete(client: Client):  # type: ignore[no-untyped-def]
    return client.post(DELETE, {"confirmation": True}, content_type="application/json", **HEADERS)


@pytest.mark.django_db
def test_preferences_are_opt_in_and_only_owned_fields_are_writable(client: Client) -> None:
    original = client.get("/v1/me", **HEADERS).json()
    assert original["locale"] == "en"
    assert original["country"] == ""
    assert original["analytics_consent"] is False
    assert original["ads_consent"] is False
    assert original["consent_updated_at"] is None
    response = client.patch(
        "/v1/me",
        {"country": "fr", "analytics_consent": True},
        content_type="application/json",
        **HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["country"] == "FR"
    assert response.json()["analytics_consent"] is True
    assert response.json()["ads_consent"] is False
    assert response.json()["consent_updated_at"] is not None
    for body in ({"firebase_uid": "other"}, {"locale": "fr"}, {"country": "France"}):
        response = client.patch("/v1/me", body, content_type="application/json", **HEADERS)
        assert response.status_code == 400
    assert client.patch("/v1/me", {}, content_type="application/json").status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize("age", [None, 301, -60])
def test_deletion_requires_recent_verified_authentication(client: Client, age: int | None) -> None:
    auth_time = None if age is None else int(timezone.now().timestamp()) - age
    with patch("apps.accounts.authentication.get_token_verifier") as factory:
        factory.return_value.verify_id_token.return_value = VerifiedToken(
            uid="lifecycle-user",
            auth_time=auth_time,
        )
        response = delete(client)
    assert response.status_code == 403
    assert response.json()["code"] == "reauthentication_required"
    assert AccountDeletion.objects.count() == 0


@pytest.mark.django_db
def test_deletion_removes_owned_data_and_stale_token_cannot_recreate_it(client: Client) -> None:
    client.get("/v1/me", **HEADERS)
    profile = UserProfile.objects.get(firebase_uid="lifecycle-user")
    other = UserProfile.objects.create(firebase_uid="another-user")
    _, episode = make_published_title(title="Synthetic deletion fixture", territory="FR")
    for owner in (profile, other):
        WatchProgress.objects.create(user_profile=owner, episode=episode, position_seconds=12)
        EpisodeEntitlement.objects.create(user_profile=owner, episode=episode)
    with patch("apps.accounts.lifecycle.delete_firebase_user") as provider:
        response = delete(client)
        assert response.status_code == 202
        assert response.json()["status"] == "completed"
        provider.assert_called_once_with("lifecycle-user")
        # Token-only deletion auth can safely return the existing receipt in mock mode.
        assert delete(client).json() == response.json()
        assert provider.call_count == 1
    assert not UserProfile.objects.filter(pk=profile.pk).exists()
    assert WatchProgress.objects.count() == EpisodeEntitlement.objects.count() == 1
    assert WatchProgress.objects.get().user_profile_id == other.pk
    record = AccountDeletion.objects.get()
    assert record.firebase_uid == ""
    assert record.completed_at is not None
    assert client.get("/v1/me", **HEADERS).status_code == 401
    assert (
        client.patch(
            "/v1/me", {"ads_consent": True}, content_type="application/json", **HEADERS
        ).status_code
        == 401
    )
    assert UserProfile.objects.count() == 1
    assert "lifecycle-user" not in response.content.decode()


@pytest.mark.django_db
def test_provider_failure_stays_pending_and_operator_retry_completes(client: Client) -> None:
    client.get("/v1/me", **HEADERS)
    with patch("apps.accounts.lifecycle.delete_firebase_user", side_effect=RuntimeError("private")):
        response = delete(client)
    assert response.status_code == 202
    assert response.json()["status"] == "pending"
    assert not UserProfile.objects.exists()
    assert client.get("/v1/me", **HEADERS).status_code == 401
    output = StringIO()
    with patch("apps.accounts.lifecycle.delete_firebase_user") as provider:
        call_command("retry_account_deletions", stdout=output)
        call_command("retry_account_deletions", stdout=output)
        provider.assert_called_once_with("lifecycle-user")
    record = AccountDeletion.objects.get()
    assert record.status == "completed"
    assert record.firebase_uid == ""
    assert "private" not in response.content.decode() + output.getvalue()


@pytest.mark.django_db
def test_retry_command_fails_when_provider_cleanup_remains_pending(client: Client) -> None:
    with patch("apps.accounts.lifecycle.delete_firebase_user", side_effect=RuntimeError("private")):
        delete(client)
        with pytest.raises(CommandError, match="Pending account deletions"):
            call_command("retry_account_deletions", stdout=StringIO())
    assert AccountDeletion.objects.get().attempts == 2


def test_firebase_adapter_already_missing_user_is_success() -> None:
    from firebase_admin.auth import UserNotFoundError

    with (
        override_settings(FIREBASE_AUTH_MODE="admin"),
        patch("firebase_admin.get_app"),
        patch(
            "firebase_admin.auth.delete_user", side_effect=UserNotFoundError("synthetic")
        ) as provider,
    ):
        delete_firebase_user("synthetic-user")
    provider.assert_called_once_with("synthetic-user")


@pytest.mark.django_db(transaction=True)
def test_concurrent_authentication_during_deletion_cannot_restore_profile() -> None:
    Client().get("/v1/me", **HEADERS)

    def authenticate() -> None:
        close_old_connections()
        try:
            for _ in range(8):
                assert Client().get("/v1/me", **HEADERS).status_code in {200, 401}
        finally:
            close_old_connections()

    with patch("apps.accounts.lifecycle.delete_firebase_user"):
        with ThreadPoolExecutor(max_workers=2) as pool:
            future = pool.submit(authenticate)
            assert delete(Client()).status_code == 202
            future.result()
    assert not UserProfile.objects.exists()
    assert Client().get("/v1/me", **HEADERS).status_code == 401


@pytest.mark.django_db
def test_delete_confirmation_and_export_placeholder(client: Client) -> None:
    assert client.post(DELETE, {}, content_type="application/json", **HEADERS).status_code == 400
    assert (
        client.post(
            DELETE, {"confirmation": False}, content_type="application/json", **HEADERS
        ).status_code
        == 400
    )
    assert (
        client.post(DELETE, {"confirmation": True}, content_type="application/json").status_code
        == 401
    )
    response = client.post("/v1/me/export", **HEADERS)
    assert response.status_code == 501
    assert response.json()["code"] == "export_unavailable"


@pytest.mark.django_db(transaction=True)
def test_concurrent_delete_requests_converge_without_recreating_profile() -> None:
    Client().get("/v1/me", **HEADERS)

    def perform() -> dict[str, str]:
        close_old_connections()
        try:
            response = delete(Client())
            assert response.status_code == 202
            return response.json()  # type: ignore[no-any-return]
        finally:
            close_old_connections()

    with patch("apps.accounts.lifecycle.delete_firebase_user") as provider:
        with ThreadPoolExecutor(max_workers=3) as pool:
            receipts = list(pool.map(lambda _: perform(), range(3)))
    assert len({receipt["public_id"] for receipt in receipts}) == 1
    assert AccountDeletion.objects.count() == 1
    assert not UserProfile.objects.exists()
    assert provider.call_count == 1

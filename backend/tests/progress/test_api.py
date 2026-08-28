from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from apps.progress.models import WatchProgress
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_season,
    make_series,
)
from tests.entitlements.builders import grant_staff_entitlement

PROGRESS = "/v1/progress/{episode_id}"
AUTHORIZE = "/v1/playback/{episode_id}/authorize"
DEVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
OTHER_DEVICE = "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee"
VALID_UID = "firebase-user-1"
VALID_CREDENTIAL = f"{MOCK_TOKEN_PREFIX}{VALID_UID}"
HMAC_KEY = "synthetic-hmac-for-tests"


def _headers(
    *,
    territory: str = "FR",
    platform: str = "ios",
    language: str = "en",
    device_id: str | None = DEVICE_ID,
    authorization: str | None = None,
) -> dict[str, Any]:
    headers: dict[str, Any] = {
        "HTTP_X_TERRITORY": territory,
        "HTTP_X_PLATFORM": platform,
        "HTTP_X_LANGUAGE": language,
    }
    if device_id is not None:
        headers["HTTP_X_DEVICE_ID"] = device_id
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    return headers


def _bearer(credential: str) -> str:
    return f"Bearer {credential}"


def _put(client: Client, episode_id: str, body: dict[str, Any], **headers: Any) -> Any:
    return client.put(
        PROGRESS.format(episode_id=episode_id),
        data=json.dumps(body),
        content_type="application/json",
        **headers,
    )


def _get(client: Client, episode_id: str, **headers: Any) -> Any:
    return client.get(PROGRESS.format(episode_id=episode_id), **headers)


def _published_episode(*, order: int = 1, title: str = "Harbor Lights") -> tuple[Any, Any]:
    series, first = make_published_title(title=title, territory="FR")
    if order == 1:
        return series, first
    season = make_season(series, number=1)
    episode = make_episode(
        series,
        season=season,
        order=order,
        publication_status=PublicationStatus.PUBLISHED,
    )
    return series, episode


@pytest.fixture
def freeze_catalog_clock() -> Iterator[None]:
    with patch("apps.catalog.eligibility.timezone.now", return_value=DEFAULT_NOW):
        yield


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    provider = FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)
    with patch("apps.playback.views.get_video_provider", return_value=provider):
        yield provider
    reset_provider_cache()


def _assert_progress_body(payload: dict[str, Any], *, episode_id: str) -> None:
    assert set(payload.keys()) == {"episode_id", "position_seconds", "completed", "updated_at"}
    assert payload["episode_id"] == episode_id
    assert "playback_url" not in payload
    assert "expires_at" not in payload
    assert "lock_reasons" not in payload
    assert "decision" not in payload


@pytest.mark.django_db
def test_missing_headers_return_400_error_envelope(client: Client) -> None:
    response = _put(client, "ep_missing", {"position_seconds": 1})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_request_context"
    fields = {item["field"] for item in body["field_errors"]}
    assert fields == {"X-Territory", "X-Platform", "X-Language"}


@pytest.mark.django_db
def test_anonymous_put_get_free_episode_does_not_create_profile(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1)
    before = _get(client, episode.public_id, **_headers())
    assert before.status_code == 404
    assert UserProfile.objects.count() == 0
    put_response = _put(
        client,
        episode.public_id,
        {"position_seconds": 12, "completed": False},
        **_headers(),
    )
    assert put_response.status_code == 200
    body = put_response.json()
    _assert_progress_body(body, episode_id=episode.public_id)
    assert body["position_seconds"] == 12
    assert body["completed"] is False
    assert UserProfile.objects.count() == 0
    assert WatchProgress.objects.filter(device_id=DEVICE_ID, episode=episode).count() == 1
    assert WatchProgress.objects.filter(user_profile__isnull=False).count() == 0

    get_response = _get(client, episode.public_id, **_headers())
    assert get_response.status_code == 200
    got = get_response.json()
    _assert_progress_body(got, episode_id=episode.public_id)
    assert got["position_seconds"] == 12
    assert got["completed"] is False
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("position", "client_completed", "expected_completed"),
    (
        (86, False, True),
        (85, False, False),
        (10, True, True),
    ),
)
def test_completion_at_ratio_or_flag(
    client: Client,
    freeze_catalog_clock: None,
    position: int,
    client_completed: bool,
    expected_completed: bool,
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=2, title="Completion")
    assert episode.duration_seconds == 90
    response = _put(
        client,
        episode.public_id,
        {"position_seconds": position, "completed": client_completed},
        **_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["completed"] is expected_completed
    assert body["position_seconds"] == position
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
def test_completed_stays_true_and_position_is_clamped(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=3, title="Sticky")
    first = _put(
        client,
        episode.public_id,
        {"position_seconds": 90, "completed": True},
        **_headers(),
    )
    assert first.status_code == 200
    assert first.json()["completed"] is True
    second = _put(
        client,
        episode.public_id,
        {"position_seconds": 9_999, "completed": False},
        **_headers(),
    )
    assert second.status_code == 200
    body = second.json()
    assert body["completed"] is True
    assert body["position_seconds"] == 90
    assert WatchProgress.objects.filter(device_id=DEVICE_ID, episode=episode).count() == 1


@pytest.mark.django_db
def test_identical_put_is_idempotent(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, title="Idempotent")
    payload = {"position_seconds": 20, "completed": False}
    first = _put(client, episode.public_id, payload, **_headers())
    second = _put(client, episode.public_id, payload, **_headers())
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["position_seconds"] == second.json()["position_seconds"]
    assert first.json()["completed"] == second.json()["completed"]
    assert WatchProgress.objects.filter(episode=episode).count() == 1


@pytest.mark.django_db
def test_locked_order_six_does_not_write_or_mint(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Locked Progress")
    response = _put(
        client,
        episode.public_id,
        {"position_seconds": 10, "completed": False},
        **_headers(),
    )
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "playback_locked"
    assert "playback_url" not in body
    assert WatchProgress.objects.count() == 0
    assert UserProfile.objects.count() == 0
    authorize = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert authorize.status_code == 200
    assert authorize.json()["decision"] == "locked"
    assert "playback_url" not in authorize.json()
    locked_get = _get(client, episode.public_id, **_headers())
    assert locked_get.status_code == 403
    assert WatchProgress.objects.count() == 0


@pytest.mark.django_db
def test_ineligible_and_takedown_are_404(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    wrong_territory = _put(
        client,
        episode.public_id,
        {"position_seconds": 1},
        **_headers(territory="DE"),
    )
    assert wrong_territory.status_code == 404
    assert wrong_territory.status_code != 403
    assert "playback_url" not in wrong_territory.json()
    assert WatchProgress.objects.count() == 0

    taken = make_series(title="Taken Down")
    make_right(taken, territories=["FR"], takedown=True)
    hidden = make_episode(taken, publication_status=PublicationStatus.DRAFT)
    type(taken).objects.filter(pk=taken.pk).update(publication_status=PublicationStatus.PUBLISHED)
    type(hidden).objects.filter(pk=hidden.pk).update(publication_status=PublicationStatus.PUBLISHED)
    takedown = _put(client, hidden.public_id, {"position_seconds": 1}, **_headers())
    assert takedown.status_code == 404
    assert WatchProgress.objects.count() == 0

    missing = _put(client, "ep_does_not_exist", {"position_seconds": 1}, **_headers())
    assert missing.status_code == 404


@pytest.mark.django_db
def test_invalid_bearer_is_401(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, title="Bad Token")
    response = _put(
        client,
        episode.public_id,
        {"position_seconds": 1},
        **_headers(authorization=_bearer("not-a-token")),
    )
    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"
    assert "playback_url" not in response.json()
    assert UserProfile.objects.count() == 0
    assert WatchProgress.objects.count() == 0


@pytest.mark.django_db
def test_authenticated_uses_profile_and_ignores_body_user_ids(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Entitled Progress")
    profile = UserProfile.objects.create(firebase_uid=VALID_UID)
    grant_staff_entitlement(profile, episode)
    response = _put(
        client,
        episode.public_id,
        {
            "position_seconds": 15,
            "completed": False,
            "user_id": "usr_forged",
            "firebase_uid": "forged-uid",
            "public_id": "usr_forged",
        },
        **_headers(device_id=OTHER_DEVICE, authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    body = response.json()
    _assert_progress_body(body, episode_id=episode.public_id)
    assert body["position_seconds"] == 15
    assert WatchProgress.objects.filter(user_profile=profile, episode=episode).count() == 1
    assert WatchProgress.objects.filter(device_id=OTHER_DEVICE).count() == 0
    assert UserProfile.objects.count() == 1
    row = WatchProgress.objects.get(user_profile=profile, episode=episode)
    assert row.device_id is None


@pytest.mark.django_db
def test_anonymous_missing_or_malformed_device_id_is_400(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, title="Device Header")
    missing = _put(
        client,
        episode.public_id,
        {"position_seconds": 1},
        **_headers(device_id=None),
    )
    assert missing.status_code == 400
    assert missing.json()["code"] == "invalid_device_id"
    fields = {item["field"] for item in missing.json()["field_errors"]}
    assert fields == {"X-Device-Id"}
    malformed = _put(
        client,
        episode.public_id,
        {"position_seconds": 1},
        **_headers(device_id="not-a-uuid"),
    )
    assert malformed.status_code == 400
    assert malformed.json()["code"] == "invalid_device_id"
    assert WatchProgress.objects.count() == 0
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
def test_progress_does_not_mint_playback_url(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, title="No Mint")
    asset = episode.media_assets.get()
    fake_provider.seed_ready_asset(asset.provider_asset_id)
    response = _put(
        client,
        episode.public_id,
        {"position_seconds": 4},
        **_headers(),
    )
    assert response.status_code == 200
    payload = json.dumps(response.json())
    assert "playback_url" not in payload
    assert "video.example.test" not in payload
    assert urlparse(response.json().get("episode_id", "")).scheme == ""

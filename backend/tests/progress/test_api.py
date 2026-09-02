from __future__ import annotations

import json
from typing import Any

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.progress.models import WatchProgress
from tests.catalog.builders import make_episode, make_published_title
from tests.entitlements.builders import grant_staff_entitlement

PROGRESS = "/v1/progress/{episode_id}"
DEVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
OTHER_DEVICE = "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee"
UID = "firebase-user-1"


def _headers(
    *, device_id: str | None = DEVICE_ID, authorization: str | None = None
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if device_id is not None:
        headers["HTTP_X_DEVICE_ID"] = device_id
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    return headers


def _put(client: Client, episode_id: str, body: dict[str, Any], **headers: Any) -> Any:
    return client.put(
        PROGRESS.format(episode_id=episode_id),
        data=json.dumps(body),
        content_type="application/json",
        **headers,
    )


def _episode(order: int) -> Any:
    series, first = make_published_title(title=f"Progress {order}")
    if order == 1:
        return first
    return make_episode(
        series,
        order=order,
        publication_status=PublicationStatus.PUBLISHED,
    )


@pytest.mark.django_db
def test_anonymous_free_progress_is_device_scoped_and_idempotent(client: Client) -> None:
    episode = _episode(1)
    payload = {"position_seconds": 12, "completed": False}

    first = _put(client, episode.public_id, payload, **_headers())
    second = _put(client, episode.public_id, payload, **_headers())
    own = client.get(PROGRESS.format(episode_id=episode.public_id), **_headers())
    other = client.get(
        PROGRESS.format(episode_id=episode.public_id),
        **_headers(device_id=OTHER_DEVICE),
    )

    assert first.status_code == second.status_code == own.status_code == 200
    assert own.json()["position_seconds"] == 12
    assert other.status_code == 404
    assert WatchProgress.objects.filter(episode=episode).count() == 1
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
def test_progress_clamps_position_and_completion_is_sticky(client: Client) -> None:
    episode = _episode(1)
    _put(client, episode.public_id, {"position_seconds": 90, "completed": True}, **_headers())
    response = _put(
        client,
        episode.public_id,
        {"position_seconds": 9_999, "completed": False},
        **_headers(),
    )

    assert response.json()["position_seconds"] == episode.duration_seconds
    assert response.json()["completed"] is True


@pytest.mark.django_db
def test_locked_episode_does_not_write_progress(client: Client) -> None:
    episode = _episode(6)

    response = _put(
        client,
        episode.public_id,
        {"position_seconds": 10},
        **_headers(),
    )

    assert response.status_code == 403
    assert response.json()["code"] == "playback_locked"
    assert WatchProgress.objects.count() == 0


@pytest.mark.django_db
def test_authenticated_entitlement_uses_profile_not_client_identity(client: Client) -> None:
    episode = _episode(6)
    profile = UserProfile.objects.create(firebase_uid=UID)
    grant_staff_entitlement(profile, episode)
    bearer = f"Bearer {MOCK_TOKEN_PREFIX}{UID}"

    response = _put(
        client,
        episode.public_id,
        {"position_seconds": 15, "user_id": "forged"},
        **_headers(device_id=OTHER_DEVICE, authorization=bearer),
    )

    assert response.status_code == 200
    assert WatchProgress.objects.filter(user_profile=profile, episode=episode).exists()
    assert not WatchProgress.objects.filter(device_id=OTHER_DEVICE).exists()


@pytest.mark.django_db
def test_progress_fails_closed_for_auth_device_and_takedown(client: Client) -> None:
    episode = _episode(1)
    invalid_auth = _put(
        client,
        episode.public_id,
        {"position_seconds": 1},
        **_headers(authorization="Bearer not-a-token"),
    )
    invalid_device = _put(
        client,
        episode.public_id,
        {"position_seconds": 1},
        **_headers(device_id="not-a-uuid"),
    )
    episode.series.takedown = True
    episode.series.save(update_fields=["takedown"])
    taken = _put(client, episode.public_id, {"position_seconds": 1}, **_headers())

    assert invalid_auth.status_code == 401
    assert invalid_device.status_code == 400
    assert taken.status_code == 404
    assert WatchProgress.objects.count() == 0

from __future__ import annotations

from typing import Any

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.progress.models import WatchProgress
from tests.catalog.builders import make_episode, make_published_title

CONTINUE = "/v1/progress/continue"
DEVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
OTHER_DEVICE = "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee"
UID = "firebase-continue-1"


def _headers(
    *, device_id: str | None = DEVICE_ID, authorization: str | None = None
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if device_id is not None:
        headers["HTTP_X_DEVICE_ID"] = device_id
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    return headers


def _series_with_two_episodes() -> tuple[Any, Any, Any]:
    series, first = make_published_title(title="Continue Harbor")
    second = make_episode(series, order=2, publication_status=PublicationStatus.PUBLISHED)
    return series, first, second


@pytest.mark.django_db
def test_continue_resumes_partial_episode_for_that_device_only(client: Client) -> None:
    _series, first, _second = _series_with_two_episodes()
    WatchProgress.objects.create(
        device_id=DEVICE_ID,
        episode=first,
        position_seconds=12,
        completed=False,
    )
    WatchProgress.objects.create(
        device_id=OTHER_DEVICE,
        episode=first,
        position_seconds=40,
        completed=False,
    )

    own = client.get(CONTINUE, **_headers())
    other = client.get(CONTINUE, **_headers(device_id=OTHER_DEVICE))
    missing = client.get(CONTINUE, **_headers(device_id=None))

    assert own.status_code == 200
    assert own["Cache-Control"] == "no-store"
    assert own.json()["items"] == [
        {
            "series_id": first.series.public_id,
            "series_title": "Continue Harbor",
            "artwork_url": None,
            "episode_id": first.public_id,
            "episode_title": first.title,
            "episode_order": 1,
            "position_seconds": 12,
            "duration_seconds": first.duration_seconds,
        }
    ]
    assert other.json()["items"][0]["position_seconds"] == 40
    assert missing.status_code == 400
    assert "firebase" not in own.content.decode()


@pytest.mark.django_db
def test_completed_episode_advances_and_finished_series_is_omitted(client: Client) -> None:
    _series, first, second = _series_with_two_episodes()
    WatchProgress.objects.create(
        device_id=DEVICE_ID, episode=first, position_seconds=90, completed=True
    )

    advanced = client.get(CONTINUE, **_headers())
    assert advanced.status_code == 200
    assert advanced.json()["items"][0]["episode_id"] == second.public_id
    assert advanced.json()["items"][0]["position_seconds"] == 0

    WatchProgress.objects.create(
        device_id=DEVICE_ID, episode=second, position_seconds=90, completed=True
    )
    finished = client.get(CONTINUE, **_headers())
    assert finished.json()["items"] == []


@pytest.mark.django_db
def test_authenticated_continue_ignores_device_and_hides_taken_down_titles(client: Client) -> None:
    _series, first, _second = _series_with_two_episodes()
    profile = UserProfile.objects.create(firebase_uid=UID)
    WatchProgress.objects.create(
        user_profile=profile, episode=first, position_seconds=8, completed=False
    )
    WatchProgress.objects.create(
        device_id=DEVICE_ID, episode=first, position_seconds=80, completed=False
    )
    bearer = f"Bearer {MOCK_TOKEN_PREFIX}{UID}"

    response = client.get(CONTINUE, **_headers(authorization=bearer))
    assert response.status_code == 200
    assert response.json()["items"][0]["position_seconds"] == 8
    assert UserProfile.objects.get().auto_unlock_next is False

    first.series.takedown = True
    first.series.save(update_fields=["takedown"])
    hidden = client.get(CONTINUE, **_headers(authorization=bearer))
    assert hidden.json()["items"] == []

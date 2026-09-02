from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
from django.test import Client
from django.utils import timezone

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from apps.playback.models import MediaAssetState
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import (
    make_episode,
    make_published_licensed_title,
    make_published_title,
    make_series,
)
from tests.entitlements.builders import grant_staff_entitlement

AUTHORIZE = "/v1/playback/{episode_id}/authorize"
UID = "firebase-user-1"
OTHER_UID = "firebase-user-2"


def _bearer(uid: str = UID) -> dict[str, Any]:
    return {"HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}{uid}"}


def _episode(order: int) -> tuple[Any, Any]:
    series, first = make_published_title(title=f"Playback {order}")
    if order == 1:
        return series, first
    return series, make_episode(
        series,
        order=order,
        publication_status=PublicationStatus.PUBLISHED,
    )


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    provider = FakeVideoProvider(hmac_key="synthetic-hmac", ttl_seconds=600)
    with patch("apps.playback.views.get_video_provider", return_value=provider):
        yield provider
    reset_provider_cache()


def _seed(provider: FakeVideoProvider, episode: Any) -> None:
    provider.seed_ready_asset(episode.media_assets.get().provider_asset_id)


def _assert_granted(payload: dict[str, Any], provider: FakeVideoProvider, method: str) -> None:
    assert payload["decision"] == "granted"
    assert payload["access_method"] == method
    parsed = urlparse(payload["playback_url"])
    assert parsed.scheme == "https"
    assert parsed.hostname == "video.example.test"
    assert parsed.path.endswith(".m3u8")
    assert provider.verify_playback_request(
        payload["playback_url"],
        now=timezone.now(),
        request_host="video.example.test",
        referrer="https://video.example.test/app",
    )


@pytest.mark.django_db
def test_anonymous_free_window_and_account_lock(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    _, free = _episode(5)
    _, locked = _episode(6)
    _seed(fake_provider, free)
    _seed(fake_provider, locked)

    free_payload = client.post(AUTHORIZE.format(episode_id=free.public_id)).json()
    locked_payload = client.post(AUTHORIZE.format(episode_id=locked.public_id)).json()

    _assert_granted(free_payload, fake_provider, "free")
    assert locked_payload == {"decision": "locked", "lock_reasons": ["login_required"]}


@pytest.mark.django_db
def test_entitlement_is_account_bound_and_server_owned(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    _, episode = _episode(6)
    _seed(fake_provider, episode)
    EpisodeEntitlement.objects.create(
        user_profile=get_or_create_profile(UID),
        episode=episode,
        source=EntitlementSource.REWARDED_AD,
    )

    own = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_bearer())
    other = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_bearer(OTHER_UID))

    _assert_granted(own.json(), fake_provider, "rewarded_ad")
    assert other.json() == {"decision": "locked", "lock_reasons": ["entitlement_required"]}


@pytest.mark.django_db
def test_staff_entitlement_grants_without_changing_reward_security(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    _, episode = _episode(6)
    _seed(fake_provider, episode)
    grant_staff_entitlement(get_or_create_profile(UID), episode)

    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_bearer())

    _assert_granted(response.json(), fake_provider, "staff")


@pytest.mark.django_db
def test_invalid_token_and_client_supplied_grant_never_unlock(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    _, episode = _episode(6)
    _seed(fake_provider, episode)
    invalid = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        HTTP_AUTHORIZATION="Bearer not-a-token",
    )
    forged = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        data=json.dumps({"source": "staff", "user_id": UID}),
        content_type="application/json",
    )

    assert invalid.status_code == 401
    assert forged.json() == {"decision": "locked", "lock_reasons": ["login_required"]}
    assert EpisodeEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_takedown_unpublished_and_non_ready_media_return_404(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    taken_series, taken = _episode(1)
    _seed(fake_provider, taken)
    taken_series.takedown = True
    taken_series.save(update_fields=["takedown"])

    draft_series = make_series(title="Draft")
    draft = make_episode(draft_series)

    _, processing = _episode(1)
    processing.media_assets.update(state=MediaAssetState.REMOVED)

    for episode in (taken, draft, processing):
        response = client.post(AUTHORIZE.format(episode_id=episode.public_id))
        assert response.status_code == 404
        assert "playback_url" not in response.json()


@pytest.mark.django_db
def test_licensed_right_takedown_immediately_revokes_playback(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    series, episode = make_published_licensed_title(title="Licensed playback")
    _seed(fake_provider, episode)

    granted = client.post(AUTHORIZE.format(episode_id=episode.public_id))
    series.rights.update(takedown=True)
    revoked = client.post(AUTHORIZE.format(episode_id=episode.public_id))

    _assert_granted(granted.json(), fake_provider, "free")
    assert revoked.status_code == 404
    assert "playback_url" not in revoked.json()


@pytest.mark.django_db
def test_provider_failure_is_only_reached_after_a_grant(client: Client) -> None:
    _, free = _episode(1)
    _, locked = _episode(6)
    with patch("apps.playback.views.get_video_provider", return_value=None) as provider:
        free_response = client.post(AUTHORIZE.format(episode_id=free.public_id))
        locked_response = client.post(AUTHORIZE.format(episode_id=locked.public_id))

    assert free_response.status_code == 503
    assert locked_response.json() == {"decision": "locked", "lock_reasons": ["login_required"]}
    assert provider.call_count == 1


@pytest.mark.django_db
def test_series_free_count_is_the_only_access_policy(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    series, episode = _episode(4)
    _seed(fake_provider, episode)
    series.free_episode_count = 3
    series.save(update_fields=["free_episode_count"])

    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        data='{"free_episode_count": 10}',
        content_type="application/json",
    )

    assert response.json() == {"decision": "locked", "lock_reasons": ["login_required"]}

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.catalog.models import PublicationStatus
from apps.playback.models import MediaAssetState
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_series,
)

AUTHORIZE = "/v1/playback/{episode_id}/authorize"
HMAC_KEY = "synthetic-hmac-for-tests"


def _seed_ready(provider: FakeVideoProvider, episode: Any) -> str:
    asset = episode.media_assets.get()
    return provider.seed_ready_asset(asset.provider_asset_id)


def _headers(
    *,
    territory: str = "FR",
    platform: str = "ios",
    language: str = "en",
    request_id: str | None = None,
) -> dict[str, Any]:
    headers = {
        "HTTP_X_TERRITORY": territory,
        "HTTP_X_PLATFORM": platform,
        "HTTP_X_LANGUAGE": language,
    }
    if request_id is not None:
        headers["HTTP_X_REQUEST_ID"] = request_id
    return headers


@pytest.fixture
def freeze_catalog_clock() -> Iterator[None]:
    with patch("apps.catalog.eligibility.timezone.now", return_value=DEFAULT_NOW):
        yield


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    provider = FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)
    with (
        patch("apps.playback.providers.fake.timezone.now", return_value=DEFAULT_NOW),
        patch("apps.playback.views.get_video_provider", return_value=provider),
    ):
        yield provider
    reset_provider_cache()


@pytest.mark.django_db
def test_missing_headers_return_400_error_envelope(client: Client) -> None:
    response = client.post(AUTHORIZE.format(episode_id="ep_missing"))
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_request_context"
    assert "request_id" in body
    fields = {item["field"] for item in body["field_errors"]}
    assert fields == {"X-Territory", "X-Platform", "X-Language"}


@pytest.mark.django_db
def test_mapped_ineligible_episode_is_404(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    _seed_ready(fake_provider, episode)
    wrong_territory = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(territory="DE"),
    )
    assert wrong_territory.status_code == 404
    assert wrong_territory.status_code != 403

    taken_down = make_series(title="Taken Down")
    make_right(taken_down, territories=["FR"], takedown=True)
    hidden = make_episode(taken_down, publication_status=PublicationStatus.DRAFT)
    type(taken_down).objects.filter(pk=taken_down.pk).update(
        publication_status=PublicationStatus.PUBLISHED
    )
    type(hidden).objects.filter(pk=hidden.pk).update(publication_status=PublicationStatus.PUBLISHED)
    hidden_asset = fake_provider.seed_ready_asset()
    del hidden_asset
    response = client.post(AUTHORIZE.format(episode_id=hidden.public_id), **_headers())
    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "authorization",
    (None, "Bearer not-a-token", "Bearer mock.firebase-user-1"),
)
def test_authorize_stays_anonymous_with_or_without_bearer(
    client: Client,
    freeze_catalog_clock: None,
    fake_provider: FakeVideoProvider,
    authorization: str | None,
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    _seed_ready(fake_provider, episode)
    headers = _headers()
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **headers)
    assert response.status_code == 200
    assert response.status_code != 401
    payload = response.json()
    assert "playback_url" in payload
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
def test_success_returns_opaque_https_m3u8_not_on_django_origin(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    _seed_ready(fake_provider, episode)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"playback_url", "expires_at"}
    playback_url = payload["playback_url"]
    parsed = urlparse(playback_url)
    assert parsed.scheme == "https"
    assert parsed.path.endswith(".m3u8")
    assert parsed.hostname == "video.example.test"
    assert parsed.hostname not in {"testserver", "localhost", "127.0.0.1"}
    assert "iframe" not in playback_url
    assert "mediadelivery" not in playback_url
    assert "embed" not in playback_url
    expires_at = payload["expires_at"]
    assert expires_at
    assert "library" not in payload
    assert "guid" not in payload
    assert fake_provider.verify_playback_request(
        playback_url,
        now=DEFAULT_NOW,
        request_host="video.example.test",
        referrer="https://video.example.test/app",
    )


@pytest.mark.django_db
def test_disabled_provider_returns_503_and_never_mints(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    with patch("apps.playback.views.get_video_provider", return_value=None):
        response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "playback_unavailable"
    assert "playback_url" not in body


@pytest.mark.django_db
def test_non_ready_and_removed_assets_are_404(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    asset = episode.media_assets.get()
    fake_provider.seed_ready_asset(asset.provider_asset_id)
    asset.state = MediaAssetState.PROCESSING
    asset.save(update_fields=["state"])
    processing = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert processing.status_code == 404

    asset.state = MediaAssetState.READY
    asset.save(update_fields=["state"])
    fake_provider.takedown(asset.provider_asset_id)
    asset.state = MediaAssetState.REMOVED
    asset.save(update_fields=["state"])
    removed = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert removed.status_code == 404
    assert removed.status_code != 403

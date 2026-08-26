from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from apps.playback.providers.fake import FakeVideoProvider
from apps.playback.providers.tokens import fake_unsigned_playlist_url

HMAC_KEY = "synthetic-hmac-for-tests"
NOW = datetime(2026, 8, 25, 12, 0, tzinfo=UTC)
ALLOWED_HOST = "video.example.test"
ALLOWED_REFERRER = "https://video.example.test/app"


def _provider() -> FakeVideoProvider:
    return FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)


def test_valid_hmac_token_is_accepted() -> None:
    provider = _provider()
    asset_id = provider.seed_ready_asset()
    with patch("apps.playback.providers.fake.timezone.now", return_value=NOW):
        access = provider.issue_playback_access(asset_id)

    assert access.playback_url.startswith("https://video.example.test/")
    assert ".m3u8" in access.playback_url
    assert "127.0.0.1" not in access.playback_url
    assert "testserver" not in access.playback_url
    assert provider.verify_playback_request(
        access.playback_url,
        now=NOW,
        request_host=ALLOWED_HOST,
        referrer=ALLOWED_REFERRER,
    )


def test_unsigned_playback_url_is_denied() -> None:
    provider = _provider()
    asset_id = provider.seed_ready_asset()
    unsigned = provider.unsigned_playlist_url(asset_id)
    assert unsigned == fake_unsigned_playlist_url(asset_id)
    assert "sig=" not in unsigned
    assert not provider.verify_playback_request(
        unsigned,
        now=NOW,
        request_host=ALLOWED_HOST,
        referrer=ALLOWED_REFERRER,
    )


def test_expired_token_is_denied() -> None:
    provider = _provider()
    asset_id = provider.seed_ready_asset()
    expired = provider.expired_playback_url(asset_id, now=NOW)
    assert not provider.verify_playback_request(
        expired,
        now=NOW,
        request_host=ALLOWED_HOST,
        referrer=ALLOWED_REFERRER,
    )
    assert provider.verify_playback_request(
        expired,
        now=NOW - timedelta(minutes=5),
        request_host=ALLOWED_HOST,
        referrer=ALLOWED_REFERRER,
    )


def test_wrong_host_is_denied() -> None:
    provider = _provider()
    asset_id = provider.seed_ready_asset()
    with patch("apps.playback.providers.fake.timezone.now", return_value=NOW):
        access = provider.issue_playback_access(asset_id)
    assert not provider.verify_playback_request(
        access.playback_url,
        now=NOW,
        request_host="attacker.example",
        referrer=ALLOWED_REFERRER,
    )


def test_hotlink_referrer_is_denied() -> None:
    provider = _provider()
    asset_id = provider.seed_ready_asset()
    with patch("apps.playback.providers.fake.timezone.now", return_value=NOW):
        access = provider.issue_playback_access(asset_id)
    assert not provider.verify_playback_request(
        access.playback_url,
        now=NOW,
        request_host=ALLOWED_HOST,
        referrer="https://hotlink.example/stolen",
    )
    assert not provider.verify_playback_request(
        access.playback_url,
        now=NOW,
        request_host=ALLOWED_HOST,
        referrer=None,
    )


def test_seeded_asset_has_vertical_ladder_and_captions() -> None:
    provider = _provider()
    asset_id = provider.seed_ready_asset()
    metadata = provider.get_asset(asset_id)
    assert metadata.renditions == ("360p", "540p", "720p")
    assert metadata.has_captions
    assert metadata.has_audio
    assert metadata.is_portrait
    assert metadata.thumbnail_count == 1
    assert metadata.duration_seconds == 3.0

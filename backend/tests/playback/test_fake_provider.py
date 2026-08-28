from __future__ import annotations

from datetime import UTC, datetime
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

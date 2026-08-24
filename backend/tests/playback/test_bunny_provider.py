from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse

from apps.playback.providers.bunny import BunnyHttpResponse, BunnyStreamVideoProvider
from apps.playback.providers.tokens import (
    bunny_unsigned_playlist_url,
    bunny_url_expires_unix,
    bunny_url_has_signature,
    referrer_allowed,
    sign_bunny_directory_hls_url,
)

LIBRARY_ID = "12345"
CDN_HOST = "vz-example.b-cdn.net"
VIDEO_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
NOW = datetime(2026, 8, 25, 12, 0, tzinfo=UTC)
SIGNING_VALUE = "replace-with-provider-value"
API_VALUE = "replace-with-provider-value"


def _finished_payload() -> dict[str, object]:
    return {
        "guid": VIDEO_ID,
        "status": 4,
        "length": 3,
        "width": 1080,
        "height": 1920,
        "availableResolutions": "360p,480p,720p",
        "thumbnailCount": 1,
        "thumbnailFileName": "thumbnail.jpg",
        "captions": [{"srclang": "en", "label": "en"}],
        "hasAudio": True,
    }


class ScriptedTransport:
    def __init__(self, responses: list[BunnyHttpResponse]) -> None:
        self.responses = list(responses)
        self.calls: list[tuple[str, str, dict[str, str]]] = []

    def __call__(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: bytes | None,
    ) -> BunnyHttpResponse:
        del body
        self.calls.append((method, url, dict(headers)))
        if not self.responses:
            raise AssertionError("unexpected Bunny HTTP call")
        return self.responses.pop(0)


def test_signed_playlist_is_https_m3u8_with_expiry() -> None:
    url = sign_bunny_directory_hls_url(
        cdn_hostname=CDN_HOST,
        video_id=VIDEO_ID,
        security_key=SIGNING_VALUE,
        expires_at=NOW,
    )
    parsed = urlparse(url)
    assert parsed.scheme == "https"
    assert parsed.hostname == CDN_HOST
    assert parsed.path.endswith("/playlist.m3u8")
    assert bunny_url_has_signature(url)
    assert bunny_url_expires_unix(url) == int(NOW.timestamp())
    assert "iframe" not in url
    assert "mediadelivery" not in url


def test_unsigned_and_expired_helpers() -> None:
    unsigned = bunny_unsigned_playlist_url(cdn_hostname=CDN_HOST, video_id=VIDEO_ID)
    assert unsigned.endswith(f"/{VIDEO_ID}/playlist.m3u8")
    assert not bunny_url_has_signature(unsigned)

    expired_at = datetime(2020, 1, 1, tzinfo=UTC)
    expired = sign_bunny_directory_hls_url(
        cdn_hostname=CDN_HOST,
        video_id=VIDEO_ID,
        security_key=SIGNING_VALUE,
        expires_at=expired_at,
    )
    expires = bunny_url_expires_unix(expired)
    assert expires is not None
    assert expires < int(NOW.timestamp())


def test_hotlink_referrer_helper_denies_unknown_host() -> None:
    provider = BunnyStreamVideoProvider(
        library_id=LIBRARY_ID,
        api_key=API_VALUE,
        cdn_hostname=CDN_HOST,
        token_key=SIGNING_VALUE,
        transport=ScriptedTransport([]),
    )
    allowlist = ("video.example.test",)
    assert provider.referrer_is_allowed("https://video.example.test/player", allowlist)
    assert not provider.referrer_is_allowed("https://hotlink.example/", allowlist)
    assert not provider.referrer_is_allowed(None, allowlist)
    assert not referrer_allowed("https://evil.example/", "video.example.test")


def test_submit_upload_captions_and_status_use_http_mocks() -> None:
    with TemporaryDirectory() as raw_directory:
        directory = Path(raw_directory)
        video_path = directory / "master.bin"
        captions_path = directory / "captions.vtt"
        video_path.write_bytes(b"synthetic-master")
        captions_path.write_text("WEBVTT\n", encoding="utf-8")
        finished = json.dumps(_finished_payload()).encode()
        transport = ScriptedTransport(
            [
                BunnyHttpResponse(200, json.dumps({"guid": VIDEO_ID}).encode()),
                BunnyHttpResponse(200, b""),
                BunnyHttpResponse(200, json.dumps({"success": True}).encode()),
                BunnyHttpResponse(200, finished),
                BunnyHttpResponse(200, finished),
                BunnyHttpResponse(200, b""),
            ]
        )
        provider = BunnyStreamVideoProvider(
            library_id=LIBRARY_ID,
            api_key=API_VALUE,
            cdn_hostname=CDN_HOST,
            token_key=SIGNING_VALUE,
            transport=transport,
        )
        asset_id = provider.submit_master(
            title="spike",
            video_path=video_path,
            captions_path=captions_path,
        )
        assert asset_id == VIDEO_ID
        metadata = provider.get_asset(asset_id)
        assert metadata.status == "ready"
        assert metadata.renditions == ("360p", "480p", "720p")
        assert metadata.has_captions
        assert metadata.has_audio
        assert metadata.is_portrait
        assert metadata.thumbnail_count == 1
        access = provider.issue_playback_access(asset_id)
        provider.takedown(asset_id)
        methods = [call[0] for call in transport.calls]
        assert methods == ["POST", "PUT", "POST", "GET", "GET", "DELETE"]
        assert all("AccessKey" in call[2] for call in transport.calls)
        assert access.playback_url.startswith(f"https://{CDN_HOST}/")
        assert "playlist.m3u8" in access.playback_url
        bodies = [call[1] for call in transport.calls]
        assert all(LIBRARY_ID in url for url in bodies)
        assert VIDEO_ID in bodies[1]


def test_get_asset_maps_processing_and_failure() -> None:
    processing = ScriptedTransport(
        [BunnyHttpResponse(200, json.dumps({"guid": VIDEO_ID, "status": 2}).encode())]
    )
    failed = ScriptedTransport(
        [BunnyHttpResponse(200, json.dumps({"guid": VIDEO_ID, "status": 5}).encode())]
    )
    processing_provider = BunnyStreamVideoProvider(
        library_id=LIBRARY_ID,
        api_key=API_VALUE,
        cdn_hostname=CDN_HOST,
        token_key=SIGNING_VALUE,
        transport=processing,
    )
    failed_provider = BunnyStreamVideoProvider(
        library_id=LIBRARY_ID,
        api_key=API_VALUE,
        cdn_hostname=CDN_HOST,
        token_key=SIGNING_VALUE,
        transport=failed,
    )
    assert processing_provider.get_asset(VIDEO_ID).status == "processing"
    assert failed_provider.get_asset(VIDEO_ID).status == "failed"

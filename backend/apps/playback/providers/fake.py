from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.playback.exceptions import VideoAssetNotFoundError
from apps.playback.providers.tokens import (
    FAKE_CDN_HOST,
    fake_playlist_url,
    fake_unsigned_playlist_url,
    verify_fake_playback_url,
)
from apps.playback.providers.types import PlaybackAccess, VideoAssetMetadata

READY_RENDITIONS = ("360p", "540p", "720p")


class FakeVideoProvider:
    """In-memory provider for local development and CI. Mints HMAC access itself."""

    def __init__(
        self,
        *,
        hmac_key: str,
        cdn_host: str = FAKE_CDN_HOST,
        ttl_seconds: int = 600,
    ) -> None:
        self._hmac_key = hmac_key
        self._cdn_host = cdn_host
        self._ttl_seconds = ttl_seconds
        self._assets: dict[str, VideoAssetMetadata] = {}
        self._jobs: dict[str, dict[str, bool]] = {}
        self._held: set[str] = set()

    def seed_ready_asset(
        self,
        asset_id: str | None = None,
        *,
        duration_seconds: float = 3.0,
        has_captions: bool = True,
    ) -> str:
        identifier = asset_id or f"fake_{uuid.uuid4().hex}"
        self._assets[identifier] = VideoAssetMetadata(
            asset_id=identifier,
            status="ready",
            duration_seconds=duration_seconds,
            renditions=READY_RENDITIONS,
            thumbnail_count=1,
            has_captions=has_captions,
            width=1080,
            height=1920,
            has_audio=True,
        )
        self._jobs.pop(identifier, None)
        self._held.discard(identifier)
        return identifier

    def submit_master(
        self,
        *,
        title: str,
        video_path: Path,
        captions_path: Path | None,
        captions_language: str = "en",
    ) -> str:
        del title, video_path, captions_language
        identifier = f"fake_{uuid.uuid4().hex}"
        has_captions = False
        if captions_path is not None:
            text = captions_path.read_text(encoding="utf-8")
            has_captions = text.lstrip().startswith("WEBVTT")
        self._jobs[identifier] = {"has_captions": has_captions}
        self._assets[identifier] = VideoAssetMetadata(
            asset_id=identifier,
            status="processing",
            duration_seconds=None,
            renditions=(),
            thumbnail_count=0,
            has_captions=False,
            width=None,
            height=None,
            has_audio=False,
        )
        return identifier

    def complete_processing(
        self,
        asset_id: str,
        *,
        failed: bool = False,
        has_captions: bool | None = None,
        thumbnail_count: int = 1,
    ) -> None:
        current = self._assets.get(asset_id)
        if current is None:
            raise VideoAssetNotFoundError(asset_id)
        self._held.discard(asset_id)
        if failed:
            self._assets[asset_id] = VideoAssetMetadata(
                asset_id=asset_id,
                status="failed",
                duration_seconds=current.duration_seconds,
                renditions=(),
                thumbnail_count=0,
                has_captions=False,
                width=current.width,
                height=current.height,
                has_audio=False,
            )
            return
        job = self._jobs.get(asset_id, {})
        captions = job.get("has_captions", False) if has_captions is None else has_captions
        self._assets[asset_id] = VideoAssetMetadata(
            asset_id=asset_id,
            status="ready",
            duration_seconds=3.0,
            renditions=READY_RENDITIONS,
            thumbnail_count=thumbnail_count,
            has_captions=captions,
            width=1080,
            height=1920,
            has_audio=True,
        )

    def fail_job(self, asset_id: str) -> None:
        self.complete_processing(asset_id, failed=True)

    def hold_processing(self, asset_id: str) -> None:
        """Keep get_asset in processing until complete_processing or fail_job."""
        if asset_id not in self._assets:
            raise VideoAssetNotFoundError(asset_id)
        self._held.add(asset_id)

    def has_asset(self, asset_id: str) -> bool:
        return asset_id in self._assets

    def get_asset(self, asset_id: str) -> VideoAssetMetadata:
        asset = self._assets.get(asset_id)
        if asset is None:
            raise VideoAssetNotFoundError(asset_id)
        if asset.status == "processing" and asset_id not in self._held:
            self.complete_processing(asset_id)
            ready = self._assets.get(asset_id)
            if ready is None:
                raise VideoAssetNotFoundError(asset_id)
            return ready
        return asset

    def issue_playback_access(self, asset_id: str) -> PlaybackAccess:
        asset = self.get_asset(asset_id)
        if asset.status != "ready":
            raise VideoAssetNotFoundError(asset_id)
        expires_at = timezone.now() + timedelta(seconds=self._ttl_seconds)
        return PlaybackAccess(
            playback_url=fake_playlist_url(
                hmac_key=self._hmac_key,
                asset_id=asset_id,
                expires_at=expires_at,
                host=self._cdn_host,
            ),
            expires_at=expires_at,
        )

    def takedown(self, asset_id: str) -> None:
        self._assets.pop(asset_id, None)
        self._jobs.pop(asset_id, None)
        self._held.discard(asset_id)

    def unsigned_playlist_url(self, asset_id: str) -> str:
        return fake_unsigned_playlist_url(asset_id, host=self._cdn_host)

    def expired_playback_url(self, asset_id: str, *, now: datetime | None = None) -> str:
        instant = now if now is not None else datetime.now(tz=UTC)
        expired_at = instant - timedelta(seconds=30)
        return fake_playlist_url(
            hmac_key=self._hmac_key,
            asset_id=asset_id,
            expires_at=expired_at,
            host=self._cdn_host,
        )

    def verify_playback_request(
        self,
        url: str,
        *,
        now: datetime | None = None,
        request_host: str | None,
        referrer: str | None,
    ) -> bool:
        instant = now if now is not None else datetime.now(tz=UTC)
        return verify_fake_playback_url(
            url,
            hmac_key=self._hmac_key,
            now=instant,
            request_host=request_host,
            referrer=referrer,
        )


def fake_provider_from_settings() -> FakeVideoProvider:
    ttl = int(getattr(settings, "PLAYBACK_TOKEN_TTL_SECONDS", 600))
    host = str(getattr(settings, "FAKE_PLAYBACK_CDN_HOST", FAKE_CDN_HOST))
    hmac_key = str(getattr(settings, "SECRET_KEY", "local-fake-hmac"))
    return FakeVideoProvider(hmac_key=hmac_key, cdn_host=host, ttl_seconds=ttl)

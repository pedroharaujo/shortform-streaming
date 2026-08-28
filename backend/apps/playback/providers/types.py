from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True, slots=True)
class VideoAssetMetadata:
    asset_id: str
    status: str
    duration_seconds: float | None
    renditions: tuple[str, ...]
    thumbnail_count: int
    has_captions: bool
    width: int | None
    height: int | None
    has_audio: bool

    @property
    def is_portrait(self) -> bool:
        if self.width is None or self.height is None:
            return False
        return self.height > self.width


@dataclass(frozen=True, slots=True)
class PlaybackAccess:
    playback_url: str
    expires_at: datetime


class VideoProvider(Protocol):
    """Provider-agnostic video ingest, metadata, authorization, and takedown."""

    def submit_master(
        self,
        *,
        title: str,
        video_path: Path,
        captions_path: Path | None,
        captions_language: str = "en",
    ) -> str:
        """Upload a vertical master and optional captions. Returns provider asset id."""

    def get_asset(self, asset_id: str) -> VideoAssetMetadata:
        """Return renditions, duration, thumbnails, and caption presence."""

    def issue_playback_access(self, asset_id: str) -> PlaybackAccess:
        """Mint a short-lived opaque HTTPS HLS URL. Never unsigned."""

    def takedown(self, asset_id: str) -> None:
        """Expire or delete the provider asset. Admin takedown must call this."""

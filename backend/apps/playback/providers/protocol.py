from __future__ import annotations

from pathlib import Path
from typing import Protocol

from apps.playback.providers.types import PlaybackAccess, VideoAssetMetadata


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

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


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

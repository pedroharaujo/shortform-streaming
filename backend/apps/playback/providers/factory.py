from __future__ import annotations

from django.conf import settings

from apps.playback.exceptions import VideoProviderError
from apps.playback.providers.bunny import BunnyStreamVideoProvider
from apps.playback.providers.fake import FakeVideoProvider, fake_provider_from_settings
from apps.playback.providers.protocol import VideoProvider

_cached_fake: FakeVideoProvider | None = None


def reset_provider_cache() -> None:
    global _cached_fake
    _cached_fake = None


def get_video_provider() -> VideoProvider | None:
    """Return the configured provider, or None when playback is disabled.

    Unset, unknown, or incompletely configured providers fail closed. Authorize
    must never mint unsigned access.
    """
    name = str(getattr(settings, "VIDEO_PROVIDER", "")).strip().lower()
    if not name:
        return None
    if name == "fake":
        return _get_fake()
    if name == "bunny":
        try:
            return BunnyStreamVideoProvider.from_django_settings()
        except VideoProviderError:
            return None
    return None


def _get_fake() -> FakeVideoProvider:
    global _cached_fake
    if _cached_fake is None:
        _cached_fake = fake_provider_from_settings()
    return _cached_fake

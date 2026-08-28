from __future__ import annotations

from django.test import override_settings

from apps.playback.providers.factory import get_video_provider, reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider


def setup_function() -> None:
    reset_provider_cache()


def teardown_function() -> None:
    reset_provider_cache()


def test_factory_returns_fake_when_configured() -> None:
    with override_settings(VIDEO_PROVIDER="fake"):
        provider = get_video_provider()
    assert isinstance(provider, FakeVideoProvider)


def test_factory_builds_bunny_when_configured() -> None:
    with override_settings(
        VIDEO_PROVIDER="bunny",
        BUNNY_STREAM_LIBRARY_ID="12345",
        BUNNY_STREAM_API_KEY="replace-with-provider-value",
        BUNNY_STREAM_CDN_HOSTNAME="vz-example.b-cdn.net",
        BUNNY_STREAM_TOKEN_KEY="replace-with-provider-value",
    ):
        provider = get_video_provider()
    assert provider is not None
    assert provider.__class__.__name__ == "BunnyStreamVideoProvider"


def test_factory_returns_none_when_unusable() -> None:
    with override_settings(VIDEO_PROVIDER=""):
        assert get_video_provider() is None
    reset_provider_cache()
    with override_settings(VIDEO_PROVIDER="unknown"):
        assert get_video_provider() is None
    reset_provider_cache()
    with override_settings(
        VIDEO_PROVIDER="bunny",
        BUNNY_STREAM_LIBRARY_ID="",
        BUNNY_STREAM_API_KEY="",
        BUNNY_STREAM_CDN_HOSTNAME="",
        BUNNY_STREAM_TOKEN_KEY="",
    ):
        assert get_video_provider() is None

from __future__ import annotations

from io import StringIO
from unittest.mock import patch

from django.core.management.base import OutputWrapper
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


def test_factory_returns_none_when_unset() -> None:
    with override_settings(VIDEO_PROVIDER=""):
        assert get_video_provider() is None


def test_factory_returns_none_for_unknown_provider() -> None:
    with override_settings(VIDEO_PROVIDER="unknown"):
        assert get_video_provider() is None


def test_factory_returns_none_when_bunny_credentials_missing() -> None:
    with override_settings(
        VIDEO_PROVIDER="bunny",
        BUNNY_STREAM_LIBRARY_ID="",
        BUNNY_STREAM_API_KEY="",
        BUNNY_STREAM_CDN_HOSTNAME="",
        BUNNY_STREAM_TOKEN_KEY="",
    ):
        assert get_video_provider() is None


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


def test_command_refuses_fake_provider() -> None:
    from django.core.management import call_command
    from django.core.management.base import CommandError

    with (
        override_settings(VIDEO_PROVIDER="fake"),
        patch(
            "apps.playback.management.commands.spike_bunny_playback.generate_vertical_test_media"
        ) as generate,
    ):
        try:
            call_command("spike_bunny_playback")
            raised = None
        except CommandError as error:
            raised = error
    assert raised is not None
    assert "VIDEO_PROVIDER=bunny" in str(raised)
    generate.assert_not_called()


def test_spike_success_footer_is_ascii() -> None:
    from apps.playback.management.commands.spike_bunny_playback import SPIKE_SUCCESS_FOOTER

    assert "→" not in SPIKE_SUCCESS_FOOTER
    assert "Playback -> Media assets" in SPIKE_SUCCESS_FOOTER
    SPIKE_SUCCESS_FOOTER.encode("cp1252")
    buffer = StringIO()
    OutputWrapper(buffer).write(SPIKE_SUCCESS_FOOTER)
    written = buffer.getvalue()
    assert "→" not in written
    written.encode("cp1252")

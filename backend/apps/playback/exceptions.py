from __future__ import annotations

from rest_framework.exceptions import APIException


class PlaybackUnavailable(APIException):
    status_code = 503
    default_code = "playback_unavailable"
    envelope_code = "playback_unavailable"
    envelope_message = "Playback is temporarily unavailable."


class VideoAssetNotFoundError(LookupError):
    """Provider does not have a ready asset for this id."""


class VideoProviderError(RuntimeError):
    """Provider call failed without exposing secrets."""

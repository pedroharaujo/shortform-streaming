from __future__ import annotations

from rest_framework.exceptions import APIException

from config.error_envelope import FieldError

_LOCKED_MESSAGE = "This episode is not playable."
_DEVICE_ID_MESSAGE = (
    "X-Device-Id is required for anonymous progress and must be a UUID. "
    "It is never a user id or Firebase UID."
)


class PlaybackLocked(APIException):
    status_code = 403
    default_code = "playback_locked"
    default_detail = _LOCKED_MESSAGE
    envelope_code = "playback_locked"
    envelope_message = _LOCKED_MESSAGE


class ProgressDeviceIdError(APIException):
    status_code = 400
    default_code = "invalid_device_id"
    default_detail = _DEVICE_ID_MESSAGE
    envelope_code = "invalid_device_id"
    envelope_message = _DEVICE_ID_MESSAGE

    def __init__(self, field_errors: list[FieldError]) -> None:
        self.field_errors = field_errors
        super().__init__(detail=_DEVICE_ID_MESSAGE)

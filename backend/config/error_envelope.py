from __future__ import annotations

import uuid
from typing import TypedDict

from django.http import HttpRequest
from rest_framework.request import Request


class FieldError(TypedDict):
    field: str
    code: str
    message: str


class ErrorEnvelope(TypedDict, total=False):
    code: str
    message: str
    request_id: str
    field_errors: list[FieldError]


def get_request_id(request: HttpRequest | Request | None) -> str:
    """Return `X-Request-ID` when it is a short printable token, else a UUID."""
    if request is None:
        return str(uuid.uuid4())
    raw = request.META.get("HTTP_X_REQUEST_ID", "")
    if not isinstance(raw, str):
        return str(uuid.uuid4())
    candidate = raw.strip()
    if 1 <= len(candidate) <= 128 and candidate.isprintable() and "\n" not in candidate:
        return candidate
    return str(uuid.uuid4())


def envelope_to_dict(payload: ErrorEnvelope) -> dict[str, object]:
    body: dict[str, object] = {
        "code": payload["code"],
        "message": payload["message"],
        "request_id": payload["request_id"],
    }
    field_errors = payload.get("field_errors")
    if field_errors:
        body["field_errors"] = field_errors
    return body

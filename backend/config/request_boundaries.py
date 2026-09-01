from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from io import BytesIO
from typing import Any

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from rest_framework.exceptions import APIException
from rest_framework.parsers import JSONParser

from config.error_envelope import ErrorEnvelope, envelope_to_dict, get_request_id

_BODY_METHODS = frozenset({"PATCH", "POST", "PUT"})
_ALWAYS_BODY_METHODS = frozenset({"PATCH", "PUT"})
_JSON_MEDIA_TYPE = "application/json"
_EMPTY_MULTIPART_BODY = re.compile(rb"--[!#$%&'*+.^_`|~0-9A-Za-z-]{1,70}--\r\n")


class RequestTooLarge(APIException):
    status_code = 413
    default_code = "request_too_large"
    default_detail = "The request body is too large."
    envelope_message = default_detail


def _boundary_response(request: HttpRequest, status_code: int) -> JsonResponse:
    if status_code == 413:
        code = "request_too_large"
        message = "The request body is too large."
    elif status_code == 415:
        code = "unsupported_media_type"
        message = "Unsupported media type."
    else:
        code = "invalid_request"
        message = "The request is invalid."
    payload: ErrorEnvelope = {
        "code": code,
        "message": message,
        "request_id": get_request_id(request),
    }
    return JsonResponse(envelope_to_dict(payload), status=status_code)


class APIRequestBoundaryMiddleware:
    """Reject oversized or non-JSON consumer API bodies before authentication."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path.startswith("/v1/") and request.method in _BODY_METHODS:
            raw_length = request.META.get("CONTENT_LENGTH", "")
            try:
                content_length = int(raw_length) if raw_length else 0
            except (TypeError, ValueError):
                return _boundary_response(request, 400)
            if content_length < 0:
                return _boundary_response(request, 400)
            if content_length > settings.API_MAX_REQUEST_BODY_BYTES:
                return _boundary_response(request, 413)
            has_body = content_length > 0 or bool(request.META.get("HTTP_TRANSFER_ENCODING"))
            if has_body:
                media_type = (request.content_type or "").partition(";")[0].strip().casefold()
                reject_media = media_type != _JSON_MEDIA_TYPE
                if (
                    request.method not in _ALWAYS_BODY_METHODS
                    and media_type == "multipart/form-data"
                    and content_length <= 128
                ):
                    reject_media = _EMPTY_MULTIPART_BODY.fullmatch(request.body) is None
                if reject_media:
                    return _boundary_response(request, 415)
        return self.get_response(request)


class BoundedJSONParser(JSONParser):
    """Read at most the configured consumer API body limit plus one byte."""

    def parse(
        self,
        stream: Any,
        media_type: str | None = None,
        parser_context: Mapping[str, Any] | None = None,
    ) -> Any:
        raw = stream.read(settings.API_MAX_REQUEST_BODY_BYTES + 1)
        if len(raw) > settings.API_MAX_REQUEST_BODY_BYTES:
            raise RequestTooLarge()
        return super().parse(BytesIO(raw), media_type=media_type, parser_context=parser_context)

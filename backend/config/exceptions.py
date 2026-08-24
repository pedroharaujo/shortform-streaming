from __future__ import annotations

from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from config.error_envelope import (
    ErrorEnvelope,
    FieldError,
    envelope_to_dict,
    get_request_id,
)

_SAFE_DEFAULT_MESSAGES: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "The request is invalid.",
    status.HTTP_401_UNAUTHORIZED: "Authentication is required.",
    status.HTTP_403_FORBIDDEN: "You do not have access to this resource.",
    status.HTTP_404_NOT_FOUND: "Resource not found.",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Method not allowed.",
    status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests.",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "An internal error occurred.",
}


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Return the shared ErrorEnvelope for API exceptions.

    `request_id` is taken from `X-Request-ID` when present, otherwise a generated UUID.
    Messages are static/safe; request bodies, tokens, and secrets are never included.
    """
    request = context.get("request")
    request_id = get_request_id(request if isinstance(request, Request) else None)

    if isinstance(exc, Http404):
        return _envelope_response(
            status.HTTP_404_NOT_FOUND,
            code="not_found",
            message=_SAFE_DEFAULT_MESSAGES[status.HTTP_404_NOT_FOUND],
            request_id=request_id,
        )

    if isinstance(exc, DjangoPermissionDenied):
        return _envelope_response(
            status.HTTP_403_FORBIDDEN,
            code="permission_denied",
            message=_SAFE_DEFAULT_MESSAGES[status.HTTP_403_FORBIDDEN],
            request_id=request_id,
        )

    if isinstance(exc, ValidationError):
        field_errors = _field_errors_from_detail(exc.detail)
        return _envelope_response(
            status.HTTP_400_BAD_REQUEST,
            code="validation_error",
            message=_SAFE_DEFAULT_MESSAGES[status.HTTP_400_BAD_REQUEST],
            request_id=request_id,
            field_errors=field_errors,
        )

    if isinstance(exc, APIException):
        api_field_errors = _field_errors_from_exception(exc)
        status_code = int(getattr(exc, "status_code", status.HTTP_400_BAD_REQUEST))
        code = _api_exception_code(exc)
        message = _safe_api_exception_message(exc, status_code)
        return _envelope_response(
            status_code,
            code=code,
            message=message,
            request_id=request_id,
            field_errors=api_field_errors,
        )

    # Unknown exceptions: keep DRF's default (None re-raises in DEBUG-unhandled
    # paths). Convert only after DRF has classified the exception.
    fallback = drf_exception_handler(exc, context)
    if fallback is None:
        return _envelope_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="internal_error",
            message=_SAFE_DEFAULT_MESSAGES[status.HTTP_500_INTERNAL_SERVER_ERROR],
            request_id=request_id,
        )
    return _envelope_response(
        fallback.status_code,
        code="error",
        message=_SAFE_DEFAULT_MESSAGES.get(
            fallback.status_code, _SAFE_DEFAULT_MESSAGES[status.HTTP_500_INTERNAL_SERVER_ERROR]
        ),
        request_id=request_id,
    )


def _envelope_response(
    status_code: int,
    *,
    code: str,
    message: str,
    request_id: str,
    field_errors: list[FieldError] | None = None,
) -> Response:
    payload: ErrorEnvelope = {
        "code": code,
        "message": message,
        "request_id": request_id,
    }
    if field_errors:
        payload["field_errors"] = field_errors
    return Response(envelope_to_dict(payload), status=status_code)


def _api_exception_code(exc: APIException) -> str:
    extra_code = getattr(exc, "envelope_code", None)
    if isinstance(extra_code, str) and extra_code:
        return extra_code
    default_code = getattr(exc, "default_code", None)
    if isinstance(default_code, str) and default_code:
        return default_code
    return "error"


def _safe_api_exception_message(exc: APIException, status_code: int) -> str:
    extra = getattr(exc, "envelope_message", None)
    if isinstance(extra, str) and extra:
        return extra
    return _SAFE_DEFAULT_MESSAGES.get(
        status_code, _SAFE_DEFAULT_MESSAGES[status.HTTP_500_INTERNAL_SERVER_ERROR]
    )


def _field_errors_from_exception(exc: APIException) -> list[FieldError] | None:
    extra = getattr(exc, "field_errors", None)
    if isinstance(extra, list) and extra:
        return extra
    detail = getattr(exc, "detail", None)
    if detail is None or isinstance(detail, str):
        return None
    errors = _field_errors_from_detail(detail)
    return errors or None


def _field_errors_from_detail(detail: object, field: str = "") -> list[FieldError]:
    errors: list[FieldError] = []
    if isinstance(detail, dict):
        for key, value in detail.items():
            nested_field = str(key) if key != "non_field_errors" else ""
            errors.extend(_field_errors_from_detail(value, nested_field))
        return errors
    if isinstance(detail, list):
        for item in detail:
            errors.extend(_field_errors_from_detail(item, field))
        return errors
    code = getattr(detail, "code", None)
    errors.append(
        {
            "field": field,
            "code": str(code) if code else "invalid",
            "message": str(detail),
        }
    )
    return errors

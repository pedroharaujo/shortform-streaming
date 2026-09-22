from __future__ import annotations

import logging
from collections.abc import Callable
from time import perf_counter

from django.http import HttpRequest, HttpResponse

from config.error_envelope import get_request_id

_request_logger = logging.getLogger("shortform.request")


def _route_label(request: HttpRequest) -> str:
    match = getattr(request, "resolver_match", None)
    route = getattr(match, "route", None)
    if isinstance(route, str) and route and len(route) <= 200:
        return route
    if request.path.startswith("/v1/"):
        return "api"
    if request.path.startswith("/health/"):
        return "health"
    if request.path.startswith("/admin/"):
        return "admin"
    return "other"


def _method_label(request: HttpRequest) -> str:
    raw_method = request.method
    if not isinstance(raw_method, str):
        return "OTHER"
    method = raw_method.upper()
    if method.isascii() and method.isalpha() and len(method) <= 16:
        return method
    return "OTHER"


class RequestCorrelationMiddleware:
    """Share one safe request ID across responses, errors, and completion logs."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = get_request_id(request)
        request.META["HTTP_X_REQUEST_ID"] = request_id
        started_at = perf_counter()
        response = self.get_response(request)
        duration_ms = max(0.0, (perf_counter() - started_at) * 1000)
        response["X-Request-ID"] = request_id
        _request_logger.info(
            "request_completed",
            extra={
                "event_name": "request_completed",
                "request_id": request_id,
                "http_method": _method_label(request),
                "http_route": _route_label(request),
                "http_status": response.status_code,
                "duration_ms": round(duration_ms, 3),
            },
        )
        return response

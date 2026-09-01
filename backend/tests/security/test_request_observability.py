from __future__ import annotations

import json
import logging
from typing import Protocol
from unittest.mock import patch

import pytest
from django.test import Client, override_settings

from config.logging import PrivacySafeJsonFormatter

pytestmark = pytest.mark.django_db


class _TestResponse(Protocol):
    status_code: int
    headers: object

    def json(self) -> dict[str, object]: ...


def _log_extra(mock_log: object) -> dict[str, object]:
    call_args = mock_log.call_args  # type: ignore[attr-defined]
    return dict(call_args.kwargs["extra"])


def test_application_error_shares_request_id_and_logs_route_template(client: Client) -> None:
    request_id = "req-observe-404"
    opaque_marker = "ep_private_marker"
    with patch("config.observability._request_logger.info") as log:
        response = client.get(
            f"/v1/episodes/{opaque_marker}?signature=never-log-query",
            HTTP_X_REQUEST_ID=request_id,
            HTTP_X_TERRITORY="FR",
            HTTP_X_PLATFORM="android",
            HTTP_X_LANGUAGE="en",
            HTTP_AUTHORIZATION="Bearer never-log-credential",
        )

    assert response.status_code == 404
    assert response.headers["X-Request-ID"] == request_id
    assert response.json()["request_id"] == request_id
    extra = _log_extra(log)
    assert extra["request_id"] == request_id
    assert extra["http_route"] == "v1/episodes/<str:public_id>"
    serialized = json.dumps(extra)
    assert opaque_marker not in serialized
    assert "never-log-query" not in serialized
    assert "never-log-credential" not in serialized


@override_settings(SECURE_SSL_REDIRECT=True)
def test_security_redirect_is_correlated_by_outermost_middleware(client: Client) -> None:
    with patch("config.observability._request_logger.info") as log:
        response = client.get("/health/live", HTTP_X_REQUEST_ID="req-security-redirect")

    assert response.status_code == 301
    assert response.headers["X-Request-ID"] == "req-security-redirect"
    assert _log_extra(log)["http_route"] == "health"


@override_settings(API_MAX_REQUEST_BODY_BYTES=32)
def test_early_request_rejection_is_correlated_without_logging_payload(client: Client) -> None:
    request_id = "req-observe-413"
    with patch("config.observability._request_logger.info") as log:
        response = client.generic(
            "PATCH",
            "/v1/me?signature=never-log-early-query",
            json.dumps({"payload": "never-log-body-marker" * 4}),
            content_type="application/json",
            HTTP_X_REQUEST_ID=request_id,
            HTTP_AUTHORIZATION="Bearer never-log-early-credential",
        )

    assert response.status_code == 413
    assert response.headers["X-Request-ID"] == request_id
    assert response.json()["request_id"] == request_id
    extra = _log_extra(log)
    assert extra["http_route"] == "api"
    serialized = json.dumps(extra)
    assert "never-log-early-query" not in serialized
    assert "never-log-body-marker" not in serialized
    assert "never-log-early-credential" not in serialized


def test_formatter_ignores_message_exception_and_unreviewed_context() -> None:
    record = logging.LogRecord(
        "shortform.request",
        logging.INFO,
        __file__,
        1,
        "never-log-message-marker",
        (),
        None,
    )
    record.event_name = "request_completed"
    record.request_id = "req-safe"
    record.http_method = "GET"
    record.http_route = "health/live"
    record.http_status = 200
    record.duration_ms = 1.25
    record.authorization = "never-log-unreviewed-marker"

    payload = json.loads(PrivacySafeJsonFormatter().format(record))

    assert payload == {
        "duration_ms": 1.25,
        "event": "request_completed",
        "http_method": "GET",
        "http_route": "health/live",
        "http_status": 200,
        "request_id": "req-safe",
        "severity": "INFO",
    }

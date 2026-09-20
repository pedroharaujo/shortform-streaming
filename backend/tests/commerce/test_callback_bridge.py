from __future__ import annotations

import http.client
import socket
import threading
import time
from contextlib import closing
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import pytest
from django.urls import reverse

from config.purchase_callback_bridge import CALLBACK_PATH, PurchaseCallbackBridge
from tests.advertising.test_callback_bridge import running

BODY = b'{ "api_version": "1.0", "event": {"type":"TEST"} }\n'
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + "generated-authorization-" * 2,
    "X-RevenueCat-Webhook-Signature": "t=1234567890,v1=" + "a" * 64,
}


def test_bridge_targets_the_registered_django_purchase_callback() -> None:
    assert CALLBACK_PATH == reverse("purchase-callback")


def test_purchase_bridge_preserves_signed_bytes_and_only_required_headers(
    capsys: pytest.CaptureFixture[str],
) -> None:
    received: list[tuple[str, dict[str, str], bytes]] = []

    class Origin(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            received.append(
                (
                    self.path,
                    dict(self.headers),
                    self.rfile.read(int(self.headers["Content-Length"])),
                )
            )
            self.send_response(200)
            self.send_header("Set-Cookie", "generated-private-cookie")
            self.end_headers()
            self.wfile.write(b"GENERATED PRIVATE DEBUG PAGE")

        def log_message(self, *_args: Any) -> None:
            pass

    with running(HTTPServer(("127.0.0.1", 0), Origin)) as upstream:
        with running(PurchaseCallbackBridge(0, upstream_port=upstream)) as port:
            with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
                connection.request(
                    "POST",
                    CALLBACK_PATH,
                    BODY,
                    {**HEADERS, "Cookie": "generated-private", "X-Forwarded-For": "192.0.2.1"},
                )
                response = connection.getresponse()
                assert response.status == 200
                assert response.read() == b""
                assert response.getheader("Cache-Control") == "no-store"
                assert response.getheader("Set-Cookie") is None
    assert len(received) == 1
    path, headers, body = received[0]
    assert path == CALLBACK_PATH and body == BODY
    assert headers["Authorization"] == HEADERS["Authorization"]
    assert headers["X-RevenueCat-Webhook-Signature"] == HEADERS["X-RevenueCat-Webhook-Signature"]
    assert headers["Host"] == f"127.0.0.1:{upstream}"
    assert "Cookie" not in headers and "X-Forwarded-For" not in headers
    assert capsys.readouterr() == ("", "")


@pytest.mark.parametrize(
    "target,method,extra,status",
    [
        ("/admin/", "POST", [], 404),
        ("/v1/purchases/sync", "POST", [], 404),
        (CALLBACK_PATH + "?secret=generated", "POST", [], 404),
        ("/v1/purchases/%72evenuecat", "POST", [], 404),
        ("/" + CALLBACK_PATH, "POST", [], 404),
        ("http://example.test" + CALLBACK_PATH, "POST", [], 404),
        (CALLBACK_PATH, "GET", [], 405),
        (CALLBACK_PATH, "HEAD", [], 405),
        (CALLBACK_PATH, "OPTIONS", [], 405),
        (CALLBACK_PATH, "POST", [("Transfer-Encoding", "chunked")], 400),
        (CALLBACK_PATH, "POST", [("Content-Length", str(len(BODY)))], 400),
        (CALLBACK_PATH, "POST", [("Authorization", "other")], 400),
        (CALLBACK_PATH, "POST", [("X-RevenueCat-Webhook-Signature", "other")], 400),
        (CALLBACK_PATH, "POST", [("Content-Type", "text/plain")], 400),
        (CALLBACK_PATH, "POST", [("X-Large", "x" * 8192)], 431),
    ],
)
def test_rejects_routes_methods_and_ambiguous_headers_before_upstream(
    target: str,
    method: str,
    extra: list[tuple[str, str]],
    status: int,
) -> None:
    # Closed upstream proves these requests are rejected before any forwarding.
    with HTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler) as reserved:
        unused = reserved.server_port
    with running(PurchaseCallbackBridge(0, upstream_port=unused)) as port:
        with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
            connection.putrequest(method, target)
            for name, value in [*HEADERS.items(), ("Content-Length", str(len(BODY))), *extra]:
                connection.putheader(name, value)
            connection.endheaders(BODY)
            response = connection.getresponse()
            assert (response.status, response.read()) == (status, b"")


@pytest.mark.parametrize(
    "changes,status",
    [
        ({"Content-Length": "32769"}, 413),
        ({"Content-Length": "-1"}, 400),
        ({"Content-Length": "0"}, 400),
        ({"Content-Length": "3,3"}, 400),
        ({"Content-Length": None}, 400),
        ({"Content-Type": "text/plain"}, 415),
        ({"Authorization": None}, 400),
        ({"Authorization": "x" * 257}, 400),
        ({"X-RevenueCat-Webhook-Signature": None}, 400),
        ({"X-RevenueCat-Webhook-Signature": "x" * 129}, 400),
    ],
)
def test_rejects_unbounded_or_missing_callback_fields(
    changes: dict[str, str | None], status: int
) -> None:
    with running(PurchaseCallbackBridge(0)) as port:
        with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
            headers: dict[str, str | None] = {
                **HEADERS,
                "Content-Length": str(len(BODY)),
                **changes,
            }
            connection.putrequest("POST", CALLBACK_PATH)
            for name, value in headers.items():
                if value is not None:
                    connection.putheader(name, value)
            connection.endheaders()
            response = connection.getresponse()
            assert (response.status, response.read()) == (status, b"")


@pytest.mark.parametrize(
    "status,expected",
    [(200, 200), (400, 400), (403, 403), (429, 429), (503, 503), (302, 503), (500, 503)],
)
def test_only_fixed_empty_responses_leave_the_bridge(status: int, expected: int) -> None:
    class Origin(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            self.rfile.read(int(self.headers["Content-Length"]))
            self.send_response(status)
            self.send_header("Location", "https://example.test/generated-private")
            self.send_header("Set-Cookie", "generated-private")
            self.end_headers()
            self.wfile.write(b"generated-private-debug")

        def log_message(self, *_args: Any) -> None:
            pass

    with running(HTTPServer(("127.0.0.1", 0), Origin)) as upstream:
        with running(PurchaseCallbackBridge(0, upstream_port=upstream)) as port:
            with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
                connection.request("POST", CALLBACK_PATH, BODY, HEADERS)
                response = connection.getresponse()
                assert (response.status, response.read()) == (expected, b"")
                assert response.getheader("Location") is None
                assert response.getheader("Set-Cookie") is None


def test_upstream_outage_returns_empty_retryable_response() -> None:
    with HTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler) as reserved:
        unused = reserved.server_port
    with running(PurchaseCallbackBridge(0, upstream_port=unused)) as port:
        with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
            connection.request("POST", CALLBACK_PATH, BODY, HEADERS)
            response = connection.getresponse()
            assert (response.status, response.read()) == (503, b"")


def test_rate_limit_and_expiry() -> None:
    class Origin(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            self.rfile.read(int(self.headers["Content-Length"]))
            self.send_response(200)
            self.end_headers()

        def log_message(self, *_args: Any) -> None:
            pass

    with running(HTTPServer(("127.0.0.1", 0), Origin)) as upstream:
        bridge = PurchaseCallbackBridge(0, upstream_port=upstream)
        with running(bridge) as port:
            for _ in range(30):
                with closing(
                    http.client.HTTPConnection("127.0.0.1", port, timeout=3)
                ) as connection:
                    connection.request("POST", CALLBACK_PATH, BODY, HEADERS)
                    response = connection.getresponse()
                    assert (response.status, response.read()) == (200, b"")
            with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
                connection.request("POST", CALLBACK_PATH, BODY, HEADERS)
                response = connection.getresponse()
                assert (response.status, response.read()) == (429, b"")
            bridge.deadline = 0
            with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
                connection.request("POST", CALLBACK_PATH, BODY, HEADERS)
                response = connection.getresponse()
                assert (response.status, response.read()) == (503, b"")


def test_slow_body_is_interrupted_at_expiry_without_forwarding_or_logs(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with PurchaseCallbackBridge(0, lifetime=1) as bridge:
        worker = threading.Thread(target=bridge.serve_until_expired)
        worker.start()
        try:
            with socket.create_connection(("127.0.0.1", bridge.server_port), timeout=3) as client:
                headers = "\r\n".join(f"{k}: {v}" for k, v in HEADERS.items())
                client.sendall(
                    (
                        f"POST {CALLBACK_PATH} HTTP/1.1\r\nHost: test\r\n{headers}\r\n"
                        "Content-Length: 20\r\n\r\n"
                    ).encode()
                )
                for _ in range(30):
                    if not worker.is_alive():
                        break
                    try:
                        client.sendall(b"x")
                    except OSError:
                        break
                    time.sleep(0.05)
                worker.join(timeout=1)
                assert not worker.is_alive()
        finally:
            worker.join(timeout=3)
    assert capsys.readouterr() == ("", "")


def test_expiry_interrupts_drip_fed_upstream_response() -> None:
    received = threading.Event()

    class Origin(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            self.rfile.read(int(self.headers["Content-Length"]))
            received.set()
            try:
                self.wfile.write(b"HTTP/1.1 200 OK\r\nX-Drip: ")
                for _ in range(60):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(0.05)
            except OSError:
                pass

        def log_message(self, *_args: Any) -> None:
            pass

    with running(HTTPServer(("127.0.0.1", 0), Origin)) as upstream:
        with PurchaseCallbackBridge(0, upstream_port=upstream, lifetime=1) as bridge:
            worker = threading.Thread(target=bridge.serve_until_expired)
            worker.start()
            try:
                with closing(
                    http.client.HTTPConnection("127.0.0.1", bridge.server_port, timeout=3)
                ) as client:
                    client.request("POST", CALLBACK_PATH, BODY, HEADERS)
                    assert received.wait(timeout=1)
                    worker.join(timeout=2)
                    assert not worker.is_alive()
            finally:
                worker.join(timeout=3)

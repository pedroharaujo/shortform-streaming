from __future__ import annotations

import http.client
import socket
import threading
import time
from collections.abc import Iterator
from contextlib import closing, contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import pytest

from config.reward_callback_bridge import CALLBACK_PATH, CallbackBridge


@contextmanager
def running(server: HTTPServer) -> Iterator[int]:
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
    thread.start()
    try:
        yield server.server_port
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
        assert not thread.is_alive()


def request(port: int, path: str, method: str = "GET", **kwargs: Any) -> tuple[int, bytes]:
    with closing(http.client.HTTPConnection("127.0.0.1", port, timeout=3)) as connection:
        connection.request(method, path, **kwargs)
        response = connection.getresponse()
        assert response.getheader("Cache-Control") == "no-store"
        return response.status, response.read()


@pytest.fixture
def origin() -> Iterator[tuple[int, list[tuple[str, dict[str, str]]]]]:
    received: list[tuple[str, dict[str, str]]] = []

    class Origin(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            received.append((self.path, dict(self.headers)))
            status = 302 if "redirect" in self.path else 200
            self.send_response(status)
            self.send_header("Set-Cookie", "private-cookie")
            self.send_header("Location", "https://example.test/private")
            self.end_headers()
            self.wfile.write(b"PRIVATE DEBUG PAGE")

        def log_message(self, *_args: Any) -> None:
            pass

    with running(HTTPServer(("127.0.0.1", 0), Origin)) as port:
        yield port, received


def test_bridge_preserves_query_but_never_forwards_headers_or_private_response(
    origin: Any, capsys: pytest.CaptureFixture[str]
) -> None:
    upstream, received = origin
    raw = CALLBACK_PATH + "?item=a%2Fb%20c+z&signature=synthetic-marker&key_id=7"
    with running(CallbackBridge(0, upstream_port=upstream)) as port:
        assert request(port, raw, headers={"Authorization": "private", "Cookie": "private"}) == (
            200,
            b"",
        )
    assert received[0][0] == raw
    assert "Authorization" not in received[0][1]
    assert "Cookie" not in received[0][1]
    assert received[0][1]["Host"] == f"127.0.0.1:{upstream}"
    assert capsys.readouterr() == ("", "")


@pytest.mark.parametrize(
    "path,method,kwargs,status",
    [
        ("/admin/", "GET", {}, 404),
        ("/v1/rewards/intents", "POST", {}, 404),
        (CALLBACK_PATH + "/?x=y", "GET", {}, 404),
        ("/v1/rewards/admob/%73sv?x=y", "GET", {}, 404),
        (CALLBACK_PATH + "?x=y", "POST", {}, 405),
        (CALLBACK_PATH + "?x=y", "HEAD", {}, 405),
        (CALLBACK_PATH + "?x=y", "OPTIONS", {}, 405),
        (CALLBACK_PATH + "?x=y", "GET", {"body": "payload"}, 400),
        (CALLBACK_PATH + "?x=y", "GET", {"headers": {"Transfer-Encoding": "chunked"}}, 400),
        (CALLBACK_PATH + "?x=" + "a" * 4096, "GET", {}, 414),
        (CALLBACK_PATH + "?x=y", "GET", {"headers": {"X-Large": "a" * 9000}}, 431),
    ],
)
def test_bridge_blocks_non_callback_traffic(
    origin: Any, path: str, method: str, kwargs: Any, status: int
) -> None:
    upstream, received = origin
    with running(CallbackBridge(0, upstream_port=upstream)) as port:
        assert request(port, path, method, **kwargs) == (status, b"")
    assert received == []


def test_bridge_does_not_follow_redirect_or_return_error_details(origin: Any) -> None:
    upstream, received = origin
    with running(CallbackBridge(0, upstream_port=upstream)) as port:
        assert request(port, CALLBACK_PATH + "?redirect=true") == (503, b"")
    assert len(received) == 1


def test_bridge_fails_closed_when_origin_is_down() -> None:
    with HTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler) as reserved:
        unused_port = reserved.server_port
    with running(CallbackBridge(0, upstream_port=unused_port)) as port:
        assert request(port, CALLBACK_PATH + "?x=y") == (503, b"")


def test_bridge_enforces_rate_and_expiry_before_forwarding(origin: Any) -> None:
    upstream, received = origin
    bridge = CallbackBridge(0, upstream_port=upstream)
    with running(bridge) as port:
        for _ in range(30):
            assert request(port, CALLBACK_PATH + "?x=y") == (200, b"")
        assert request(port, CALLBACK_PATH + "?x=y") == (429, b"")
        bridge.deadline = 0
        assert request(port, CALLBACK_PATH + "?x=y") == (503, b"")
    assert len(received) == 30


@pytest.mark.parametrize(
    "target", ["//v1/rewards/admob/ssv?x=y", "http://example.test/v1/rewards/admob/ssv?x=y"]
)
def test_bridge_rejects_unnormalized_request_targets(origin: Any, target: str) -> None:
    upstream, received = origin
    with running(CallbackBridge(0, upstream_port=upstream)) as port:
        assert request(port, target) == (404, b"")
    assert not received


def test_malformed_http_response_does_not_echo_request_or_log_it(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with running(CallbackBridge(0)) as port:
        with socket.create_connection(("127.0.0.1", port), timeout=3) as connection:
            connection.sendall(b"GET /private-marker?signature=private-marker HTTP/9.9\r\n\r\n")
            response = connection.recv(8192)
    assert b"private-marker" not in response
    assert capsys.readouterr() == ("", "")


def test_expiring_server_stops_without_an_incoming_request() -> None:
    with CallbackBridge(0, lifetime=1) as bridge:
        thread = threading.Thread(target=bridge.serve_until_expired)
        thread.start()
        thread.join(timeout=3)
        assert not thread.is_alive()


def test_expiry_interrupts_a_drip_fed_upstream_response() -> None:
    class DripOrigin(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            try:
                self.wfile.write(b"HTTP/1.1 200 OK\r\nX-Drip: ")
                for _ in range(100):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(0.05)
            except OSError:
                pass

    with running(HTTPServer(("127.0.0.1", 0), DripOrigin)) as upstream:
        with CallbackBridge(0, upstream_port=upstream, lifetime=1) as bridge:
            worker = threading.Thread(target=bridge.serve_until_expired)
            worker.start()
            try:
                with socket.create_connection(
                    ("127.0.0.1", bridge.server_port), timeout=3
                ) as client:
                    client.sendall(
                        f"GET {CALLBACK_PATH}?test=1 HTTP/1.1\r\nHost: test\r\n\r\n".encode()
                    )
                    worker.join(timeout=2)
                    assert not worker.is_alive()
            finally:
                worker.join(timeout=6)

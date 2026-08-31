"""Short-lived callback-only loopback bridge; never tunnel Django directly.

Run only against a task-owned backend with a dedicated synthetic database.
Public HTTPS termination and cloud query-log controls are operator prerequisites.
This is a supervised test utility, not a production webhook server.
"""

from __future__ import annotations

import argparse
import http.client
import socket
from collections import Counter, deque
from contextlib import closing
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Timer
from time import monotonic
from typing import Any, cast

CALLBACK_PATH = "/v1/rewards/admob/ssv"


def disconnect(connection: socket.socket) -> None:
    try:
        connection.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass


class CallbackBridge(HTTPServer):
    request_queue_size = 4
    timeout = 0.5

    def __init__(self, port: int, *, upstream_port: int = 18000, lifetime: int = 3600) -> None:
        if not 1 <= lifetime <= 3600 or not 1 <= upstream_port <= 65535:
            raise ValueError("Invalid test bridge bounds.")
        self.upstream_port = upstream_port
        self.deadline = monotonic() + lifetime
        self.arrivals: deque[float] = deque()
        self.counts: Counter[int] = Counter()
        super().__init__(("127.0.0.1", port), CallbackHandler)

    def get_request(self) -> tuple[socket.socket, Any]:
        connection, address = super().get_request()
        connection.settimeout(3)
        return connection, address

    def handle_error(self, _request: Any, _client_address: Any) -> None:
        # Never print exception text, headers, query strings or request objects.
        self.counts[503] += 1

    def serve_until_expired(self) -> None:
        while monotonic() < self.deadline:
            self.handle_request()


class CallbackHandler(BaseHTTPRequestHandler):
    @property
    def bridge(self) -> CallbackBridge:
        return cast(CallbackBridge, self.server)

    def handle(self) -> None:
        # Absolute request deadline also bounds slow clients that drip headers.
        self.request_deadline = min(monotonic() + 10, self.bridge.deadline)
        timer = Timer(
            max(0.001, self.request_deadline - monotonic()), disconnect, args=(self.connection,)
        )
        timer.daemon = True
        timer.start()
        try:
            super().handle()
        finally:
            timer.cancel()

    def log_message(self, _format: str, *args: Any) -> None:
        pass

    def reply(self, status: int) -> None:
        self.bridge.counts[status] += 1
        self.close_connection = True
        self.send_response_only(status)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()

    def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
        # BaseHTTPRequestHandler errors otherwise contain attacker-supplied text.
        self.reply(code)

    def relay(self) -> None:
        now = monotonic()
        if now >= self.bridge.deadline:
            self.reply(503)
            return
        # Use the unnormalized request target, including for // and absolute URLs.
        target = self.requestline.split()[1]
        path, _, query = target.partition("?")
        if path != CALLBACK_PATH:
            self.reply(404)
            return
        if self.command != "GET":
            self.reply(405)
            return
        if len(query) > 4096:
            self.reply(414)
            return
        if len(self.headers) > 32 or sum(len(k) + len(v) for k, v in self.headers.items()) > 8192:
            self.reply(431)
            return
        if "Transfer-Encoding" in self.headers or any(
            value != "0" for value in self.headers.get_all("Content-Length", [])
        ):
            self.reply(400)
            return
        while self.bridge.arrivals and self.bridge.arrivals[0] <= now - 60:
            self.bridge.arrivals.popleft()
        if len(self.bridge.arrivals) >= 30:
            self.reply(429)
            return
        self.bridge.arrivals.append(now)
        status = 503
        try:
            # Construct a fresh request: no forwarding of cookies/auth/host/proxy headers.
            upstream_deadline = min(monotonic() + 6, self.request_deadline)
            with closing(
                http.client.HTTPConnection(
                    "127.0.0.1",
                    self.bridge.upstream_port,
                    timeout=max(0.001, upstream_deadline - monotonic()),
                )
            ) as upstream:
                upstream.connect()
                remaining = upstream_deadline - monotonic()
                if remaining <= 0 or upstream.sock is None:
                    raise OSError("Upstream deadline exceeded.")
                timer = Timer(remaining, disconnect, args=(upstream.sock,))
                timer.daemon = True
                timer.start()
                try:
                    upstream.request("GET", target, headers={"Accept": "application/json"})
                    response = upstream.getresponse()
                    if response.status in {200, 400, 503}:
                        status = response.status
                    # Never read or relay backend bodies, headers, redirects or debug pages.
                    response.close()
                finally:
                    timer.cancel()
        except (OSError, http.client.HTTPException, ValueError):
            pass
        self.reply(status)

    do_GET = relay
    do_HEAD = relay
    do_POST = relay
    do_PUT = relay
    do_PATCH = relay
    do_DELETE = relay
    do_OPTIONS = relay


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=18081)
    parser.add_argument("--upstream-port", type=int, default=18000)
    parser.add_argument("--lifetime", type=int, default=3600)
    args = parser.parse_args()
    with CallbackBridge(
        args.port, upstream_port=args.upstream_port, lifetime=args.lifetime
    ) as bridge:
        print("Callback-only test bridge started; automatic expiry enabled.", flush=True)
        try:
            bridge.serve_until_expired()
        except KeyboardInterrupt:
            pass
        finally:
            print("Bridge stopped. Aggregate status counts:", dict(bridge.counts), flush=True)


if __name__ == "__main__":
    main()

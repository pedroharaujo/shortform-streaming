"""Short-lived RevenueCat sandbox callback bridge; never tunnel Django directly.

Run with PYTHONPATH=backend and python -m config.purchase_callback_bridge.
Public HTTPS, disabled request capture, provider secrets and a supervised tunnel
are operator prerequisites. This utility starts only a loopback listener.
"""

from __future__ import annotations

import argparse
import http.client
import re
from contextlib import closing
from threading import Timer
from time import monotonic

from config.reward_callback_bridge import CallbackBridge, CallbackHandler, disconnect

CALLBACK_PATH = "/v1/purchases/revenuecat"
MAX_BODY = 32768


class PurchaseCallbackBridge(CallbackBridge):
    def __init__(self, port: int, *, upstream_port: int = 18000, lifetime: int = 3600) -> None:
        super().__init__(port, upstream_port=upstream_port, lifetime=lifetime)
        self.RequestHandlerClass = PurchaseCallbackHandler


class PurchaseCallbackHandler(CallbackHandler):
    def relay(self) -> None:
        now = monotonic()
        if now >= self.bridge.deadline:
            self.reply(503)
            return
        # Compare the raw target: no queries, normalization or alternate routes.
        if self.requestline.split()[1] != CALLBACK_PATH:
            self.reply(404)
            return
        if self.command != "POST":
            self.reply(405)
            return
        if len(self.headers) > 32 or sum(len(k) + len(v) for k, v in self.headers.items()) > 8192:
            self.reply(431)
            return
        required = (
            "Content-Length",
            "Content-Type",
            "Authorization",
            "X-RevenueCat-Webhook-Signature",
        )
        if "Transfer-Encoding" in self.headers or any(
            len(self.headers.get_all(name, [])) != 1 for name in required
        ):
            self.reply(400)
            return
        length = self.headers["Content-Length"]
        authorization = self.headers["Authorization"]
        signature = self.headers["X-RevenueCat-Webhook-Signature"]
        if (
            re.fullmatch(r"[1-9][0-9]{0,8}", length) is None
            or not 32 <= len(authorization) <= 256
            or not authorization.isascii()
            or not 1 <= len(signature) <= 128
            or not signature.isascii()
        ):
            self.reply(400)
            return
        size = int(length)
        if size > MAX_BODY:
            self.reply(413)
            return
        if self.headers["Content-Type"].partition(";")[0].strip().lower() != "application/json":
            self.reply(415)
            return
        while self.bridge.arrivals and self.bridge.arrivals[0] <= now - 60:
            self.bridge.arrivals.popleft()
        if len(self.bridge.arrivals) >= 30:
            self.reply(429)
            return
        self.bridge.arrivals.append(now)
        status = 503
        try:
            # The inherited absolute deadline also interrupts a drip-fed body.
            raw = self.rfile.read(size)
            if len(raw) != size or monotonic() >= self.request_deadline:
                self.reply(400)
                return
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
                    # Preserve signed bytes. Never forward cookies or caller routing headers.
                    upstream.request(
                        "POST",
                        CALLBACK_PATH,
                        raw,
                        {
                            "Content-Type": "application/json",
                            "Authorization": authorization,
                            "X-RevenueCat-Webhook-Signature": signature,
                        },
                    )
                    response = upstream.getresponse()
                    if response.status in {200, 400, 401, 403, 429, 503}:
                        status = response.status
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
    parser.add_argument("--port", type=int, default=18082)
    parser.add_argument("--upstream-port", type=int, default=18000)
    parser.add_argument("--lifetime", type=int, default=3600)
    args = parser.parse_args()
    with PurchaseCallbackBridge(
        args.port, upstream_port=args.upstream_port, lifetime=args.lifetime
    ) as bridge:
        print("Purchase callback test bridge started; automatic expiry enabled.", flush=True)
        try:
            bridge.serve_until_expired()
        except KeyboardInterrupt:
            pass
        finally:
            print("Bridge stopped. Aggregate status counts:", dict(bridge.counts), flush=True)


if __name__ == "__main__":
    main()

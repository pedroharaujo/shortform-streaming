from __future__ import annotations

import hashlib
import hmac
import json
import re
import time
from dataclasses import asdict, dataclass
from typing import Any

from django.conf import settings

MAX_BODY = 32768


class InvalidCallback(Exception):
    """Generic failure: never include body, headers or provider values."""


def authenticate(
    raw: bytes, authorization: str, signature: str, *, now: float | None = None
) -> None:
    expected = getattr(settings, "COIN_PURCHASE_AUTHORIZATION", "")
    secret = getattr(settings, "COIN_PURCHASE_SIGNING_SECRET", "")
    if (
        not 32 <= len(expected) <= 256
        or not 32 <= len(secret) <= 256
        or len(raw) > MAX_BODY
        or len(authorization) > 256
        or len(signature) > 128
        or not authorization.isascii()
        or not expected.isascii()
        or not hmac.compare_digest(authorization, expected)
    ):
        raise InvalidCallback
    match = re.fullmatch(r"t=([0-9]{1,12}),v1=([0-9a-f]{64})", signature)
    if match is None:
        raise InvalidCallback
    timestamp, digest = match.groups()
    computed = hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256
    ).hexdigest()
    if (
        not hmac.compare_digest(computed, digest)
        or abs((time.time() if now is None else now) - int(timestamp)) > 300
    ):
        raise InvalidCallback


def digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise InvalidCallback
        result[key] = value
    return result


@dataclass(frozen=True)
class Event:
    event_key: str
    transaction_key: str
    transaction_fingerprint: str
    app_id: str
    store: str
    environment: str
    product_id: str
    owner: str
    event_type: str
    quantity_valid: bool
    identity_valid: bool
    purchased_at_ms: int
    event_timestamp_ms: int

    @property
    def fingerprint(self) -> str:
        return digest(asdict(self))

    @property
    def claim(self) -> str:
        return digest([self.transaction_key, self.product_id, self.owner, self.purchased_at_ms])


def normalize(raw: bytes) -> Event:
    try:
        body = json.loads(
            raw,
            object_pairs_hook=_unique,
            parse_constant=lambda _: (_ for _ in ()).throw(InvalidCallback()),
        )
    except (ValueError, RecursionError, UnicodeError):
        raise InvalidCallback from None
    if not isinstance(body, dict) or body.get("api_version") != "1.0":
        raise InvalidCallback
    event = body.get("event")
    if not isinstance(event, dict):
        raise InvalidCallback
    for field in (
        "id",
        "app_id",
        "store",
        "environment",
        "product_id",
        "app_user_id",
        "type",
        "transaction_id",
    ):
        if not isinstance(event.get(field), str) or not re.fullmatch(
            r"[A-Za-z0-9_.:$/-]{1,200}", event[field]
        ):
            raise InvalidCallback
    owner = event["app_user_id"]
    aliases = event.get("aliases", [])
    quantity = event.get("quantity", 1)
    for field in ("purchased_at_ms", "event_timestamp_ms"):
        if type(event.get(field)) is not int or not 0 <= event[field] <= 253402300799999:
            raise InvalidCallback
    return Event(
        event_key=digest([event["app_id"], event["id"]]),
        transaction_key=digest(
            [event["app_id"], event["store"], event["environment"], event["transaction_id"]]
        ),
        transaction_fingerprint=digest(event["transaction_id"]),
        app_id=event["app_id"],
        store=event["store"],
        environment=event["environment"],
        product_id=event["product_id"],
        owner=owner,
        event_type=event["type"],
        quantity_valid=type(quantity) is int and quantity == 1,
        purchased_at_ms=event["purchased_at_ms"],
        event_timestamp_ms=event["event_timestamp_ms"],
        identity_valid=aliases in ([], [owner])
        and event.get("original_app_user_id", owner) == owner,
    )

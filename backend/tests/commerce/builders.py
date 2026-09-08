from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from uuid import uuid4

from django.test import Client


def registry() -> list[dict[str, Any]]:
    return [
        {
            "app_id": "synthetic_android",
            "application_id": "test.synthetic.shortform",
            "product_id": "synthetic_consumable",
            "coins": 13,
            "approval_reference": "synthetic:issue142",
            "store": "PLAY_STORE",
            "environment": "SANDBOX",
            "price_source": "store",
            "finance_owner_role": "finance",
            "synthetic": True,
            "product_type": "consumable",
        }
    ]


def configure(settings: Any) -> None:
    settings.DEBUG = True
    settings.COIN_PURCHASE_MODE = "test"
    settings.COIN_PURCHASE_PRODUCTS = registry()
    # Runtime-generated local authentication values, never provider credentials.
    settings.COIN_PURCHASE_AUTHORIZATION = uuid4().hex
    settings.COIN_PURCHASE_SIGNING_SECRET = uuid4().hex


def payload(owner: str, **changes: Any) -> bytes:
    event = {
        "id": str(uuid4()),
        "app_id": "synthetic_android",
        "product_id": "synthetic_consumable",
        "app_user_id": owner,
        "transaction_id": str(uuid4()),
        "store": "PLAY_STORE",
        "environment": "SANDBOX",
        "type": "NON_RENEWING_PURCHASE",
        "purchased_at_ms": 1700000000000,
        "event_timestamp_ms": 1700000001000,
    }
    event.update(changes)
    return json.dumps({"api_version": "1.0", "event": event}).encode()


def signature(settings: Any, raw: bytes, timestamp: int | None = None) -> str:
    stamp = str(int(time.time()) if timestamp is None else timestamp)
    signed = hmac.new(
        settings.COIN_PURCHASE_SIGNING_SECRET.encode(), stamp.encode() + b"." + raw, hashlib.sha256
    ).hexdigest()
    return f"t={stamp},v1={signed}"


def callback(client: Client, settings: Any, raw: bytes) -> Any:
    return client.post(
        "/v1/purchases/revenuecat",
        raw,
        content_type="application/json",
        HTTP_AUTHORIZATION=settings.COIN_PURCHASE_AUTHORIZATION,
        HTTP_X_REVENUECAT_WEBHOOK_SIGNATURE=signature(settings, raw),
    )

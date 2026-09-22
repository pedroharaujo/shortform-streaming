from __future__ import annotations

import hashlib
import json
import re
from http.client import HTTPSConnection
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

from django.conf import settings

from apps.commerce.configuration import Product
from apps.commerce.verification import Event, digest, normalize

TIMEOUT_SECONDS = 5
MAX_RESPONSE_BYTES = 131072
_RESOURCE_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_TRANSACTION_ID = re.compile(r"[A-Za-z0-9_.:$/-]{1,200}\Z")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Invalid provider response.")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise ValueError("Invalid provider response.")


def _is_consumable(product: dict[str, Any]) -> bool:
    one_time = product.get("one_time")
    if product.get("type") == "one_time":
        return isinstance(one_time, dict) and one_time.get("is_consumable") is True
    if product.get("type") != "consumable":
        return False
    # RevenueCat also exposes an explicit consumable type. Its alternate
    # one_time object and boolean are nullable; contradictory metadata is not.
    return one_time is None or (
        isinstance(one_time, dict)
        and "is_consumable" in one_time
        and (one_time["is_consumable"] is True or one_time["is_consumable"] is None)
    )


def _get_json(path: str, api_key: str) -> dict[str, Any] | None:
    # HTTPSConnection verifies TLS and never follows redirects. No configurable
    # base URL or response-provided pagination URL can receive this credential.
    connection = HTTPSConnection("api.revenuecat.com", timeout=TIMEOUT_SECONDS)
    try:
        connection.request(
            "GET",
            path,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )
        response = connection.getresponse()
        if response.status != 200 or (
            response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            != "application/json"
        ):
            return None
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            return None
        result = json.loads(raw, object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
        return result if isinstance(result, dict) else None
    finally:
        connection.close()


def lookup_purchase(product: Product, transaction_id: str, owner_id: str) -> Event | None:
    """Read genuine sandbox purchase facts; never write accounting or expose errors.

    The caller controls the capability gate and supplies its server-owned wallet
    identity. Unknown, unavailable and mismatched facts remain unresolved. Call
    outside database locks, then recheck the current account before fulfillment.
    """
    try:
        return _lookup_purchase(product, transaction_id, owner_id)
    except Exception:
        # Transport exceptions can contain the credential, request target or raw
        # provider data. None of those become logs, public errors or stored facts.
        return None


def _lookup_purchase(product: Product, transaction_id: str, owner_id: str) -> Event | None:
    project_id = getattr(settings, "REVENUECAT_PROJECT_ID", "")
    api_key = getattr(settings, "REVENUECAT_API_KEY", "")
    if (
        not isinstance(project_id, str)
        or _RESOURCE_ID.fullmatch(project_id) is None
        or not isinstance(api_key, str)
        or not 16 <= len(api_key) <= 512
        or not api_key.isascii()
        or not api_key.isprintable()
        or any(character.isspace() for character in api_key)
        or product.store != "PLAY_STORE"
        or product.environment != "SANDBOX"
        or product.product_type != "consumable"
        or _TRANSACTION_ID.fullmatch(transaction_id) is None
        or str(UUID(owner_id)) != owner_id
    ):
        return None

    base = f"/v2/projects/{project_id}"
    result = _get_json(
        f"{base}/purchases?{urlencode({'store_purchase_identifier': transaction_id})}", api_key
    )
    if (
        result is None
        or result.get("object") != "list"
        or "next_page" not in result
        or result["next_page"] is not None
    ):
        return None
    items = result.get("items")
    if (
        not isinstance(items, list)
        or not 1 <= len(items) <= 100
        or any(not isinstance(item, dict) for item in items)
    ):
        return None
    matches = [item for item in items if item.get("store_purchase_identifier") == transaction_id]
    if len(matches) != 1:
        return None
    purchase = matches[0]
    purchase_id = purchase.get("id")
    product_id = purchase.get("product_id")
    state = purchase.get("status")
    purchased_at = purchase.get("purchased_at")
    if (
        purchase.get("object") != "purchase"
        or not isinstance(purchase_id, str)
        or _RESOURCE_ID.fullmatch(purchase_id) is None
        or not isinstance(product_id, str)
        or _RESOURCE_ID.fullmatch(product_id) is None
        or purchase.get("customer_id") != owner_id
        or purchase.get("original_customer_id") != owner_id
        or purchase.get("environment") != "sandbox"
        or purchase.get("store") != "play_store"
        or purchase.get("ownership") != "purchased"
        or type(purchase.get("quantity")) is not int
        or purchase["quantity"] != 1
        or state not in ("owned", "refunded")
        or type(purchased_at) is not int
        or not 0 <= purchased_at <= 253402300799999
    ):
        return None

    provider_product = _get_json(f"{base}/products/{product_id}?expand=app", api_key)
    if provider_product is None:
        return None
    app = provider_product.get("app")
    if (
        provider_product.get("object") != "product"
        or provider_product.get("id") != product_id
        or provider_product.get("store_identifier") != product.product_id
        or provider_product.get("app_id") != product.app_id
        or not _is_consumable(provider_product)
        or not isinstance(app, dict)
        or app.get("object") != "app"
        or app.get("id") != product.app_id
        or app.get("type") != "play_store"
        or app.get("project_id") != project_id
    ):
        return None
    play_store = app.get("play_store")
    if not isinstance(play_store, dict) or play_store.get("package_name") != product.application_id:
        return None

    # Repeated reads of one provider state must produce the same delivery. Use
    # only the original provider purchase time, never the current request time.
    return normalize(
        json.dumps(
            {
                "api_version": "1.0",
                "event": {
                    "id": "revenuecat_sync_" + digest([project_id, purchase_id, state]),
                    "app_id": product.app_id,
                    "store": "PLAY_STORE",
                    "environment": "SANDBOX",
                    "product_id": product.product_id,
                    "app_user_id": owner_id,
                    "original_app_user_id": owner_id,
                    "aliases": [],
                    "type": "NON_RENEWING_PURCHASE" if state == "owned" else "CANCELLATION",
                    "transaction_id": transaction_id,
                    "purchased_at_ms": purchased_at,
                    "event_timestamp_ms": purchased_at,
                    "quantity": 1,
                },
            }
        ).encode()
    )


def recover_transaction_id(product: Product, fingerprint: str, owner_id: str) -> str | None:
    """Resolve only an exact known result from one complete bounded customer page.

    RevenueCat customer purchases supports limit=100 and a nullable next_page.
    Larger histories stay pending: never follow a provider-supplied URL. The
    caller must still run the full transaction/product verifier before credit.
    """
    try:
        project_id = getattr(settings, "REVENUECAT_PROJECT_ID", "")
        api_key = getattr(settings, "REVENUECAT_API_KEY", "")
        if (
            not isinstance(project_id, str)
            or _RESOURCE_ID.fullmatch(project_id) is None
            or not isinstance(api_key, str)
            or not 16 <= len(api_key) <= 512
            or not api_key.isascii()
            or not api_key.isprintable()
            or any(character.isspace() for character in api_key)
            or product.store != "PLAY_STORE"
            or product.environment != "SANDBOX"
            or product.product_type != "consumable"
            or str(UUID(owner_id)) != owner_id
            or re.fullmatch(r"[0-9a-f]{64}", fingerprint) is None
        ):
            return None
        result = _get_json(
            f"/v2/projects/{project_id}/customers/{owner_id}/purchases?environment=sandbox&limit=100",
            api_key,
        )
        if (
            result is None
            or result.get("object") != "list"
            or "next_page" not in result
            or result["next_page"] is not None
        ):
            return None
        items = result.get("items")
        if not isinstance(items, list) or len(items) > 100:
            return None
        matches: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                return None
            transaction_id = item.get("store_purchase_identifier")
            if (
                item.get("object") != "purchase"
                or item.get("customer_id") != owner_id
                or item.get("original_customer_id") != owner_id
                or item.get("environment") != "sandbox"
                or not isinstance(transaction_id, str)
                or _TRANSACTION_ID.fullmatch(transaction_id) is None
            ):
                return None
            # During project/app cutover, interrupted old-app attempts must still
            # resolve to the same provider transaction and single ledger credit.
            candidates = {
                hashlib.sha256(
                    json.dumps(
                        [
                            namespace,
                            owner_id,
                            product.application_id,
                            product.product_id,
                            transaction_id,
                        ],
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest()
                for namespace in ("stovio-purchase-v1", "shortform-purchase-v1")
            }
            if fingerprint in candidates:
                matches.append(transaction_id)
        return matches[0] if len(matches) == 1 else None
    except Exception:
        # Never disclose credentials, order identifiers, or raw provider errors.
        return None

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def parse_registry(raw: str) -> Any:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ImproperlyConfigured("Coin product registry fields must be unique.")
            result[key] = value
        return result

    if len(raw) > 32768:
        raise ImproperlyConfigured("Coin product registry is too large.")
    try:
        return json.loads(raw, object_pairs_hook=unique)
    except (ValueError, RecursionError):
        raise ImproperlyConfigured("COIN_PURCHASE_PRODUCTS must be valid registry JSON.") from None


@dataclass(frozen=True)
class Product:
    app_id: str
    application_id: str
    product_id: str
    coins: int
    approval_reference: str
    store: str = "PLAY_STORE"
    environment: str = "SANDBOX"
    price_source: str = "store"
    finance_owner_role: str = "finance"
    product_type: str = "consumable"


def load_products(value: Any, *, mode: str = "test") -> tuple[Product, ...]:
    """Separate generated fixtures from D-036 tester scope; never include prices."""
    if mode not in {"test", "revenuecat_sandbox"}:
        raise ImproperlyConfigured("Coin product registry mode is invalid.")
    if not isinstance(value, list) or not 1 <= len(value) <= 32:
        raise ImproperlyConfigured("A bounded coin product registry is required.")
    products = []
    seen: set[tuple[str, str]] = set()
    app_bindings: dict[str, str] = {}
    expected = {
        "app_id",
        "application_id",
        "product_id",
        "coins",
        "approval_reference",
        "store",
        "environment",
        "price_source",
        "finance_owner_role",
        "synthetic",
        "product_type",
    }
    for row in value:
        if (
            not isinstance(row, dict)
            or set(row) != expected
            or row["synthetic"] is not (mode == "test")
        ):
            raise ImproperlyConfigured("Coin product registry fields are invalid.")
        for field in ("app_id", "product_id", "application_id", "approval_reference"):
            if not isinstance(row[field], str) or not re.fullmatch(
                r"[A-Za-z0-9_.:/-]{1,128}", row[field]
            ):
                raise ImproperlyConfigured("Coin product registry identifiers are invalid.")
        if mode == "test":
            approved_scope = (
                row["app_id"].startswith("synthetic_")
                and row["product_id"].startswith("synthetic_")
                and row["application_id"].startswith("test.synthetic.")
                and row["approval_reference"].startswith("synthetic:")
            )
        else:
            approved_scope = bool(
                re.fullmatch(r"app[A-Za-z0-9_-]+", row["app_id"])
                and re.fullmatch(
                    r"[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+", row["application_id"]
                )
                and re.fullmatch(r"[a-z][a-z0-9_.]*", row["product_id"])
                and row["approval_reference"] == "D-036"
            )
        if (
            not approved_scope
            or row["store"] != "PLAY_STORE"
            or row["environment"] != "SANDBOX"
            or row["price_source"] != "store"
            or row["finance_owner_role"] != "finance"
            or row["product_type"] != "consumable"
            or type(row["coins"]) is not int
            or not 1 <= row["coins"] <= 2147483647
        ):
            raise ImproperlyConfigured(
                "Only approved Android sandbox consumable scope is supported."
            )
        key = (row["app_id"], row["product_id"])
        if (
            key in seen
            or app_bindings.get(row["app_id"], row["application_id"]) != row["application_id"]
            or any(
                app_id != row["app_id"] and application_id == row["application_id"]
                for app_id, application_id in app_bindings.items()
            )
        ):
            raise ImproperlyConfigured("Coin product registry scope must be unique.")
        seen.add(key)
        app_bindings[row["app_id"]] = row["application_id"]
        products.append(Product(**{key: val for key, val in row.items() if key != "synthetic"}))
    return tuple(products)


def purchases_enabled() -> bool:
    return reconciliation_enabled() or bool(
        settings.DEBUG is True
        and getattr(settings, "HOSTED_SANDBOX", False) is False
        and getattr(settings, "COIN_PURCHASE_MODE", "disabled") == "test"
    )


def reconciliation_enabled() -> bool:
    return bool(
        (settings.DEBUG is True or getattr(settings, "HOSTED_SANDBOX", False) is True)
        and getattr(settings, "COIN_PURCHASE_MODE", "disabled") == "revenuecat_sandbox"
    )


def products() -> tuple[Product, ...]:
    return load_products(
        getattr(settings, "COIN_PURCHASE_PRODUCTS", []), mode=settings.COIN_PURCHASE_MODE
    )

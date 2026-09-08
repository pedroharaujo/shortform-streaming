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


def load_products(value: Any) -> tuple[Product, ...]:
    """Only explicit synthetic scope is accepted; never include live price data."""
    if not isinstance(value, list) or not 1 <= len(value) <= 32:
        raise ImproperlyConfigured("A bounded synthetic coin product registry is required.")
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
        if not isinstance(row, dict) or set(row) != expected or row["synthetic"] is not True:
            raise ImproperlyConfigured("Coin product registry fields are invalid.")
        for field in ("app_id", "product_id", "application_id", "approval_reference"):
            if not isinstance(row[field], str) or not re.fullmatch(
                r"[A-Za-z0-9_.:/-]{1,128}", row[field]
            ):
                raise ImproperlyConfigured("Coin product registry identifiers are invalid.")
        if (
            not row["app_id"].startswith("synthetic_")
            or not row["product_id"].startswith("synthetic_")
            or not row["application_id"].startswith("test.synthetic.")
            or not row["approval_reference"].startswith("synthetic:")
            or row["store"] != "PLAY_STORE"
            or row["environment"] != "SANDBOX"
            or row["price_source"] != "store"
            or row["finance_owner_role"] != "finance"
            or row["product_type"] != "consumable"
            or type(row["coins"]) is not int
            or not 1 <= row["coins"] <= 2147483647
        ):
            raise ImproperlyConfigured("Only synthetic Android consumable scope is supported.")
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
    return bool(settings.DEBUG and getattr(settings, "COIN_PURCHASE_MODE", "disabled") == "test")


def products() -> tuple[Product, ...]:
    return load_products(getattr(settings, "COIN_PURCHASE_PRODUCTS", []))

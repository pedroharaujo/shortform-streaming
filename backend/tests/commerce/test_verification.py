from __future__ import annotations

import time
from typing import Any

import pytest
from django.core.exceptions import ImproperlyConfigured

from apps.commerce.configuration import load_products, parse_registry
from apps.commerce.verification import InvalidCallback, authenticate, normalize
from tests.commerce.builders import configure, payload, registry, signature


@pytest.mark.parametrize(
    "field,value",
    [
        ("coins", True),
        ("coins", 0),
        ("coins", 2147483648),
        ("store", "APP_STORE"),
        ("environment", "PRODUCTION"),
        ("synthetic", False),
        ("application_id", "com.actual.app"),
        ("price_source", "server"),
        ("finance_owner_role", "client"),
        ("approval_reference", "unapproved"),
        ("product_id", "actual_product"),
    ],
)
def test_registry_rejects_unapproved_scope(field: str, value: Any) -> None:
    rows = registry()
    rows[0][field] = value
    with pytest.raises(ImproperlyConfigured):
        load_products(rows)


def test_registry_is_exact_and_unique() -> None:
    assert load_products(registry())[0].coins == 13
    bad_rows: list[Any] = [[], registry() * 2, [{}], [{**registry()[0], "unknown": 1}]]
    for rows in bad_rows:
        with pytest.raises(ImproperlyConfigured):
            load_products(rows)


def test_authentication_validates_exact_bytes_and_fresh_signature(settings: Any) -> None:
    configure(settings)
    raw = payload("synthetic-owner")
    sig = signature(settings, raw)
    authenticate(raw, settings.COIN_PURCHASE_AUTHORIZATION, sig)
    for body, auth, signed in (
        (raw + b" ", settings.COIN_PURCHASE_AUTHORIZATION, sig),
        (raw, "wrong", sig),
        (raw, settings.COIN_PURCHASE_AUTHORIZATION, sig + ",v1=" + "a" * 64),
        (
            raw,
            settings.COIN_PURCHASE_AUTHORIZATION,
            signature(settings, raw, int(time.time()) - 301),
        ),
        (b"x" * 32769, settings.COIN_PURCHASE_AUTHORIZATION, sig),
        (raw, "x" * 257, sig),
    ):
        with pytest.raises(InvalidCallback):
            authenticate(body, auth, signed)


@pytest.mark.parametrize(
    "raw",
    [
        b'{"api_version":"1.0","api_version":"1.0"}',
        b'{"event":{"id":"a","id":"b"}}',
        b'{"value":NaN}',
        b"[]",
        b"null",
        b"{" * 1000,
    ],
)
def test_json_ambiguity_and_malformed_input_fail_closed(raw: bytes) -> None:
    with pytest.raises(InvalidCallback):
        normalize(raw)


def test_normalization_drops_personal_unknown_fields() -> None:
    one = normalize(payload("synthetic-owner", id="event", transaction_id="transaction"))
    two = normalize(
        payload(
            "synthetic-owner",
            id="event",
            transaction_id="transaction",
            subscriber_attributes={"private": "generated-private-marker"},
        )
    )
    assert one == two
    assert "generated-private-marker" not in repr(two)


@pytest.mark.parametrize(
    "field,value",
    [
        ("purchased_at_ms", None),
        ("purchased_at_ms", True),
        ("purchased_at_ms", -1),
        ("event_timestamp_ms", 253402300800000),
    ],
)
def test_required_transaction_timestamps_are_bounded_integers(field: str, value: Any) -> None:
    with pytest.raises(InvalidCallback):
        normalize(payload("synthetic-owner", **{field: value}))


def test_registry_rejects_non_consumable_and_ambiguous_application_binding() -> None:
    rows = registry()
    rows[0]["product_type"] = "subscription"
    with pytest.raises(ImproperlyConfigured):
        load_products(rows)
    rows = registry() + registry()
    rows[1]["app_id"] = "synthetic_second_rc_app"
    with pytest.raises(ImproperlyConfigured):
        load_products(rows)


def test_registry_json_rejects_duplicate_keys_and_size() -> None:
    for value in ('[{"coins":1,"coins":2}]', " " * 32769):
        with pytest.raises(ImproperlyConfigured):
            parse_registry(value)

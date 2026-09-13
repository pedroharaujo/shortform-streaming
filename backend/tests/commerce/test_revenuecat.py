from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import replace
from typing import Any
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import pytest

from apps.commerce import revenuecat
from apps.commerce.configuration import Product
from apps.commerce.verification import digest, normalize


@pytest.fixture
def context(settings: Any) -> tuple[Product, str, str]:
    settings.REVENUECAT_PROJECT_ID = "proj_generated"
    settings.REVENUECAT_API_KEY = uuid4().hex
    return (
        Product("app_generated", "test.generated.android", "generated_coins", 13, "test:generated"),
        "GPA.0000-0000-0000-00001",
        str(uuid4()),
    )


def records(context: tuple[Product, str, str]) -> tuple[dict[str, Any], dict[str, Any]]:
    product, transaction_id, owner_id = context
    return (
        {
            "object": "list",
            "next_page": None,
            "items": [
                {
                    "object": "purchase",
                    "id": "purch_generated",
                    "customer_id": owner_id,
                    "original_customer_id": owner_id,
                    "product_id": "prod_generated",
                    "purchased_at": 1700000000000,
                    "quantity": 1,
                    "status": "owned",
                    "environment": "sandbox",
                    "store": "play_store",
                    "ownership": "purchased",
                    "store_purchase_identifier": transaction_id,
                }
            ],
        },
        {
            "object": "product",
            "id": "prod_generated",
            "store_identifier": product.product_id,
            "type": "one_time",
            "one_time": {"is_consumable": True},
            "app_id": product.app_id,
            "app": {
                "object": "app",
                "id": product.app_id,
                "type": "play_store",
                "project_id": "proj_generated",
                "play_store": {"package_name": product.application_id},
            },
        },
    )


class Response:
    def __init__(
        self, value: Any, status: int = 200, content_type: str = "application/json"
    ) -> None:
        self.status = status
        self.content_type = content_type
        self.body = value if isinstance(value, bytes) else json.dumps(value).encode()
        self.read_sizes: list[int] = []

    def read(self, size: int) -> bytes:
        self.read_sizes.append(size)
        return self.body[:size]

    def getheader(self, name: str, default: str = "") -> str:
        return self.content_type if name.lower() == "content-type" else default


class Connections:
    def __init__(self, responses: list[Response | Exception]) -> None:
        self.responses: Iterator[Response | Exception] = iter(responses)
        self.requests: list[tuple[str, str, dict[str, str]]] = []
        self.destinations: list[tuple[str, int]] = []
        self.closed = 0

    def __call__(self, host: str, *, timeout: int) -> Connections:
        self.destinations.append((host, timeout))
        return self

    def request(self, method: str, path: str, *, headers: dict[str, str]) -> None:
        self.requests.append((method, path, headers))

    def getresponse(self) -> Response:
        item = next(self.responses)
        if isinstance(item, Exception):
            raise item
        return item

    def close(self) -> None:
        self.closed += 1


def transport(monkeypatch: pytest.MonkeyPatch, *responses: Response | Exception) -> Connections:
    connections = Connections(list(responses))
    monkeypatch.setattr(revenuecat, "HTTPSConnection", connections)
    return connections


@pytest.mark.parametrize(
    "state,event_type", [("owned", "NON_RENEWING_PURCHASE"), ("refunded", "CANCELLATION")]
)
def test_lookup_verifies_provider_purchase_and_preserves_webhook_claim(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    settings: Any,
    state: str,
    event_type: str,
) -> None:
    product, transaction_id, owner_id = context
    purchases, provider_product = records(context)
    purchases["items"][0]["status"] = state
    connections = transport(
        monkeypatch,
        Response(purchases),
        Response(provider_product),
        Response(purchases),
        Response(provider_product),
    )

    event = revenuecat.lookup_purchase(*context)
    assert event is not None
    assert event.event_type == event_type
    assert event.identity_valid and event.quantity_valid
    assert event == revenuecat.lookup_purchase(*context)
    callback = normalize(
        json.dumps(
            {
                "api_version": "1.0",
                "event": {
                    "id": "generated_callback",
                    "app_id": product.app_id,
                    "store": "PLAY_STORE",
                    "environment": "SANDBOX",
                    "product_id": product.product_id,
                    "app_user_id": owner_id,
                    "type": event_type,
                    "transaction_id": transaction_id,
                    "purchased_at_ms": 1700000000000,
                    "event_timestamp_ms": 1700000000001,
                },
            }
        ).encode()
    )
    assert event.claim == callback.claim
    assert event.transaction_key == callback.transaction_key
    assert event.event_key != callback.event_key
    assert event.transaction_fingerprint == digest(transaction_id)
    assert connections.destinations == [("api.revenuecat.com", revenuecat.TIMEOUT_SECONDS)] * 4
    assert connections.closed == 4
    method, path, headers = connections.requests[0]
    assert method == "GET"
    assert urlsplit(path).path == "/v2/projects/proj_generated/purchases"
    assert parse_qs(urlsplit(path).query) == {"store_purchase_identifier": [transaction_id]}
    assert headers["Authorization"] == f"Bearer {settings.REVENUECAT_API_KEY}"
    assert (
        connections.requests[1][1]
        == "/v2/projects/proj_generated/products/prod_generated?expand=app"
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("object", "subscription"),
        ("id", "../../foreign"),
        ("customer_id", "other"),
        ("original_customer_id", "other"),
        ("product_id", "../foreign"),
        ("purchased_at", True),
        ("purchased_at", -1),
        ("quantity", True),
        ("quantity", 2),
        ("quantity", "1"),
        ("status", "pending"),
        ("status", "unknown"),
        ("environment", "production"),
        ("store", "test_store"),
        ("ownership", "family_shared"),
        ("store_purchase_identifier", "other"),
    ],
)
def test_untrusted_purchase_facts_never_produce_an_event(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: Any,
) -> None:
    purchases, provider_product = records(context)
    purchases["items"][0][field] = value
    transport(monkeypatch, Response(purchases), Response(provider_product))
    assert revenuecat.lookup_purchase(*context) is None


@pytest.mark.parametrize(
    "change", ["empty", "duplicate", "partial", "missing_cursor", "malformed_item"]
)
def test_incomplete_or_ambiguous_search_never_produces_an_event(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    change: str,
) -> None:
    purchases, provider_product = records(context)
    if change == "empty":
        purchases["items"] = []
    elif change == "duplicate":
        purchases["items"] *= 2
    elif change == "partial":
        purchases["next_page"] = "https://generated.invalid/next"
    elif change == "missing_cursor":
        purchases.pop("next_page")
    else:
        purchases["items"].append(None)
    connections = transport(monkeypatch, Response(purchases), Response(provider_product))
    assert revenuecat.lookup_purchase(*context) is None
    assert len(connections.requests) == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("object", "app"),
        ("id", "prod_other"),
        ("store_identifier", "other_sku"),
        ("type", "subscription"),
        ("one_time", {"is_consumable": 1}),
        ("app_id", "app_other"),
        ("app", None),
    ],
)
def test_product_scope_is_verified_independently(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: Any,
) -> None:
    purchases, provider_product = records(context)
    provider_product[field] = value
    transport(monkeypatch, Response(purchases), Response(provider_product))
    assert revenuecat.lookup_purchase(*context) is None


@pytest.mark.parametrize(
    "kind,metadata,accepted",
    [
        ("consumable", None, True),
        ("consumable", {"is_consumable": True}, True),
        ("consumable", {"is_consumable": None}, True),
        ("consumable", {"is_consumable": False}, False),
        ("consumable", {"is_consumable": 1}, False),
        ("consumable", {}, False),
        ("consumable", [], False),
        ("non_consumable", {"is_consumable": True}, False),
        ("non_renewing_subscription", {"is_consumable": True}, False),
        ("one_time", None, False),
        ("one_time", {"is_consumable": None}, False),
    ],
)
def test_documented_consumable_type_accepts_nullable_metadata_but_not_conflicts(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    kind: str,
    metadata: Any,
    accepted: bool,
) -> None:
    purchases, provider_product = records(context)
    provider_product.update(type=kind, one_time=metadata)
    transport(monkeypatch, Response(purchases), Response(provider_product))
    assert (revenuecat.lookup_purchase(*context) is not None) is accepted


@pytest.mark.parametrize(
    "field,value",
    [
        ("object", "product"),
        ("id", "app_other"),
        ("type", "app_store"),
        ("project_id", "proj_other"),
        ("play_store", {"package_name": "other.package"}),
    ],
)
def test_expanded_app_binds_google_package_and_project(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: Any,
) -> None:
    purchases, provider_product = records(context)
    provider_product["app"][field] = value
    transport(monkeypatch, Response(purchases), Response(provider_product))
    assert revenuecat.lookup_purchase(*context) is None


@pytest.mark.parametrize(
    "response",
    [
        Response(b"{}", 302),
        Response(b"{}", 429),
        Response(b"{}", 500),
        Response(b"{}", content_type="text/html"),
        Response(b'{"object":"list","object":"list","items":[],"next_page":null}'),
        Response(b'{"value":NaN}'),
        Response(b"[]"),
        Response(b"{"),
        TimeoutError("generated-sensitive-error"),
    ],
)
def test_transport_and_json_failures_are_unresolved_and_never_logged(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    response: Response | Exception,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    connections = transport(monkeypatch, response)
    assert revenuecat.lookup_purchase(*context) is None
    assert len(connections.requests) == 1
    assert connections.closed == 1
    assert not caplog.records
    assert capsys.readouterr() == ("", "")


def test_response_reads_are_bounded(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = Response(b" " * (revenuecat.MAX_RESPONSE_BYTES + 2))
    transport(monkeypatch, response)
    assert revenuecat.lookup_purchase(*context) is None
    assert response.read_sizes == [revenuecat.MAX_RESPONSE_BYTES + 1]


def test_invalid_configuration_scope_or_owner_never_contacts_provider(
    context: tuple[Product, str, str],
    monkeypatch: pytest.MonkeyPatch,
    settings: Any,
) -> None:
    product, transaction_id, owner_id = context
    connections = transport(monkeypatch)
    assert (
        revenuecat.lookup_purchase(
            replace(product, environment="PRODUCTION"), transaction_id, owner_id
        )
        is None
    )
    assert revenuecat.lookup_purchase(product, transaction_id, owner_id.replace("-", "")) is None
    assert revenuecat.lookup_purchase(product, "generated\ntransaction", owner_id) is None
    settings.REVENUECAT_PROJECT_ID = "../foreign"
    assert revenuecat.lookup_purchase(*context) is None
    settings.REVENUECAT_PROJECT_ID = "proj_generated"
    settings.REVENUECAT_API_KEY = ""
    assert revenuecat.lookup_purchase(*context) is None
    assert connections.requests == []

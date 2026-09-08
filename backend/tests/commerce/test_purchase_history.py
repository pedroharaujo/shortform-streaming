from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from apps.accounts.profiles import get_or_create_profile, lock_current_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.commerce.models import (
    ApplicationBinding,
    PurchaseDecision,
    PurchaseEvent,
    PurchaseIdentity,
)
from apps.commerce.services import purchase_identity
from apps.wallet.models import CoinLedgerEntry, Wallet
from tests.commerce.builders import callback, configure, payload
from tests.test_openapi import build_schema

HISTORY = "/v1/purchases/history"
OWNER = "synthetic-history-owner"
EMPTY = {"purchases": [], "has_more": False}


@pytest.fixture(autouse=True)
def synthetic_mode(settings: Any) -> None:
    configure(settings)


def history(client: Client, uid: str = OWNER, **query: str) -> Any:
    return client.get(HISTORY, query, HTTP_AUTHORIZATION=f"Bearer {MOCK_TOKEN_PREFIX}{uid}")


def deliver(client: Client, settings: Any, uid: str = OWNER, **changes: Any) -> PurchaseIdentity:
    identity = purchase_identity(get_or_create_profile(uid))
    response = callback(client, settings, payload(str(identity.pk), **changes))
    assert response.status_code == 200
    return identity


@pytest.mark.django_db
def test_empty_history_never_creates_financial_state(client: Client) -> None:
    get_or_create_profile(OWNER)
    with CaptureQueriesContext(connection) as queries:
        response = history(client)
    assert response.status_code == 200
    assert response.json() == EMPTY
    assert response["Cache-Control"] == "no-store"
    assert not any(
        query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
        for query in queries
    )
    for model in (Wallet, PurchaseIdentity, PurchaseDecision, PurchaseEvent, ApplicationBinding):
        assert not model.objects.exists()


@pytest.mark.django_db
def test_history_only_exposes_owned_verified_credit_without_financial_writes(
    client: Client, settings: Any
) -> None:
    identity = deliver(client, settings, transaction_id="synthetic-private-transaction")
    decision = PurchaseDecision.objects.get()
    deliver(client, settings, uid="synthetic-history-other")
    deliver(client, settings, type="PENDING")
    deliver(client, settings, app_user_id=str(uuid4()))
    before = {
        model: list(model.objects.order_by("pk").values())
        for model in (Wallet, PurchaseIdentity, PurchaseDecision, PurchaseEvent, CoinLedgerEntry)
    }
    with CaptureQueriesContext(connection) as queries:
        response = history(client)
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert response.json() == {
        "purchases": [
            {
                "recorded_at": decision.created_at.isoformat().replace("+00:00", "Z"),
                "historical_credited_coins": 13,
                "support_reference": str(decision.pk),
                "status": "credited",
            }
        ],
        "has_more": False,
    }
    assert not any(
        query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
        for query in queries
    )
    for model, original in before.items():
        assert list(model.objects.order_by("pk").values()) == original
    for private in (str(identity.pk), OWNER, "synthetic-private-transaction", "product_id"):
        assert private not in response.content.decode()


@pytest.mark.django_db
def test_history_preserves_original_credit_after_spending_and_registry_drift(
    client: Client, settings: Any
) -> None:
    identity = deliver(client, settings)
    original = history(client).json()
    CoinLedgerEntry.objects.create(
        wallet=identity.wallet, reference=uuid4(), kind="unlock", amount=-7
    )
    settings.COIN_PURCHASE_PRODUCTS[0].update(
        coins=99, product_id="synthetic_replaced", application_id="test.synthetic.replaced"
    )
    assert history(client).json() == original
    settings.COIN_PURCHASE_PRODUCTS = []
    assert history(client).json() == original


@pytest.mark.django_db
@pytest.mark.parametrize("event_type", ["CANCELLATION", "REFUND", "PENDING"])
def test_history_keeps_quarantined_credit_in_review_after_successful_retry(
    client: Client, settings: Any, event_type: str
) -> None:
    transaction_id = "synthetic-review-history"
    deliver(client, settings, transaction_id=transaction_id)
    deliver(client, settings, transaction_id=transaction_id, type=event_type)
    deliver(client, settings, transaction_id=transaction_id)
    result = history(client).json()
    assert len(result["purchases"]) == 1
    assert result["purchases"][0]["status"] == "review_required"
    assert result["purchases"][0]["historical_credited_coins"] == 13
    assert CoinLedgerEntry.objects.get().amount == 13


@pytest.mark.django_db
@pytest.mark.parametrize("count", [20, 23])
def test_history_bounds_rows_and_orders_by_recorded_time_then_uuid(
    client: Client, settings: Any, count: int
) -> None:
    timestamp = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(count):
        # Set synthetic creation values before insert; production history is immutable.
        recorded_at = timestamp + timedelta(seconds=1 if index == 0 else 0)
        with (
            patch("django.utils.timezone.now", return_value=recorded_at),
            patch.object(PurchaseDecision._meta.get_field("id"), "default", UUID(int=index + 1)),
        ):
            deliver(client, settings)
    expected = list(
        PurchaseDecision.objects.order_by("-created_at", "-id").values_list("pk", flat=True)
    )[:20]
    with CaptureQueriesContext(connection) as queries:
        response = history(client)
    assert response.status_code == 200
    result = response.json()
    assert [row["support_reference"] for row in result["purchases"]] == list(map(str, expected))
    assert result["has_more"] is (count > 20)
    decision_queries = [
        query["sql"] for query in queries if 'FROM "commerce_purchasedecision"' in query["sql"]
    ]
    assert len(decision_queries) == 1
    assert "LIMIT 21" in decision_queries[0]
    assert "EXISTS" in decision_queries[0]


@pytest.mark.django_db
def test_deleted_recreated_account_cannot_adopt_history(client: Client, settings: Any) -> None:
    identity = deliver(client, settings)
    profile = identity.wallet.user_profile
    assert profile is not None
    profile.delete()
    assert history(client).json() == EMPTY
    assert CoinLedgerEntry.objects.get().amount == 13


@pytest.mark.django_db
def test_history_rejects_profile_deleted_after_authentication(
    client: Client, settings: Any
) -> None:
    deliver(client, settings)

    def delete_before_read(profile: Any) -> Any:
        profile.delete()
        return lock_current_profile(profile)

    with patch("apps.commerce.reads.lock_current_profile", side_effect=delete_before_read):
        assert history(client).status_code == 401
    assert CoinLedgerEntry.objects.get().amount == 13


@pytest.mark.django_db
def test_history_requires_authentication_and_app_check(client: Client, settings: Any) -> None:
    assert client.get(HISTORY).status_code == 401
    settings.FIREBASE_APP_CHECK_MODE = "enforce"
    settings.FIREBASE_APP_CHECK_APP_ID = "synthetic-android-app"
    assert history(client).status_code == 401
    assert not Wallet.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("debug,mode", [(True, "disabled"), (False, "test")])
def test_history_fails_closed_outside_synthetic_mode(
    client: Client, settings: Any, debug: bool, mode: str
) -> None:
    settings.DEBUG, settings.COIN_PURCHASE_MODE = debug, mode
    assert history(client).status_code == 409
    assert not Wallet.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "field", ["owner", "transaction_id", "product_id", "application_id", "cursor"]
)
def test_history_rejects_query_fields_without_reflection(client: Client, field: str) -> None:
    response = history(client, **{field: "synthetic-private-query-value"})
    assert response.status_code == 400
    assert "synthetic-private-query-value" not in response.content.decode()
    assert not PurchaseDecision.objects.exists()


def test_history_schema_declares_bounded_safe_output_and_security() -> None:
    schema = build_schema()
    operation = schema["paths"][HISTORY]["get"]
    assert operation["security"] == [{"FirebaseAppCheck": [], "FirebaseIdToken": []}]
    assert {"200", "400", "401", "409"} <= operation["responses"].keys()
    assert "requestBody" not in operation
    schemas = schema["components"]["schemas"]
    response = schemas["PurchaseHistory"]
    assert set(response["required"]) == {"purchases", "has_more"}
    assert response["properties"]["purchases"]["maxItems"] == 20
    item = schemas["PurchaseHistoryItem"]
    assert set(item["required"]) == {
        "recorded_at",
        "historical_credited_coins",
        "support_reference",
        "status",
    }
    assert set(item["properties"]) == set(item["required"])
    assert item["properties"]["historical_credited_coins"]["minimum"] == 1
    assert item["properties"]["historical_credited_coins"]["maximum"] == 2147483647
    assert item["properties"]["recorded_at"]["format"] == "date-time"
    assert item["properties"]["support_reference"]["format"] == "uuid"

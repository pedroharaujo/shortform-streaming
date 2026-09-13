from __future__ import annotations

import hashlib
import json
from typing import Any
from unittest.mock import patch

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.profiles import get_or_create_profile
from apps.commerce.configuration import products
from apps.commerce.models import PurchaseEvent
from apps.commerce.services import purchase_identity
from apps.wallet.models import CoinLedgerEntry, Wallet
from tests.commerce.test_purchase_sync import WAITING, post
from tests.commerce.test_reconciliation import QUERY, UID, identity
from tests.commerce.test_reconciliation import sandbox_mode as sandbox_mode
from tests.commerce.test_revenuecat import Response, records, transport

RECOVER = "/v1/purchases/recover"
pytestmark = pytest.mark.usefixtures("sandbox_mode")


def query(owner: str) -> dict[str, str]:
    return {
        "application_id": QUERY["application_id"],
        "product_id": QUERY["product_id"],
        "transaction_fingerprint": hashlib.sha256(
            json.dumps(
                [
                    "shortform-purchase-v1",
                    owner,
                    QUERY["application_id"],
                    QUERY["product_id"],
                    QUERY["transaction_id"],
                ],
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest(),
    }


@pytest.mark.django_db
def test_exact_recovery_reuses_verification_and_credit_once_then_preserves_review(
    client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = identity()
    purchases, product = records((products()[0], QUERY["transaction_id"], str(owner.pk)))
    for state in ("owned", "owned", "refunded", "owned"):
        purchases["items"][0]["status"] = state
        connections = transport(
            monkeypatch, Response(purchases), Response(purchases), Response(product)
        )
        result = post(client, RECOVER, query(str(owner.pk)), UID)
        assert result.status_code == 200
        assert result["Cache-Control"] == "no-store"
        assert result.json()["status"] == (
            "review_required"
            if PurchaseEvent.objects.filter(status="quarantined").exists()
            else "credited"
        )
        assert result.json()["historical_credited_coins"] == 13
        assert QUERY["transaction_id"] not in result.content.decode()
        assert (
            connections.requests[0][1]
            == f"/v2/projects/proj_generated/customers/{owner.pk}/purchases"
            "?environment=sandbox&limit=100"
        )
    assert CoinLedgerEntry.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "change",
    [
        "empty",
        "duplicate",
        "partial",
        "missing_cursor",
        "oversized",
        "malformed",
        "foreign",
        "production",
        "wrong_product",
        "wrong_hash",
    ],
)
def test_unresolved_recovery_never_mutates_financial_state(
    client: Client,
    monkeypatch: pytest.MonkeyPatch,
    change: str,
) -> None:
    owner = identity()
    purchases, product = records((products()[0], QUERY["transaction_id"], str(owner.pk)))
    body = query(str(owner.pk))
    if change == "empty":
        purchases["items"] = []
    elif change == "duplicate":
        purchases["items"] *= 2
    elif change == "partial":
        purchases["next_page"] = "https://generated.invalid/credential-theft"
    elif change == "missing_cursor":
        purchases.pop("next_page")
    elif change == "oversized":
        purchases["items"] *= 101
    elif change == "malformed":
        purchases["items"].append({"store_purchase_identifier": None})
    elif change == "foreign":
        purchases["items"][0]["customer_id"] = "foreign"
    elif change == "production":
        purchases["items"][0]["environment"] = "production"
    elif change == "wrong_product":
        product["store_identifier"] = "another_product"
    else:
        body["transaction_fingerprint"] = "0" * 64
    connections = transport(
        monkeypatch, Response(purchases), Response(purchases), Response(product)
    )
    assert post(client, RECOVER, body, UID).json() == WAITING
    assert not CoinLedgerEntry.objects.exists()
    assert not PurchaseEvent.objects.exists()
    assert all(host == "api.revenuecat.com" for host, _ in connections.destinations)
    if change != "wrong_product":
        assert len(connections.requests) == 1


@pytest.mark.django_db
def test_recovery_rejects_untrusted_requests_and_owner_substitution(client: Client) -> None:
    owner = identity()
    body = query(str(owner.pk))
    with patch("apps.commerce.revenuecat._get_json") as lookup:
        assert client.post(RECOVER, body, content_type="application/json").status_code == 401
        for field in ("owner_id", "transaction_id", "coins"):
            assert post(client, RECOVER, {**body, field: "untrusted"}, UID).status_code == 400
        assert (
            post(client, RECOVER, {**body, "transaction_fingerprint": "A" * 64}, UID).status_code
            == 400
        )
        assert post(client, RECOVER + "?owner_id=foreign", body, UID).status_code == 400
        lookup.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_deletion_during_recovery_provider_read_cannot_credit(client: Client) -> None:
    owner = identity()
    purchases, _ = records((products()[0], QUERY["transaction_id"], str(owner.pk)))

    def deleted(*args: object) -> dict[str, Any]:
        UserProfile.objects.filter(firebase_uid=UID).delete()
        return purchases

    with patch("apps.commerce.revenuecat._get_json", side_effect=deleted):
        assert post(client, RECOVER, query(str(owner.pk)), UID).status_code == 401
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("mode", ["disabled", "test"])
def test_recovery_requires_explicit_sandbox(client: Client, settings: Any, mode: str) -> None:
    body = query(str(identity().pk))
    settings.COIN_PURCHASE_MODE = mode
    with patch("apps.commerce.revenuecat._get_json") as lookup:
        assert post(client, RECOVER, body, UID).status_code == 409
        lookup.assert_not_called()


@pytest.mark.django_db
def test_recovery_without_identity_creates_nothing(client: Client) -> None:
    with patch("apps.commerce.revenuecat._get_json") as lookup:
        assert (
            post(client, RECOVER, query("00000000-0000-0000-0000-000000000000"), UID).json()
            == WAITING
        )
        lookup.assert_not_called()
    assert not Wallet.objects.exists()


@pytest.mark.django_db
def test_foreign_callers_cannot_use_an_owners_fingerprint(
    client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = identity()
    foreign = purchase_identity(get_or_create_profile("generated-other-recovery"))
    purchases, product = records((products()[0], QUERY["transaction_id"], str(owner.pk)))
    connections = transport(monkeypatch, Response(purchases), Response(product))
    assert post(client, RECOVER, query(str(owner.pk)), "generated-other-recovery").json() == WAITING
    assert f"/customers/{foreign.pk}/" in connections.requests[0][1]
    assert len(connections.requests) == 1
    assert not CoinLedgerEntry.objects.exists()
    assert not PurchaseEvent.objects.exists()


@pytest.mark.django_db
def test_recovery_and_sync_share_rate_limit(client: Client) -> None:
    owner = identity()
    with patch("apps.commerce.revenuecat._get_json", return_value=None) as lookup:
        for _ in range(3):
            assert post(client, RECOVER, query(str(owner.pk)), UID).json() == WAITING
            assert post(client, "/v1/purchases/sync", QUERY, UID).json() == WAITING
        assert post(client, RECOVER, query(str(owner.pk)), UID).status_code == 429
        assert lookup.call_count == 6

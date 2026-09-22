from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.db import close_old_connections, connection
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.profiles import get_or_create_profile
from apps.commerce.configuration import products
from apps.commerce.models import PurchaseDecision, PurchaseEvent, PurchaseIdentity
from apps.commerce.services import fulfill, purchase_identity
from apps.commerce.verification import Event, normalize
from apps.wallet.models import CoinLedgerEntry, Wallet
from tests.commerce.builders import callback, configure, payload, sandbox_registry
from tests.commerce.test_purchase_sync import WAITING, post
from tests.commerce.test_revenuecat import Response, records, transport

SYNC = "/v1/purchases/sync"
QUERY = {
    "application_id": "test.example.stovio",
    "product_id": "generated_test_coins",
    "transaction_id": "GPA.0000-0000-0000-00001",
}
UID = "generated-reconciliation-owner"


@pytest.fixture(autouse=True)
def sandbox_mode(settings: Any) -> None:
    configure(settings)
    settings.COIN_PURCHASE_MODE = "revenuecat_sandbox"
    settings.COIN_PURCHASE_PRODUCTS = sandbox_registry()
    settings.REVENUECAT_PROJECT_ID = "proj_generated"
    settings.REVENUECAT_API_KEY = uuid4().hex
    cache.clear()


def identity() -> PurchaseIdentity:
    return purchase_identity(get_or_create_profile(UID))


def event(owner: PurchaseIdentity, **changes: Any) -> Event:
    return normalize(
        payload(
            str(owner.pk),
            id="generated-reconciliation-event",
            app_id="appGenerated",
            product_id=QUERY["product_id"],
            transaction_id=QUERY["transaction_id"],
            **changes,
        )
    )


@pytest.mark.django_db
def test_sync_uses_existing_identity_then_credits_exactly_once(client: Client) -> None:
    with patch("apps.commerce.reconciliation.lookup_purchase") as lookup:
        assert post(client, SYNC, QUERY, UID).json() == WAITING
        lookup.assert_not_called()
        assert not Wallet.objects.exists()
        owner = identity()
        lookup.return_value = event(owner)
        first = post(client, SYNC, QUERY, UID)
        assert first.status_code == 200
        assert first["Cache-Control"] == "no-store"
        assert first.json()["status"] == "credited"
        assert first.json()["historical_credited_coins"] == 13
        assert post(client, SYNC, QUERY, UID).json() == first.json()
        assert lookup.call_args.args[1:] == (QUERY["transaction_id"], str(owner.pk))
        # Same trusted transaction arriving through the callback normalizer cannot credit twice.
        fulfill(replace(event(owner), event_key="b" * 64, event_timestamp_ms=1700000001001))
    assert CoinLedgerEntry.objects.get().amount == 13
    assert PurchaseDecision.objects.count() == 1
    assert PurchaseEvent.objects.count() == 2


@pytest.mark.django_db
def test_missing_provider_result_can_be_retried_and_status_remains_read_only(
    client: Client,
) -> None:
    owner = identity()
    with patch("apps.commerce.reconciliation.lookup_purchase", side_effect=[None, event(owner)]):
        assert post(client, SYNC, QUERY, UID).json() == WAITING
        assert not PurchaseDecision.objects.exists()
        assert post(client, SYNC, QUERY, UID).json()["status"] == "credited"
    with patch("apps.commerce.reconciliation.lookup_purchase") as lookup:
        assert post(client, "/v1/purchases/status", QUERY, UID).json()["status"] == "credited"
        lookup.assert_not_called()


@pytest.mark.django_db
def test_owned_credit_stays_in_review_after_refund_and_successful_retry(client: Client) -> None:
    owner = identity()
    original = event(owner)
    refund = replace(original, event_type="CANCELLATION", event_key="c" * 64)
    with patch(
        "apps.commerce.reconciliation.lookup_purchase", side_effect=[original, refund, original]
    ):
        assert post(client, SYNC, QUERY, UID).json()["status"] == "credited"
        assert post(client, SYNC, QUERY, UID).json()["status"] == "review_required"
        assert post(client, SYNC, QUERY, UID).json()["status"] == "review_required"
    assert CoinLedgerEntry.objects.count() == 1


@pytest.mark.django_db
def test_refunded_purchase_never_credits_even_after_later_owned_result(client: Client) -> None:
    owner = identity()
    original = event(owner)
    refund = replace(original, event_type="CANCELLATION", event_key="c" * 64)
    with patch("apps.commerce.reconciliation.lookup_purchase", side_effect=[refund, original]):
        assert post(client, SYNC, QUERY, UID).json() == WAITING
        assert post(client, SYNC, QUERY, UID).json() == WAITING
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_account_deleted_during_provider_read_cannot_receive_credit(client: Client) -> None:
    owner = identity()
    result = event(owner)

    def delete_during_read(*args: object) -> Event:
        assert not connection.in_atomic_block
        UserProfile.objects.filter(firebase_uid=UID).delete()
        return result

    with patch("apps.commerce.reconciliation.lookup_purchase", side_effect=delete_during_read):
        assert post(client, SYNC, QUERY, UID).status_code == 401
    assert not CoinLedgerEntry.objects.exists()
    replacement = identity()
    assert replacement.pk != owner.pk
    with patch("apps.commerce.reconciliation.lookup_purchase", return_value=None):
        assert post(client, SYNC, QUERY, UID).json() == WAITING


@pytest.mark.django_db(transaction=True)
def test_concurrent_sync_and_callback_fulfillment_share_one_credit(client: Client) -> None:
    owner = identity()
    original = event(owner)
    barrier = Barrier(2)

    def lookup(*args: object) -> Event:
        assert not connection.in_atomic_block
        barrier.wait(timeout=10)
        return original

    def deliver_callback() -> None:
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            fulfill(replace(original, event_key="d" * 64))
        finally:
            close_old_connections()

    with patch("apps.commerce.reconciliation.lookup_purchase", side_effect=lookup):
        with ThreadPoolExecutor(max_workers=1) as pool:
            delivery = pool.submit(deliver_callback)
            assert post(client, SYNC, QUERY, UID).json()["status"] == "credited"
            delivery.result(timeout=15)
    assert CoinLedgerEntry.objects.count() == PurchaseDecision.objects.count() == 1


@pytest.mark.django_db
def test_sync_rejects_untrusted_fields_unknown_scope_and_unauthenticated_requests(
    client: Client,
) -> None:
    with patch("apps.commerce.reconciliation.lookup_purchase") as lookup:
        assert client.post(SYNC, QUERY, content_type="application/json").status_code == 401
        for field in ("coins", "owner_id", "environment", "provider_result"):
            assert post(client, SYNC, {**QUERY, field: "untrusted"}, UID).status_code == 400
        assert post(client, SYNC + "?transaction_id=untrusted", QUERY, UID).status_code == 400
        assert post(client, SYNC, {**QUERY, "product_id": "unknown"}, UID).status_code == 409
        lookup.assert_not_called()
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("debug", "mode"), [(False, "revenuecat_sandbox"), (True, "disabled"), (True, "test")]
)
def test_sync_disabled_outside_explicit_local_sandbox(
    client: Client, settings: Any, debug: bool, mode: str
) -> None:
    settings.DEBUG, settings.COIN_PURCHASE_MODE = debug, mode
    with patch("apps.commerce.reconciliation.lookup_purchase") as lookup:
        assert post(client, SYNC, QUERY, UID).status_code in (401, 409)
        lookup.assert_not_called()


@pytest.mark.django_db
def test_simulated_callback_is_disabled_for_genuine_sandbox_products(
    client: Client, settings: Any
) -> None:
    owner = identity()
    assert callback(client, settings, payload(str(owner.pk))).status_code == 409
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
def test_sync_throttles_provider_work_per_account(client: Client) -> None:
    identity()
    with patch("apps.commerce.reconciliation.lookup_purchase", return_value=None) as lookup:
        for _ in range(6):
            assert post(client, SYNC, QUERY, UID).status_code == 200
        assert post(client, SYNC, QUERY, UID).status_code == 429
        assert lookup.call_count == 6


@pytest.mark.django_db
def test_foreign_lookup_cannot_quarantine_owners_real_verification_path(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = identity()
    purchase_identity(get_or_create_profile("generated-foreign-account"))
    purchases, product = records((products()[0], QUERY["transaction_id"], str(owner.pk)))
    transport(monkeypatch, Response(purchases), Response(purchases), Response(product))
    assert post(client, SYNC, QUERY, "generated-foreign-account").json() == WAITING
    assert not PurchaseDecision.objects.exists()
    assert not PurchaseEvent.objects.exists()
    result = post(client, SYNC, QUERY, UID)
    assert result.status_code == 200
    assert result.json()["status"] == "credited"
    assert CoinLedgerEntry.objects.get().wallet_id == owner.wallet_id


@pytest.mark.django_db
@pytest.mark.parametrize("refunded", [False, True])
def test_provider_failure_preserves_historical_credit_and_review(
    client: Client, refunded: bool
) -> None:
    owner = identity()
    original = event(owner)
    fulfill(original)
    if refunded:
        fulfill(replace(original, event_type="CANCELLATION", event_key="e" * 64))
    count = PurchaseEvent.objects.count()
    with patch("apps.commerce.reconciliation.lookup_purchase", return_value=None):
        result = post(client, SYNC, QUERY, UID).json()
    assert result["status"] == ("review_required" if refunded else "credited")
    assert result["historical_credited_coins"] == 13
    assert PurchaseEvent.objects.count() == count
    assert CoinLedgerEntry.objects.count() == 1

from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from typing import Any
from unittest.mock import patch

import pytest
from django.db import close_old_connections, connection
from django.test import Client

from apps.accounts.models import UserProfile
from apps.commerce.configuration import products
from apps.commerce.models import PurchaseEvent
from apps.commerce.reconciliation import synchronize_purchase
from apps.commerce.verification import normalize
from apps.wallet.models import CoinLedgerEntry
from tests.commerce.builders import callback, payload, signature
from tests.commerce.test_reconciliation import QUERY, UID, identity
from tests.commerce.test_reconciliation import sandbox_mode as sandbox_mode
from tests.commerce.test_revenuecat import Response, records, transport

pytestmark = pytest.mark.usefixtures("sandbox_mode")


@pytest.fixture(autouse=True, params=[False, True], ids=["local", "hosted"])
def notification_runtime(settings: Any, sandbox_mode: None, request: pytest.FixtureRequest) -> None:
    settings.HOSTED_SANDBOX = request.param
    settings.DEBUG = not request.param
    if request.param:
        settings.ROOT_URLCONF = "config.consumer_urls"


def notification(owner: str, **changes: Any) -> bytes:
    return payload(
        owner,
        app_id="appGenerated",
        product_id=QUERY["product_id"],
        transaction_id=QUERY["transaction_id"],
        **changes,
    )


@pytest.mark.django_db
def test_notification_verifies_fresh_facts_but_preserves_original_event(
    client: Client,
    settings: Any,
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = notification(str(identity().pk), id="generated-notification")
    original = normalize(raw)
    verified = replace(original, event_key="a" * 64, event_timestamp_ms=original.purchased_at_ms)
    with patch("apps.commerce.notifications.lookup_purchase", return_value=verified) as lookup:
        assert callback(client, settings, raw).status_code == 200
        assert callback(client, settings, raw).status_code == 200
    assert lookup.call_count == 2
    assert CoinLedgerEntry.objects.get().amount == 13
    assert PurchaseEvent.objects.get().event_key == original.event_key


@pytest.mark.django_db
def test_positive_outage_is_retryable_without_financial_state(
    client: Client, settings: Any
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = notification(str(identity().pk))
    with patch("apps.commerce.notifications.lookup_purchase", return_value=None):
        result = callback(client, settings, raw)
    assert result.status_code == 503
    assert not PurchaseEvent.objects.exists()
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("refund_first", [False, True])
def test_signed_cancellation_is_a_barrier_despite_outage_or_stale_positive(
    client: Client,
    settings: Any,
    refund_first: bool,
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    owner = str(identity().pk)
    raw = notification(owner)
    refund = notification(owner, type="CANCELLATION")
    with patch(
        "apps.commerce.notifications.lookup_purchase", return_value=normalize(raw)
    ) as lookup:
        if not refund_first:
            assert callback(client, settings, raw).status_code == 200
        before = lookup.call_count
        assert callback(client, settings, refund).status_code == 200
        assert lookup.call_count == before
        assert callback(client, settings, raw).status_code == 200
    assert CoinLedgerEntry.objects.count() == (0 if refund_first else 1)
    assert PurchaseEvent.objects.filter(status="quarantined").exists()


@pytest.mark.django_db
def test_refunded_provider_evidence_never_credits(client: Client, settings: Any) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = notification(str(identity().pk))
    with patch(
        "apps.commerce.notifications.lookup_purchase",
        return_value=replace(normalize(raw), event_type="CANCELLATION"),
    ):
        assert callback(client, settings, raw).status_code == 200
    assert not CoinLedgerEntry.objects.exists()
    assert PurchaseEvent.objects.get().status == "quarantined"


@pytest.mark.django_db
@pytest.mark.parametrize("event_type", ["TEST", "TRANSFER", "SUBSCRIPTION_PAUSED"])
def test_unsupported_notifications_are_ignored_without_provider_or_financial_mutation(
    client: Client,
    settings: Any,
    event_type: str,
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = json.dumps({"api_version": "1.0", "event": {"type": event_type}}).encode()
    with patch("apps.commerce.notifications.lookup_purchase") as lookup:
        assert callback(client, settings, raw).status_code == 200
        lookup.assert_not_called()
    assert not PurchaseEvent.objects.exists()
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
def test_notification_uses_full_provider_transport_and_drops_private_fields(
    client: Client,
    settings: Any,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    owner = identity()
    purchases, product = records((products()[0], QUERY["transaction_id"], str(owner.pk)))
    connections = transport(monkeypatch, Response(purchases), Response(product))
    raw = notification(
        str(owner.pk), subscriber_attributes={"private": "generated-sensitive-marker"}
    )
    result = callback(client, settings, raw)
    assert result.status_code == 200
    assert CoinLedgerEntry.objects.get().amount == 13
    assert len(connections.requests) == 2
    assert "generated-sensitive-marker" not in caplog.text + result.content.decode()
    assert QUERY["transaction_id"] not in caplog.text + result.content.decode()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "field,value",
    [
        ("owner", "foreign"),
        ("purchased_at_ms", 1),
        ("transaction_key", "a" * 64),
        ("product_id", "wrong"),
        ("identity_valid", False),
        ("quantity_valid", False),
    ],
)
def test_positive_provider_mismatch_is_retryable_without_credit(
    client: Client,
    settings: Any,
    field: str,
    value: Any,
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = notification(str(identity().pk))
    with patch(
        "apps.commerce.notifications.lookup_purchase",
        return_value=replace(normalize(raw), **{field: value}),
    ):
        assert callback(client, settings, raw).status_code == 503
    assert not PurchaseEvent.objects.exists()
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "changes",
    [
        {"aliases": ["foreign"]},
        {"original_app_user_id": "foreign"},
        {"quantity": 2},
        {"environment": "PRODUCTION"},
        {"store": "APP_STORE"},
        {"product_id": "unknown"},
        {"app_id": "unknown"},
    ],
)
def test_invalid_notification_scope_or_identity_is_quarantined_before_provider(
    client: Client,
    settings: Any,
    changes: dict[str, Any],
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    fields = {
        "app_id": "appGenerated",
        "product_id": QUERY["product_id"],
        "transaction_id": QUERY["transaction_id"],
        **changes,
    }
    raw = payload(str(identity().pk), **fields)
    with patch("apps.commerce.notifications.lookup_purchase") as lookup:
        assert callback(client, settings, raw).status_code == 200
        lookup.assert_not_called()
    assert PurchaseEvent.objects.get().status == "quarantined"
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
def test_original_delivery_id_conflict_remains_detectable(client: Client, settings: Any) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    owner = str(identity().pk)
    for timestamp in (1700000001000, 1700000002000):
        raw = notification(owner, id="same-generated-delivery", event_timestamp_ms=timestamp)
        with patch("apps.commerce.notifications.lookup_purchase", return_value=normalize(raw)):
            assert callback(client, settings, raw).status_code == 200
    assert CoinLedgerEntry.objects.count() == 1
    assert PurchaseEvent.objects.filter(reason="event_conflict").exists()


@pytest.mark.django_db(transaction=True)
def test_deleted_owner_during_provider_read_cannot_credit(client: Client, settings: Any) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = notification(str(identity().pk))

    def deleted(*args: object) -> Any:
        assert not connection.in_atomic_block
        UserProfile.objects.filter(firebase_uid=UID).delete()
        return normalize(raw)

    with patch("apps.commerce.notifications.lookup_purchase", side_effect=deleted):
        assert callback(client, settings, raw).status_code == 200
    assert not CoinLedgerEntry.objects.exists()
    assert PurchaseEvent.objects.get().reason == "unknown_or_deleted_owner"


@pytest.mark.django_db(transaction=True)
def test_concurrent_notification_duplicate_and_sync_share_one_credit(
    client: Client,
    settings: Any,
) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    owner = identity()
    raw = notification(str(owner.pk))
    original = normalize(raw)
    barrier = Barrier(3)

    def lookup(*args: object) -> Any:
        assert not connection.in_atomic_block
        barrier.wait(timeout=10)
        return original

    def deliver(sync: bool) -> None:
        close_old_connections()
        try:
            if sync:
                profile = UserProfile.objects.get(firebase_uid=UID)
                assert synchronize_purchase(profile, **QUERY)["status"] == "credited"
            else:
                assert callback(Client(), settings, raw).status_code == 200
        finally:
            close_old_connections()

    with (
        patch("apps.commerce.notifications.lookup_purchase", side_effect=lookup),
        patch("apps.commerce.reconciliation.lookup_purchase", side_effect=lookup),
        ThreadPoolExecutor(max_workers=2) as pool,
    ):
        duplicate = pool.submit(deliver, False)
        sync = pool.submit(deliver, True)
        assert callback(client, settings, raw).status_code == 200
        duplicate.result(timeout=15)
        sync.result(timeout=15)
    assert CoinLedgerEntry.objects.count() == 1


@pytest.mark.django_db
def test_authentication_and_strict_body_fail_before_provider(client: Client, settings: Any) -> None:
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = True
    raw = notification(str(identity().pk))
    path = "/v1/purchases/revenuecat"
    with patch("apps.commerce.notifications.lookup_purchase") as lookup:
        for body, auth, signed in (
            (raw, "wrong", signature(settings, raw)),
            (raw + b" ", settings.COIN_PURCHASE_AUTHORIZATION, signature(settings, raw)),
            (
                raw,
                settings.COIN_PURCHASE_AUTHORIZATION,
                signature(settings, raw, int(time.time()) - 301),
            ),
        ):
            assert (
                client.post(
                    path,
                    body,
                    content_type="application/json",
                    HTTP_AUTHORIZATION=auth,
                    HTTP_X_REVENUECAT_WEBHOOK_SIGNATURE=signed,
                ).status_code
                == 403
            )
        for body in (
            b'{"api_version":"1.0","event":{"type":"TEST","type":"TRANSFER"}}',
            b'{"api_version":"1.0","event":{"type":"TEST","bad":NaN}}',
            b"x" * 32769,
        ):
            assert callback(client, settings, body).status_code in (403, 413)
        lookup.assert_not_called()
    assert not PurchaseEvent.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "debug,flag,mode",
    [
        (True, False, "revenuecat_sandbox"),
        (False, True, "revenuecat_sandbox"),
        (True, True, "disabled"),
    ],
)
def test_notification_activation_is_separately_gated(
    client: Client,
    settings: Any,
    debug: bool,
    flag: bool,
    mode: str,
) -> None:
    settings.HOSTED_SANDBOX = False
    settings.DEBUG = debug
    settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED = flag
    settings.COIN_PURCHASE_MODE = mode
    with patch("apps.commerce.notifications.lookup_purchase") as lookup:
        assert callback(client, settings, b"{}").status_code == 409
        lookup.assert_not_called()

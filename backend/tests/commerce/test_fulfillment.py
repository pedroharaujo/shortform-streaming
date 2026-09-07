from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from threading import Event as ThreadEvent
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import IntegrityError, close_old_connections, transaction
from django.test import Client
from django.utils import timezone

from apps.accounts.lifecycle import request_account_deletion
from apps.accounts.profiles import get_or_create_profile, lock_current_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX, VerifiedToken
from apps.commerce.models import (
    ApplicationBinding,
    PurchaseDecision,
    PurchaseEvent,
    PurchaseIdentity,
)
from apps.commerce.services import fulfill, purchase_identity
from apps.commerce.verification import normalize
from apps.wallet.models import CoinLedgerEntry, Wallet
from apps.wallet.services import wallet_balance
from tests.commerce.builders import callback, configure, payload


@pytest.fixture
def owner(settings: Any) -> PurchaseIdentity:
    configure(settings)
    return purchase_identity(get_or_create_profile("synthetic-purchase-owner"))


@pytest.mark.django_db
def test_authenticated_identity_stable_and_no_client_owner(client: Client, settings: Any) -> None:
    configure(settings)
    url = "/v1/purchases/identity"
    assert client.post(url).status_code == 401
    headers: dict[str, Any] = {
        "HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}synthetic-identity-owner"
    }
    result = client.post(url, data=b"", content_type="application/json", **headers)
    assert result.status_code == 200
    assert (
        result.json()
        == client.post(url, data=b"", content_type="application/json", **headers).json()
    )
    assert result["Cache-Control"] == "no-store"
    assert "synthetic-identity-owner" not in result.content.decode()
    assert (
        client.post(
            url, {"app_user_id": str(uuid4())}, content_type="application/json", **headers
        ).status_code
        == 400
    )
    settings.COIN_PURCHASE_MODE = "disabled"
    assert client.post(url, data=b"", content_type="application/json", **headers).status_code == 409


@pytest.mark.django_db
def test_verified_callback_once_only_and_historic_snapshot(
    client: Client, settings: Any, owner: PurchaseIdentity
) -> None:
    raw = payload(str(owner.pk), id="event-one", transaction_id="transaction-one")
    first = callback(client, settings, raw)
    assert first.status_code == 200 and first.json()["status"] == "credited"
    assert callback(client, settings, raw).json() == first.json()
    settings.COIN_PURCHASE_PRODUCTS[0]["coins"] = 99
    second = callback(
        client, settings, payload(str(owner.pk), id="event-two", transaction_id="transaction-one")
    )
    assert second.json()["status"] == "credited"
    assert wallet_balance(owner.wallet) == 13
    assert PurchaseDecision.objects.get().coins == 13
    assert CoinLedgerEntry.objects.count() == 1
    assert PurchaseEvent.objects.count() == 2


@pytest.mark.django_db
@pytest.mark.parametrize(
    "changes,reason",
    [
        ({"product_id": "synthetic_unknown"}, "unsupported_scope"),
        ({"app_id": "synthetic_other"}, "unsupported_scope"),
        ({"store": "APP_STORE"}, "unsupported_scope"),
        ({"environment": "PRODUCTION"}, "unsupported_scope"),
        ({"app_user_id": str(uuid4())}, "unknown_or_deleted_owner"),
        ({"quantity": 2}, "invalid_quantity"),
        ({"quantity": True}, "invalid_quantity"),
        ({"aliases": ["other-owner"]}, "identity_conflict"),
        ({"original_app_user_id": "other-owner"}, "identity_conflict"),
        ({"type": "INITIAL_PURCHASE"}, "unsupported_event"),
        ({"type": "TEMPORARY_ENTITLEMENT_GRANT"}, "unsupported_event"),
        ({"type": "TEST"}, "unsupported_event"),
        ({"type": "TRANSFER"}, "unsupported_event"),
        ({"type": "VIRTUAL_CURRENCY_TRANSACTION"}, "unsupported_event"),
        ({"type": "PENDING"}, "unsupported_event"),
    ],
)
def test_invalid_scope_never_credits(
    owner: PurchaseIdentity, changes: dict[str, Any], reason: str
) -> None:
    result = fulfill(normalize(payload(str(owner.pk), **changes)))
    assert result.status == "quarantined" and result.reason == reason
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
def test_conflicting_event_and_transaction_do_not_credit(owner: PurchaseIdentity) -> None:
    original = payload(str(owner.pk), id="event-one", transaction_id="transaction-one")
    assert fulfill(normalize(original)).status == "credited"
    for changed in (
        payload(str(owner.pk), id="event-one", transaction_id="transaction-two"),
        payload(str(uuid4()), id="event-two", transaction_id="transaction-one"),
        payload(
            str(owner.pk),
            id="event-three",
            transaction_id="transaction-one",
            product_id="synthetic_other",
        ),
    ):
        assert fulfill(normalize(changed)).status == "quarantined"
    assert wallet_balance(owner.wallet) == 13
    # A conflicted event cannot seed a transaction that later credits via a new delivery.
    assert (
        fulfill(normalize(payload(str(owner.pk), transaction_id="transaction-two"))).status
        == "quarantined"
    )


@pytest.mark.django_db
def test_refunds_before_and_after_credit_are_unresolved(owner: PurchaseIdentity) -> None:
    refund = payload(str(owner.pk), transaction_id="before", type="CANCELLATION")
    assert fulfill(normalize(refund)).reason == "refund_before_credit"
    assert (
        fulfill(normalize(payload(str(owner.pk), transaction_id="before"))).status == "quarantined"
    )
    fulfill(normalize(payload(str(owner.pk), transaction_id="after")))
    refund_after = fulfill(
        normalize(payload(str(owner.pk), transaction_id="after", type="CANCELLATION"))
    )
    assert refund_after.reason == "refund_after_credit"
    assert wallet_balance(owner.wallet) == 13


@pytest.mark.django_db
def test_failure_rolls_back_credit_and_receipts(owner: PurchaseIdentity) -> None:
    event = normalize(payload(str(owner.pk)))
    with patch(
        "apps.commerce.services.PurchaseEvent.objects.create",
        side_effect=IntegrityError("generated failure"),
    ):
        with pytest.raises(IntegrityError):
            fulfill(event)
    assert not CoinLedgerEntry.objects.exists()
    assert not PurchaseDecision.objects.exists()
    assert not PurchaseEvent.objects.exists()
    assert fulfill(event).status == "credited"


@pytest.mark.django_db
def test_deletion_detaches_identity_and_replacement_never_claims_it(
    owner: PurchaseIdentity,
) -> None:
    profile = owner.wallet.user_profile
    assert profile is not None
    profile.delete()
    replacement = purchase_identity(get_or_create_profile("synthetic-purchase-owner"))
    assert replacement.pk != owner.pk
    result = fulfill(normalize(payload(str(owner.pk))))
    assert result.reason == "unknown_or_deleted_owner"
    assert wallet_balance(replacement.wallet) == 0
    with pytest.raises(IntegrityError), transaction.atomic():
        Wallet.objects.filter(pk=owner.wallet_id).update(
            user_profile=replacement.wallet.user_profile
        )


@pytest.mark.django_db
def test_financial_history_and_identity_are_database_immutable(owner: PurchaseIdentity) -> None:
    fulfill(normalize(payload(str(owner.pk))))
    for rows, updates in (
        (ApplicationBinding.objects.all(), {"application_id": "test.synthetic.changed"}),
        (PurchaseIdentity.objects.all(), {"id": uuid4()}),
        (PurchaseDecision.objects.all(), {"coins": 99}),
        (PurchaseEvent.objects.all(), {"reason": "rewritten"}),
    ):
        with pytest.raises(IntegrityError), transaction.atomic():
            rows.update(**updates)
    with pytest.raises(IntegrityError), transaction.atomic():
        PurchaseEvent.objects.all().delete()
    with pytest.raises(IntegrityError), transaction.atomic():
        ApplicationBinding.objects.all().delete()
    # A new transaction receipt cannot adopt an existing credit under another reference.
    decision = PurchaseDecision.objects.get()
    decision.pk = uuid4()
    decision.transaction_key = "a" * 64
    with pytest.raises(IntegrityError), transaction.atomic():
        decision.save(force_insert=True)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_event", [True, False])
def test_simultaneous_delivery_credits_once(settings: Any, same_event: bool) -> None:
    configure(settings)
    owner = purchase_identity(get_or_create_profile("synthetic-race-owner"))
    barrier = Barrier(2)

    def deliver(index: int) -> str:
        close_old_connections()
        try:
            event = normalize(
                payload(
                    str(owner.pk),
                    id="same" if same_event else str(index),
                    transaction_id="same-transaction",
                )
            )
            barrier.wait(timeout=5)
            return fulfill(event).status
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(deliver, range(2))) == ["credited", "credited"]
    assert CoinLedgerEntry.objects.count() == 1
    assert wallet_balance(owner.wallet) == 13


@pytest.mark.django_db
def test_callback_boundary_is_exact_and_logs_no_payload(
    client: Client, settings: Any, owner: PurchaseIdentity, caplog: Any
) -> None:
    settings.FIREBASE_APP_CHECK_MODE = "enforce"
    marker = "generated-private-commerce-marker"
    raw = payload(str(owner.pk), subscriber_attributes={"private": marker})
    assert callback(client, settings, raw).status_code == 200
    assert client.post("/v1/purchases/identity").status_code == 401
    assert client.get("/v1/purchases/revenuecat").status_code == 401
    assert (
        client.post("/v1/purchases/revenuecat/", raw, content_type="application/json").status_code
        == 401
    )
    assert client.post(
        "/v1/purchases/revenuecat", raw, content_type="application/json"
    ).status_code in {401, 403}
    assert marker not in caplog.text
    assert settings.COIN_PURCHASE_AUTHORIZATION not in caplog.text
    assert str(owner.pk) not in caplog.text
    assert marker not in json.dumps(list(PurchaseEvent.objects.values()), default=str)


@pytest.mark.django_db(transaction=True)
def test_deletion_commits_between_owner_read_and_purchase_lock(settings: Any) -> None:
    configure(settings)
    uid = "synthetic-deletion-race"
    identity = purchase_identity(get_or_create_profile(uid))
    owner_read, deletion_done = ThreadEvent(), ThreadEvent()

    def delayed_lock(profile: Any) -> Any:
        owner_read.set()
        assert deletion_done.wait(timeout=10)
        return lock_current_profile(profile)

    def deliver() -> str:
        close_old_connections()
        try:
            return fulfill(normalize(payload(str(identity.pk)))).reason
        finally:
            close_old_connections()

    with patch("apps.commerce.services.lock_current_profile", side_effect=delayed_lock):
        with ThreadPoolExecutor(max_workers=1) as pool:
            result = pool.submit(deliver)
            assert owner_read.wait(timeout=10)
            request_account_deletion(
                VerifiedToken(uid=uid, auth_time=int(timezone.now().timestamp()))
            )
            deletion_done.set()
            assert result.result(timeout=10) == "unknown_or_deleted_owner"
    assert not CoinLedgerEntry.objects.exists()
    identity.wallet.refresh_from_db()
    assert identity.wallet.user_profile_id is None


@pytest.mark.django_db
def test_retryable_callback_failure_is_not_acknowledged(
    client: Client, settings: Any, owner: PurchaseIdentity
) -> None:
    client.raise_request_exception = False
    raw = payload(str(owner.pk))
    with patch(
        "apps.commerce.services.PurchaseEvent.objects.create",
        side_effect=IntegrityError("generated-failure"),
    ):
        assert callback(client, settings, raw).status_code == 500
    assert not CoinLedgerEntry.objects.exists()
    assert callback(client, settings, raw).json()["status"] == "credited"


@pytest.mark.django_db
def test_google_application_binding_cannot_be_reassigned(
    settings: Any, owner: PurchaseIdentity
) -> None:
    first = fulfill(normalize(payload(str(owner.pk), transaction_id="same-store-transaction")))
    snapshot = list(PurchaseDecision.objects.values())
    other = purchase_identity(get_or_create_profile("synthetic-other-purchase-owner"))
    settings.COIN_PURCHASE_PRODUCTS[0]["app_id"] = "synthetic_second_rc_app"
    settings.COIN_PURCHASE_PRODUCTS[0]["product_id"] = "synthetic_other_pack"
    result = fulfill(
        normalize(
            payload(
                str(other.pk),
                app_id="synthetic_second_rc_app",
                product_id="synthetic_other_pack",
                transaction_id="same-store-transaction",
            )
        )
    )
    assert result.status == "quarantined"
    assert wallet_balance(owner.wallet) == 13 and wallet_balance(other.wallet) == 0
    settings.COIN_PURCHASE_PRODUCTS[0]["app_id"] = "synthetic_android"
    settings.COIN_PURCHASE_PRODUCTS[0]["application_id"] = "test.synthetic.changed"
    result = fulfill(normalize(payload(str(owner.pk), transaction_id="same-store-transaction")))
    assert result.status == "quarantined"
    assert first.decision_id is not None
    assert list(PurchaseDecision.objects.filter(pk=first.decision_id).values()) == snapshot
    assert CoinLedgerEntry.objects.count() == 1


@pytest.mark.django_db
def test_unknown_app_cancellation_remains_barrier_after_registration(
    settings: Any, owner: PurchaseIdentity
) -> None:
    cancellation = payload(
        str(owner.pk),
        app_id="synthetic_later_app",
        type="CANCELLATION",
        transaction_id="cancelled-before-registry",
    )
    assert fulfill(normalize(cancellation)).status == "quarantined"
    settings.COIN_PURCHASE_PRODUCTS[0]["app_id"] = "synthetic_later_app"
    result = fulfill(
        normalize(
            payload(
                str(owner.pk),
                app_id="synthetic_later_app",
                transaction_id="cancelled-before-registry",
            )
        )
    )
    assert result.status == "quarantined"
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
def test_changed_purchase_time_is_a_transaction_conflict(owner: PurchaseIdentity) -> None:
    fulfill(normalize(payload(str(owner.pk), transaction_id="timestamp-conflict")))
    result = fulfill(
        normalize(
            payload(
                str(owner.pk), transaction_id="timestamp-conflict", purchased_at_ms=1700000000001
            )
        )
    )
    assert result.reason == "transaction_conflict"
    assert CoinLedgerEntry.objects.count() == 1

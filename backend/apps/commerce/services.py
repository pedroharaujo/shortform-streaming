from __future__ import annotations

from dataclasses import replace
from uuid import UUID, uuid4

from django.db import connection, transaction
from rest_framework.exceptions import APIException

from apps.accounts.authentication import FirebaseAuthenticationFailed
from apps.accounts.models import UserProfile
from apps.accounts.profiles import lock_current_profile
from apps.commerce.configuration import products, purchases_enabled
from apps.commerce.models import (
    ApplicationBinding,
    PurchaseDecision,
    PurchaseEvent,
    PurchaseIdentity,
)
from apps.commerce.verification import Event, digest
from apps.wallet.models import CoinLedgerEntry, Wallet


class PurchaseUnavailable(APIException):
    status_code = 409
    default_code = "purchase_unavailable"
    default_detail = "Coin purchases are unavailable."
    envelope_message = default_detail


def purchase_identity(profile: UserProfile) -> PurchaseIdentity:
    if not purchases_enabled():
        raise PurchaseUnavailable()
    products()
    with transaction.atomic():
        profile = lock_current_profile(profile)
        wallet, _ = Wallet.objects.select_for_update().get_or_create(user_profile=profile)
        identity, _ = PurchaseIdentity.objects.get_or_create(wallet=wallet)
        return identity


def _lock(namespace: str, key: str) -> None:
    lock_id = int.from_bytes(bytes.fromhex(digest([namespace, key]))[:8], signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [lock_id])


def _resolve_application(event: Event) -> Event | None:
    scope = next((p for p in products() if p.app_id == event.app_id), None)
    if scope is None:
        return None
    _lock("commerce-app", event.app_id)
    _lock("commerce-application", scope.application_id)
    binding = ApplicationBinding.objects.filter(pk=event.app_id).first()
    if binding is None:
        if ApplicationBinding.objects.filter(application_id=scope.application_id).exists():
            return None
        binding = ApplicationBinding.objects.create(
            app_id=event.app_id, application_id=scope.application_id
        )
    if binding.application_id != scope.application_id:
        return None
    return replace(
        event,
        transaction_key=digest(
            [
                binding.application_id,
                event.store,
                event.environment,
                event.transaction_fingerprint,
            ]
        ),
    )


def _quarantine(event: Event, reason: str) -> PurchaseDecision:
    return PurchaseDecision.objects.create(
        transaction_key=event.transaction_key,
        claim_fingerprint=event.claim,
        status="quarantined",
        reason=reason,
    )


def _decide(event: Event, *, conflict: bool) -> PurchaseDecision:
    product = next(
        (p for p in products() if p.app_id == event.app_id and p.product_id == event.product_id),
        None,
    )
    if conflict:
        return _quarantine(event, "event_conflict")
    if product is None or event.store != product.store or event.environment != product.environment:
        return _quarantine(event, "unsupported_scope")
    if event.event_type in {"CANCELLATION", "REFUND"}:
        return _quarantine(event, "refund_before_credit")
    if event.event_type != "NON_RENEWING_PURCHASE":
        return _quarantine(event, "unsupported_event")
    if not event.quantity_valid:
        return _quarantine(event, "invalid_quantity")
    if not event.identity_valid:
        return _quarantine(event, "identity_conflict")
    try:
        identity_id = UUID(event.owner)
    except ValueError:
        return _quarantine(event, "unknown_or_deleted_owner")
    if str(identity_id) != event.owner:
        return _quarantine(event, "unknown_or_deleted_owner")
    identity = (
        PurchaseIdentity.objects.select_related("wallet__user_profile")
        .filter(pk=identity_id)
        .first()
    )
    if identity is None or identity.wallet.user_profile is None:
        return _quarantine(event, "unknown_or_deleted_owner")
    try:
        lock_current_profile(identity.wallet.user_profile)
    except FirebaseAuthenticationFailed:
        return _quarantine(event, "unknown_or_deleted_owner")
    wallet = Wallet.objects.select_for_update().get(pk=identity.wallet_id)
    if wallet.user_profile_id is None:
        return _quarantine(event, "unknown_or_deleted_owner")
    receipt_id = uuid4()
    entry = CoinLedgerEntry.objects.create(
        wallet=wallet, reference=receipt_id, kind="purchase", amount=product.coins
    )
    return PurchaseDecision.objects.create(
        id=receipt_id,
        transaction_key=event.transaction_key,
        claim_fingerprint=event.claim,
        status="credited",
        reason="verified_purchase",
        identity=identity,
        ledger_entry=entry,
        coins=product.coins,
        product_id=product.product_id,
        application_id=product.application_id,
        approval_reference=product.approval_reference,
        product_type=product.product_type,
    )


def fulfill(event: Event) -> PurchaseEvent:
    if not purchases_enabled():
        raise PurchaseUnavailable()
    with transaction.atomic():
        _lock("commerce-event", event.event_key)
        existing = PurchaseEvent.objects.filter(
            event_key=event.event_key, fingerprint=event.fingerprint
        ).first()
        if existing is not None:
            return existing
        conflict = PurchaseEvent.objects.filter(event_key=event.event_key).exists()
        # Keep the original delivery fingerprint stable across configuration changes.
        fingerprint = event.fingerprint
        raw_key = event.transaction_key
        resolved = _resolve_application(event)
        # Unknown-app history remains a barrier if that app is configured later.
        _lock("commerce-transaction", raw_key)
        fallback = PurchaseDecision.objects.filter(transaction_key=raw_key).first()
        if resolved is not None:
            event = resolved
        _lock("commerce-transaction", event.transaction_key)
        decision = (
            fallback
            or PurchaseDecision.objects.filter(transaction_key=event.transaction_key).first()
        )
        if decision is None:
            if resolved is None:
                decision = _quarantine(event, "unsupported_scope")
            else:
                decision = _decide(event, conflict=conflict)
        status, reason = decision.status, decision.reason
        if conflict:
            status, reason = "quarantined", "event_conflict"
        elif event.event_type in {"CANCELLATION", "REFUND"} and decision.status == "credited":
            status, reason = "quarantined", "refund_after_credit"
        elif decision.claim_fingerprint != event.claim or (
            not event.identity_valid and decision.status == "credited"
        ):
            status, reason = "quarantined", "transaction_conflict"
        elif event.event_type != "NON_RENEWING_PURCHASE" or not event.quantity_valid:
            status, reason = (
                "quarantined",
                reason if decision.status == "quarantined" else "unsupported_event",
            )
        return PurchaseEvent.objects.create(
            event_key=event.event_key,
            fingerprint=fingerprint,
            decision=decision,
            status=status,
            reason=reason,
        )

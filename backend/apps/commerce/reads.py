from __future__ import annotations

from django.db import transaction
from django.db.models import Exists, OuterRef, Q

from apps.accounts.models import UserProfile
from apps.accounts.profiles import lock_current_profile
from apps.commerce.configuration import products, purchases_enabled
from apps.commerce.models import ApplicationBinding, PurchaseDecision, PurchaseEvent
from apps.commerce.services import PurchaseUnavailable
from apps.commerce.verification import digest


def purchase_catalog(profile: UserProfile, *, application_id: str) -> list[dict[str, object]]:
    if not purchases_enabled():
        raise PurchaseUnavailable()
    selected = [product for product in products() if product.application_id == application_id]
    if not selected:
        raise PurchaseUnavailable()
    app_id = selected[0].app_id
    with transaction.atomic():
        lock_current_profile(profile)
        if (
            ApplicationBinding.objects.filter(Q(pk=app_id) | Q(application_id=application_id))
            .exclude(pk=app_id, application_id=application_id)
            .exists()
        ):
            raise PurchaseUnavailable()
        return [
            {
                "product_id": product.product_id,
                "coins": product.coins,
                "product_type": product.product_type,
                "store": product.store,
                "environment": product.environment,
                "price_source": product.price_source,
            }
            for product in selected
        ]


def purchase_status(
    profile: UserProfile, *, application_id: str, product_id: str, transaction_id: str
) -> dict[str, object]:
    if not purchases_enabled():
        raise PurchaseUnavailable()
    # Match fulfillment's permanent store namespace, not mutable provider configuration.
    key = digest([application_id, "PLAY_STORE", "SANDBOX", digest(transaction_id)])
    with transaction.atomic():
        profile = lock_current_profile(profile)
        decision = (
            PurchaseDecision.objects.filter(
                transaction_key=key,
                product_id=product_id,
                identity__wallet__user_profile=profile,
                status="credited",
            )
            .annotate(
                needs_review=Exists(
                    PurchaseEvent.objects.filter(decision_id=OuterRef("pk"), status="quarantined")
                )
            )
            .values("id", "coins", "needs_review")
            .first()
        )
        if decision is None:
            # Missing, foreign and unattributed quarantines are indistinguishable.
            # This does not prove a charge failed or that repurchasing is safe.
            return {
                "status": "awaiting_verification",
                "historical_credited_coins": 0,
                "support_reference": None,
            }
        return {
            "status": "review_required" if decision["needs_review"] else "credited",
            "historical_credited_coins": decision["coins"],
            "support_reference": decision["id"],
        }

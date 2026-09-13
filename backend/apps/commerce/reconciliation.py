from __future__ import annotations

from django.db import transaction

from apps.accounts.models import UserProfile
from apps.accounts.profiles import lock_current_profile
from apps.commerce.configuration import products, reconciliation_enabled
from apps.commerce.models import PurchaseIdentity
from apps.commerce.reads import purchase_catalog, purchase_status
from apps.commerce.revenuecat import lookup_purchase
from apps.commerce.services import PurchaseUnavailable, fulfill


def synchronize_purchase(
    profile: UserProfile, *, application_id: str, product_id: str, transaction_id: str
) -> dict[str, object]:
    if not reconciliation_enabled():
        raise PurchaseUnavailable()
    selected = next(
        (
            product
            for product in products()
            if product.application_id == application_id and product.product_id == product_id
        ),
        None,
    )
    if selected is None:
        raise PurchaseUnavailable()
    # Check permanent application binding before provider work; no financial writes.
    purchase_catalog(profile, application_id=application_id)
    with transaction.atomic():
        lock_current_profile(profile)
        identity = PurchaseIdentity.objects.filter(wallet__user_profile=profile).first()
    if identity is not None:
        # No profile/wallet lock crosses provider I/O. Fulfillment rechecks ownership
        # under its existing commerce -> profile -> wallet lock order.
        event = lookup_purchase(selected, transaction_id, str(identity.pk))
        if event is not None:
            fulfill(event)
    # Cached fulfillment events cannot erase review from a later refund/conflict.
    return purchase_status(
        profile, application_id=application_id, product_id=product_id, transaction_id=transaction_id
    )

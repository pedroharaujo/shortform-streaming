from __future__ import annotations

from dataclasses import replace
from uuid import UUID

from rest_framework.exceptions import APIException

from apps.commerce.configuration import products
from apps.commerce.models import PurchaseEvent, PurchaseIdentity
from apps.commerce.revenuecat import lookup_purchase
from apps.commerce.services import fulfill
from apps.commerce.verification import InvalidCallback, callback_fields, normalize


class NotificationVerificationUnavailable(APIException):
    status_code = 503
    default_code = "purchase_verification_unavailable"
    default_detail = "Purchase verification is temporarily unavailable."
    envelope_message = default_detail


def process_notification(raw: bytes) -> PurchaseEvent | None:
    fields = callback_fields(raw)
    event_type = fields.get("type")
    if not isinstance(event_type, str) or not 1 <= len(event_type) <= 200:
        raise InvalidCallback
    if event_type not in {"NON_RENEWING_PURCHASE", "CANCELLATION"}:
        return None
    event = normalize(raw)
    # Authenticated negative evidence must establish a barrier immediately, even
    # if the provider API is down or still reports the earlier owned state.
    if event.event_type == "CANCELLATION":
        return fulfill(event)
    product = next(
        (p for p in products() if p.app_id == event.app_id and p.product_id == event.product_id),
        None,
    )
    try:
        owner_id = UUID(event.owner)
    except ValueError:
        owner_id = None
    if (
        product is None
        or event.store != product.store
        or event.environment != product.environment
        or not event.identity_valid
        or not event.quantity_valid
        or owner_id is None
        or str(owner_id) != event.owner
        or not PurchaseIdentity.objects.filter(
            pk=owner_id, wallet__user_profile__isnull=False
        ).exists()
    ):
        return fulfill(event)
    # No database lock crosses provider I/O. Fulfillment rechecks current owner
    # and permanent application binding under the existing accounting locks.
    verified = lookup_purchase(product, fields["transaction_id"], event.owner)
    if verified is None or (
        verified.transaction_key != event.transaction_key
        or verified.transaction_fingerprint != event.transaction_fingerprint
        or verified.app_id != event.app_id
        or verified.store != event.store
        or verified.environment != event.environment
        or verified.product_id != event.product_id
        or verified.owner != event.owner
        or verified.purchased_at_ms != event.purchased_at_ms
        or not verified.quantity_valid
        or not verified.identity_valid
        or verified.event_type not in {"NON_RENEWING_PURCHASE", "CANCELLATION"}
    ):
        raise NotificationVerificationUnavailable()
    if verified.event_type == "CANCELLATION":
        return fulfill(replace(event, event_type="CANCELLATION"))
    # Keep the original delivery key and fingerprint, including its notification
    # time, so reused provider event IDs remain detectable conflicts.
    return fulfill(event)

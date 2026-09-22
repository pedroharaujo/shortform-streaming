from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.commerce.configuration import Product
from apps.commerce.models import CoinPack

# A buyer may pay a while after the pop-up loaded; packs shown in this window are honored.
HONOR_WINDOW = timedelta(hours=24)


def _live(now: datetime) -> QuerySet[CoinPack]:
    return CoinPack.objects.filter(
        Q(starts_at__isnull=True) | Q(starts_at__lte=now),
        Q(ends_at__isnull=True) | Q(ends_at__gt=now),
        is_active=True,
    )


def _offer(pack: CoinPack) -> dict[str, object]:
    return {
        "product_id": pack.product_id,
        "coins": pack.coins,
        "bonus_percent": pack.bonus_percent,
        "badge": pack.badge,
        "highlighted": pack.highlighted,
    }


def catalog_offers(selected: Iterable[Product]) -> list[dict[str, object]]:
    """One offer per approved store product; a product with retired packs only is hidden."""
    now = timezone.now()
    rows: list[tuple[int, int, dict[str, object]]] = []
    for product in selected:
        pack = _live(now).filter(product_id=product.product_id).order_by("-coins", "id").first()
        if pack is not None:
            order, offer = pack.sort_order, _offer(pack)
        elif not CoinPack.objects.filter(product_id=product.product_id).exists():
            order = 0
            offer = {
                "product_id": product.product_id,
                "coins": product.coins,
                "bonus_percent": 0,
                "badge": "",
                "highlighted": False,
            }
        else:
            continue
        offer.update(
            product_type=product.product_type,
            store=product.store,
            environment=product.environment,
            price_source=product.price_source,
        )
        rows.append((order, pack.coins if pack else product.coins, offer))
    rows.sort(key=lambda row: (row[0], row[1]))
    return [offer for _, _, offer in rows]


def credited_coins(product: Product, purchased_at_ms: int) -> int:
    """Never less than the registry floor or any pack live shortly before payment."""
    paid_at = min(datetime.fromtimestamp(purchased_at_ms / 1000, tz=UTC), timezone.now())
    window_start = paid_at - HONOR_WINDOW
    honored = CoinPack.objects.filter(
        Q(starts_at__isnull=True) | Q(starts_at__lte=paid_at),
        Q(ends_at__isnull=True) | Q(ends_at__gt=window_start),
        Q(retired_at__isnull=True) | Q(retired_at__gt=window_start),
        created_at__lte=paid_at,
        product_id=product.product_id,
    ).values_list("coins", flat=True)
    return max([product.coins, *honored])


def preview_enabled() -> bool:
    return bool(
        settings.DEBUG is True
        and getattr(settings, "HOSTED_SANDBOX", False) is False
        and getattr(settings, "COIN_PURCHASE_MODE", "disabled") == "disabled"
    )


def preview_offers() -> list[dict[str, object]]:
    """Local design preview only: live packs without store scope or prices."""
    return [_offer(pack) for pack in _live(timezone.now()).order_by("sort_order", "coins", "id")]

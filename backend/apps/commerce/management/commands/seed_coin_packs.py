from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.commerce.models import CoinPack

# Local example offers; launch amounts and prices are a founder decision made in Admin.
EXAMPLE_PACKS = (
    ("coins_099", 100, "0.00", "Quick top-up", False),
    ("coins_499", 500, "0.10", "Most popular", False),
    ("coins_999", 1000, "0.20", "Best value", True),
    ("coins_1999", 2000, "0.50", "Limited time", True),
)


class Command(BaseCommand):
    help = "Create the example coin packs for local development when missing."

    def handle(self, *args: Any, **options: Any) -> None:
        del args, options
        if settings.DEBUG is not True or getattr(settings, "HOSTED_SANDBOX", False):
            raise CommandError("Example coin packs are for local development only.")
        created = 0
        for order, (product_id, base_coins, bonus, badge, highlighted) in enumerate(
            EXAMPLE_PACKS, start=1
        ):
            if CoinPack.objects.filter(product_id=product_id).exists():
                continue
            CoinPack.objects.create(
                product_id=product_id,
                base_coins=base_coins,
                bonus=Decimal(bonus),
                badge=badge,
                highlighted=highlighted,
                sort_order=order,
                ends_at=timezone.now() + timedelta(days=14) if "Limited" in badge else None,
            )
            created += 1
        self.stdout.write(f"Created {created} example coin pack(s).")

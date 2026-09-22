from __future__ import annotations

from decimal import ROUND_FLOOR, Decimal
from uuid import uuid4

from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

MAX_COINS = 2147483647
MAX_BONUS = Decimal("2.00")


def pack_coins(base_coins: int, bonus: Decimal) -> int:
    """Whole coins credited for a pack; bonus coins round down."""
    extra = (Decimal(base_coins) * bonus).to_integral_value(rounding=ROUND_FLOOR)
    return base_coins + int(extra)


class ApplicationBinding(models.Model):
    """Once observed, a provider app cannot change its store application namespace."""

    app_id = models.CharField(max_length=128, primary_key=True)
    application_id = models.CharField(max_length=128, unique=True)

    def __str__(self) -> str:
        return self.app_id


class PurchaseIdentity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    wallet = models.OneToOneField("wallet.Wallet", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.pk)


class PurchaseDecision(models.Model):
    """One immutable credit or fail-closed decision per store transaction."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    transaction_key = models.CharField(max_length=64, unique=True)
    claim_fingerprint = models.CharField(max_length=64)
    status = models.CharField(max_length=16)
    reason = models.CharField(max_length=40)
    identity = models.ForeignKey(PurchaseIdentity, on_delete=models.PROTECT, null=True)
    ledger_entry = models.OneToOneField(
        "wallet.CoinLedgerEntry", on_delete=models.PROTECT, null=True
    )
    coins = models.PositiveIntegerField(default=0)
    product_id = models.CharField(max_length=128, blank=True)
    application_id = models.CharField(max_length=128, blank=True)
    approval_reference = models.CharField(max_length=128, blank=True)
    product_type = models.CharField(max_length=16, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(
                        status="credited",
                        coins__gte=1,
                        coins__lte=2147483647,
                        ledger_entry__isnull=False,
                        identity__isnull=False,
                    )
                    | Q(status="quarantined", coins=0, ledger_entry__isnull=True)
                ),
                name="commerce_valid_decision_credit",
            )
        ]

    def __str__(self) -> str:
        return str(self.pk)


class CoinPack(models.Model):
    """Admin-managed offer for one store product. The store owns the price.

    Coin amounts and schedule are fixed once saved so a buyer is never credited
    less than the pack they were shown; change an offer by retiring it and
    adding a new pack.
    """

    product_id = models.CharField(
        max_length=128,
        validators=[RegexValidator(r"\A[A-Za-z0-9_.:/-]+\Z")],
        help_text="Google Play in-app product ID. Its price is set in Google Play Console.",
    )
    base_coins = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(1_000_000)]
    )
    bonus = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(MAX_BONUS)],
        help_text="Extra coins as a fraction of base coins: 0.20 gives 20% more.",
    )
    coins = models.PositiveIntegerField(editable=False)
    badge = models.CharField(max_length=24, blank=True)
    highlighted = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    retired_at = models.DateTimeField(null=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("sort_order", "coins", "id")
        constraints = [
            models.CheckConstraint(
                condition=Q(coins__gte=F("base_coins"), coins__lte=MAX_COINS),
                name="commerce_pack_coins_cover_base",
            ),
            models.CheckConstraint(
                condition=Q(bonus__gte=0, bonus__lte=MAX_BONUS),
                name="commerce_pack_bonus_range",
            ),
            models.CheckConstraint(
                condition=Q(starts_at__isnull=True)
                | Q(ends_at__isnull=True)
                | Q(ends_at__gt=F("starts_at")),
                name="commerce_pack_schedule_order",
            ),
            models.CheckConstraint(
                condition=Q(is_active=True, retired_at__isnull=True)
                | Q(is_active=False, retired_at__isnull=False),
                name="commerce_pack_retirement",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.coins} coins ({self.product_id})"

    def save(self, *args: object, **kwargs: object) -> None:
        self.coins = pack_coins(self.base_coins, Decimal(self.bonus))
        if not self.is_active and self.retired_at is None:
            self.retired_at = timezone.now()
        super().save(*args, **kwargs)  # type: ignore[arg-type]

    @property
    def bonus_percent(self) -> int:
        return int(self.bonus * 100)


class PurchaseEvent(models.Model):
    """Immutable normalized delivery decision; no raw payload or identifiers."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    event_key = models.CharField(max_length=64)
    fingerprint = models.CharField(max_length=64)
    decision = models.ForeignKey(PurchaseDecision, on_delete=models.PROTECT, null=True)
    status = models.CharField(max_length=16)
    reason = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("event_key", "fingerprint"), name="commerce_unique_event_delivery"
            )
        ]

    def __str__(self) -> str:
        return str(self.pk)

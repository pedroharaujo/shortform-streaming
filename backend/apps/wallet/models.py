from __future__ import annotations

from uuid import uuid4

from django.db import models
from django.db.models import Q

MAX_ENTRY_COINS = 2147483647
MAX_BALANCE_COINS = 9007199254740991


class Wallet(models.Model):
    """Opaque accounting identity retained without the account after deletion."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user_profile = models.OneToOneField(
        "accounts.UserProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coin_wallet",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.pk)


class CoinLedgerEntry(models.Model):
    """Append-only integer accounting; the database serializes every insert."""

    class Kind(models.TextChoices):
        PURCHASE = "purchase", "Purchase"
        UNLOCK = "unlock", "Unlock"
        CORRECTION = "correction", "Correction"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="entries")
    reference = models.UUIDField(unique=True, editable=False)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(kind="purchase", amount__gt=0)
                    | Q(kind="unlock", amount__lt=0)
                    | (Q(kind="correction") & ~Q(amount=0))
                ),
                name="wallet_ledger_valid_kind_sign",
            ),
            models.CheckConstraint(
                condition=Q(amount__gte=-MAX_ENTRY_COINS, amount__lte=MAX_ENTRY_COINS),
                name="wallet_ledger_bounded_amount",
            ),
        ]

    def __str__(self) -> str:
        return str(self.pk)


class CoinUnlock(models.Model):
    """Immutable idempotency receipt with no content or account deletion cascade."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="unlocks")
    request_id = models.UUIDField()
    episode_public_id = models.CharField(max_length=40)
    policy_version = models.CharField(max_length=64)
    expected_coin_price = models.PositiveIntegerField()
    charged_coins = models.PositiveIntegerField(default=0)
    ledger_entry = models.OneToOneField(
        CoinLedgerEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="unlock_receipt",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("wallet", "request_id"), name="wallet_unlock_unique_request"
            ),
            models.CheckConstraint(
                condition=(
                    Q(charged_coins=0, ledger_entry__isnull=True)
                    | Q(
                        charged_coins__gt=0,
                        charged_coins=models.F("expected_coin_price"),
                        ledger_entry__isnull=False,
                    )
                ),
                name="wallet_unlock_charge_has_entry",
            ),
        ]

    def __str__(self) -> str:
        return str(self.pk)


class CoinUnlockCancellation(models.Model):
    """Immutable terminal decision that prevents a delayed original from charging."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="cancellations")
    request_id = models.UUIDField()
    episode_public_id = models.CharField(max_length=40)
    policy_version = models.CharField(max_length=64)
    expected_coin_price = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("wallet", "request_id"), name="wallet_cancel_unique_request"
            ),
            models.CheckConstraint(
                condition=Q(expected_coin_price__gte=1, expected_coin_price__lte=MAX_ENTRY_COINS),
                name="wallet_cancel_bounded_price",
            ),
        ]

    def __str__(self) -> str:
        return str(self.pk)

from __future__ import annotations

from uuid import uuid4

from django.db import models
from django.db.models import Q


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

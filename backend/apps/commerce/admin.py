from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django import forms
from django.contrib import admin
from django.core.exceptions import ImproperlyConfigured
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone

from apps.commerce.configuration import Product, products
from apps.commerce.models import CoinPack, pack_coins

FIXED_FIELDS = ("product_id", "base_coins", "bonus", "starts_at", "ends_at")


def _registry() -> tuple[Product, ...]:
    try:
        return products()
    except ImproperlyConfigured:
        return ()


class CoinPackForm(forms.ModelForm):  # type: ignore[type-arg]
    class Meta:
        model = CoinPack
        fields = (*FIXED_FIELDS, "badge", "highlighted", "sort_order", "is_active")

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            for field in FIXED_FIELDS:
                self.fields[field].disabled = True
            if self.instance.retired_at is not None:
                self.fields["is_active"].disabled = True

    def clean(self) -> dict[str, Any]:
        data = super().clean() or {}
        if self.instance.pk:
            return data
        product_id = data.get("product_id")
        base_coins = data.get("base_coins")
        bonus = data.get("bonus")
        starts_at: datetime | None = data.get("starts_at")
        ends_at: datetime | None = data.get("ends_at")
        if "limited" in data.get("badge", "").lower() and ends_at is None:
            self.add_error("ends_at", "A limited-time badge needs a real end date.")
        if ends_at is not None and ends_at <= (starts_at or timezone.now()):
            self.add_error("ends_at", "The end date must be after the start.")
        if not product_id or base_coins is None or bonus is None:
            return data
        registry = _registry()
        if registry:
            product = next((p for p in registry if p.product_id == product_id), None)
            if product is None:
                self.add_error("product_id", "This Google Play product is not approved yet.")
            elif pack_coins(base_coins, Decimal(bonus)) < product.coins:
                self.add_error(
                    "base_coins", f"This product must give at least {product.coins} coins."
                )
        overlapping = CoinPack.objects.filter(product_id=product_id, is_active=True)
        if ends_at is not None:
            overlapping = overlapping.filter(Q(starts_at__isnull=True) | Q(starts_at__lt=ends_at))
        overlapping = overlapping.filter(
            Q(ends_at__isnull=True) | Q(ends_at__gt=starts_at or timezone.now())
        )
        if overlapping.exists():
            self.add_error(
                "product_id",
                "Another active pack uses this product at the same time. Turn it off first.",
            )
        return data


@admin.register(CoinPack)
class CoinPackAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Prices live in Google Play. Coin amounts and dates are fixed once saved."""

    form = CoinPackForm
    list_display = (
        "product_id",
        "coins",
        "bonus_label",
        "badge",
        "highlighted",
        "sort_order",
        "status",
    )
    list_filter = ("is_active", "highlighted")
    ordering = ("sort_order", "coins")
    readonly_fields = ("coins", "retired_at", "created_at")

    @admin.display(description="Bonus")
    def bonus_label(self, obj: CoinPack) -> str:
        return f"+{obj.bonus_percent}%" if obj.bonus_percent else "—"

    @admin.display(description="Status")
    def status(self, obj: CoinPack) -> str:
        now = timezone.now()
        if not obj.is_active:
            return "Turned off"
        if obj.starts_at and obj.starts_at > now:
            return "Scheduled"
        if obj.ends_at and obj.ends_at <= now:
            return "Ended"
        return "Live"

    def has_delete_permission(self, request: HttpRequest, obj: CoinPack | None = None) -> bool:
        del request, obj
        return False

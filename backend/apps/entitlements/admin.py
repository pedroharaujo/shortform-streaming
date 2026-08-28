from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin
from django.http import HttpRequest

from apps.entitlements.models import (
    AccessPolicy,
    AccessPolicyRevision,
    EntitlementSource,
    EpisodeEntitlement,
)
from apps.entitlements.policy import (
    DEFAULT_FREE_EPISODE_ORDER_MAX,
    DEFAULT_REWARDED_AD_ENABLED,
)

_SERIES_WIDE_FIELDS = ("free_episode_order_max", "rewarded_ad_enabled")
_SERIES_WIDE_HELP = (
    "Series-wide. If Episode is set, authorize/offers inherit the series row "
    "(or D-006 defaults). The value on this override is not authoritative."
)


def _series_wide_values(series_id: int | None) -> tuple[int, bool]:
    if series_id is None:
        return DEFAULT_FREE_EPISODE_ORDER_MAX, DEFAULT_REWARDED_AD_ENABLED
    series_row = AccessPolicy.objects.filter(series_id=series_id, episode_id__isnull=True).first()
    if series_row is None:
        return DEFAULT_FREE_EPISODE_ORDER_MAX, DEFAULT_REWARDED_AD_ENABLED
    return series_row.free_episode_order_max, series_row.rewarded_ad_enabled


class AccessPolicyAdminForm(forms.ModelForm):  # type: ignore[type-arg]
    class Meta:
        model = AccessPolicy
        fields = [
            "series",
            "episode",
            "free_episode_order_max",
            "rewarded_ad_enabled",
            "force_free",
            "force_lock",
            "coin_unlock_enabled",
            "subscription_unlock_enabled",
        ]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        episode_set = bool(self.instance.pk and self.instance.episode_id)
        if not episode_set and self.data:
            episode_set = bool(self.data.get("episode"))
        for name in _SERIES_WIDE_FIELDS:
            field = self.fields.get(name)
            if field is None:
                continue
            field.help_text = _SERIES_WIDE_HELP
            if episode_set:
                field.disabled = True


@admin.register(EpisodeEntitlement)
class EpisodeEntitlementAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Staff grant UI. Never lists or stores playback URLs."""

    list_display = ("id", "user_profile", "episode", "source", "granted_at")
    list_filter = ("source",)
    search_fields = ("user_profile__public_id", "episode__public_id")
    readonly_fields = ("granted_at",)
    fields = ("user_profile", "episode", "source", "granted_at")
    ordering = ("-granted_at",)

    def get_changeform_initial_data(self, request: HttpRequest) -> dict[str, str | list[str]]:
        del request
        return {"source": EntitlementSource.STAFF}


class AccessPolicyRevisionInline(admin.TabularInline):  # type: ignore[type-arg]
    model = AccessPolicyRevision
    extra = 0
    can_delete = False
    fields = (
        "free_episode_order_max",
        "rewarded_ad_enabled",
        "force_free",
        "force_lock",
        "coin_unlock_enabled",
        "subscription_unlock_enabled",
        "changed_at",
        "changed_by",
    )
    readonly_fields = fields

    def has_add_permission(self, request: HttpRequest, obj: AccessPolicy | None = None) -> bool:
        del request, obj
        return False


@admin.register(AccessPolicy)
class AccessPolicyAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Live series/episode free-window and ad-availability. Coin/subscription stay False."""

    form = AccessPolicyAdminForm
    list_display = (
        "id",
        "series",
        "episode",
        "list_free_episode_order_max",
        "list_rewarded_ad_enabled",
        "updated_at",
    )
    readonly_fields = ("created_at", "updated_at")
    fields = (
        "series",
        "episode",
        "free_episode_order_max",
        "rewarded_ad_enabled",
        "force_free",
        "force_lock",
        "coin_unlock_enabled",
        "subscription_unlock_enabled",
        "created_at",
        "updated_at",
    )
    inlines = (AccessPolicyRevisionInline,)
    ordering = ("series_id", "episode_id", "id")

    @admin.display(description="Free max")
    def list_free_episode_order_max(self, obj: AccessPolicy) -> str:
        if obj.episode_id:
            inherited, _ads = _series_wide_values(obj.series_id)
            return f"{inherited} (series)"
        return str(obj.free_episode_order_max)

    @admin.display(description="Rewarded ads")
    def list_rewarded_ad_enabled(self, obj: AccessPolicy) -> str:
        if obj.episode_id:
            _max, inherited = _series_wide_values(obj.series_id)
            return f"{inherited} (series)"
        return str(obj.rewarded_ad_enabled)

    def get_readonly_fields(
        self, request: HttpRequest, obj: AccessPolicy | None = None
    ) -> list[str]:
        del request
        readonly = list(self.readonly_fields)
        if obj is not None and obj.episode_id:
            readonly.extend(list(_SERIES_WIDE_FIELDS))
        return readonly

    def has_delete_permission(self, request: HttpRequest, obj: AccessPolicy | None = None) -> bool:
        del request, obj
        return False

    def save_model(self, request: HttpRequest, obj: AccessPolicy, form: Any, change: bool) -> None:
        if obj.episode_id:
            obj.free_episode_order_max, obj.rewarded_ad_enabled = _series_wide_values(obj.series_id)
        obj._revision_actor = request.user
        obj.full_clean()
        super().save_model(request, obj, form, change)


@admin.register(AccessPolicyRevision)
class AccessPolicyRevisionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Append-only audit log. Staff cannot add, change, or delete revisions."""

    list_display = (
        "id",
        "policy",
        "free_episode_order_max",
        "rewarded_ad_enabled",
        "changed_at",
        "changed_by",
    )
    readonly_fields = (
        "policy",
        "series",
        "episode",
        "free_episode_order_max",
        "rewarded_ad_enabled",
        "force_free",
        "force_lock",
        "coin_unlock_enabled",
        "subscription_unlock_enabled",
        "changed_at",
        "changed_by",
    )

    def has_add_permission(self, request: HttpRequest) -> bool:
        del request
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: AccessPolicyRevision | None = None
    ) -> bool:
        del request, obj
        return False

    def has_delete_permission(
        self, request: HttpRequest, obj: AccessPolicyRevision | None = None
    ) -> bool:
        del request, obj
        return False

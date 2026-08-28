from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from apps.entitlements.models import (
    AccessPolicy,
    AccessPolicyRevision,
    EntitlementSource,
    EpisodeEntitlement,
)


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

    list_display = (
        "id",
        "series",
        "episode",
        "free_episode_order_max",
        "rewarded_ad_enabled",
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

    def get_readonly_fields(
        self, request: HttpRequest, obj: AccessPolicy | None = None
    ) -> list[str]:
        del request
        readonly = list(self.readonly_fields)
        if obj is not None and obj.episode_id:
            readonly.extend(["free_episode_order_max", "rewarded_ad_enabled"])
        return readonly

    def has_delete_permission(self, request: HttpRequest, obj: AccessPolicy | None = None) -> bool:
        del request, obj
        return False

    def save_model(self, request: HttpRequest, obj: AccessPolicy, form: Any, change: bool) -> None:
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

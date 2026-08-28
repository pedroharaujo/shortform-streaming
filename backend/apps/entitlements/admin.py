from __future__ import annotations

from django.contrib import admin

from apps.entitlements.models import EntitlementSource, EpisodeEntitlement


@admin.register(EpisodeEntitlement)
class EpisodeEntitlementAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Staff grant UI. Never lists or stores playback URLs."""

    list_display = ("id", "user_profile", "episode", "source", "granted_at")
    list_filter = ("source",)
    search_fields = ("user_profile__public_id", "episode__public_id")
    readonly_fields = ("granted_at",)
    fields = ("user_profile", "episode", "source", "granted_at")
    ordering = ("-granted_at",)

    def get_changeform_initial_data(self, request: object) -> dict[str, str]:
        del request
        return {"source": EntitlementSource.STAFF}

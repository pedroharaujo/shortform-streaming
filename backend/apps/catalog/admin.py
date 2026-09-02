from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.db.models import ForeignKey
from django.http import HttpRequest

from apps.catalog.models import ContentRight, Episode, Genre, Season, Series


class SeasonInline(admin.TabularInline):  # type: ignore[type-arg]
    model = Season
    extra = 1


class EpisodeInline(admin.TabularInline):  # type: ignore[type-arg]
    model = Episode
    extra = 0
    ordering = ("season", "order")
    fields = ("season", "order", "title", "public_id", "duration_seconds", "publication_status")
    readonly_fields = ("public_id",)
    show_change_link = True

    def formfield_for_foreignkey(
        self,
        db_field: ForeignKey[Any, Any],
        request: HttpRequest,
        **kwargs: Any,
    ) -> Any:
        if db_field.name == "season":
            object_id = getattr(getattr(request, "resolver_match", None), "kwargs", {}).get(
                "object_id"
            )
            if object_id:
                kwargs["queryset"] = Season.objects.filter(series_id=object_id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


class SeasonEpisodeInline(EpisodeInline):
    exclude = ("series",)
    fields = (  # type: ignore[assignment]
        "order",
        "title",
        "public_id",
        "duration_seconds",
        "publication_status",
    )


class ContentRightInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ContentRight
    extra = 0
    fields = (
        "licensor",
        "contract_reference",
        "territory_allowlist",
        "territory_denylist",
        "platforms",
        "languages",
        "starts_at",
        "ends_at",
        "exclusive",
        "takedown",
        "drm_required",
        "promotional_clip_permission",
        "revenue_share_rule_reference",
    )


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "public_id",
        "title",
        "publication_status",
        "self_owned",
        "takedown",
        "free_episode_count",
        "rewarded_ads_enabled",
    )
    list_filter = ("publication_status", "takedown", "self_owned", "promotional_use_approved")
    search_fields = (
        "public_id",
        "title",
        "provenance_reference",
        "rights__licensor",
        "rights__contract_reference",
    )
    inlines = (SeasonInline, EpisodeInline, ContentRightInline)
    filter_horizontal = ("genres",)
    readonly_fields = ("public_id", "created_at", "updated_at")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "public_id",
                    "title",
                    "synopsis",
                    "publication_status",
                    "editorial_rank",
                    "genres",
                    "artwork_url",
                )
            },
        ),
        (
            "Self-owned release",
            {
                "fields": (
                    "self_owned",
                    "provenance_reference",
                    "promotional_use_approved",
                    "takedown",
                )
            },
        ),
        (
            "Access",
            {"fields": ("free_episode_count", "rewarded_ads_enabled")},
        ),
        (
            "Metadata",
            {"fields": ("age_rating", "content_warnings", "attribution")},
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    def get_fieldsets(
        self,
        request: HttpRequest,
        obj: Series | None = None,
    ) -> Any:
        fieldsets = super().get_fieldsets(request, obj)
        if self.has_change_permission(request, obj):
            return fieldsets
        # Ownership evidence is operational metadata, not editorial viewing data.
        return tuple(fieldset for fieldset in fieldsets if fieldset[0] != "Self-owned release")

    def save_model(self, request: HttpRequest, obj: Series, form: Any, change: bool) -> None:
        del request, form, change
        obj.full_clean()
        obj.save()


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("series", "number")
    search_fields = ("series__public_id", "series__title")
    inlines = (SeasonEpisodeInline,)


@admin.register(Episode)
class EpisodeAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "public_id",
        "title",
        "series",
        "season",
        "order",
        "publication_status",
        "duration_seconds",
    )
    list_filter = ("publication_status",)
    search_fields = ("public_id", "title", "series__public_id")
    readonly_fields = ("public_id", "created_at", "updated_at")
    ordering = ("series", "season__number", "order")

    def save_model(self, request: HttpRequest, obj: Episode, form: Any, change: bool) -> None:
        del request, form, change
        obj.full_clean()
        obj.save()


@admin.register(ContentRight)
class ContentRightAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "licensor",
        "series",
        "takedown",
        "starts_at",
        "ends_at",
        "exclusive",
        "drm_required",
        "promotional_clip_permission",
    )
    list_filter = ("takedown", "exclusive", "drm_required", "promotional_clip_permission")
    search_fields = ("licensor", "contract_reference", "series__public_id", "series__title")
    readonly_fields = ("created_at", "updated_at")

    def save_model(self, request: HttpRequest, obj: ContentRight, form: Any, change: bool) -> None:
        del request, form, change
        obj.full_clean()
        obj.save()

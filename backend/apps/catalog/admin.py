from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.db.models import ForeignKey, QuerySet
from django.http import HttpRequest

from apps.catalog.models import (
    ContentRight,
    Episode,
    EpisodeTranslation,
    Genre,
    Season,
    Series,
    SeriesTranslation,
)


class TakedownListFilter(admin.SimpleListFilter):
    title = "takedown"
    parameter_name = "takedown"

    def lookups(
        self, request: HttpRequest, model_admin: admin.ModelAdmin[Any]
    ) -> list[tuple[str, str]]:
        del request, model_admin
        return [("yes", "Has takedown right"), ("no", "No takedown right")]

    def queryset(self, request: HttpRequest, queryset: QuerySet[Series]) -> QuerySet[Series]:
        del request
        if self.value() == "yes":
            return queryset.filter(rights__takedown=True).distinct()
        if self.value() == "no":
            return queryset.exclude(rights__takedown=True).distinct()
        return queryset


class SeriesTranslationInline(admin.TabularInline):  # type: ignore[type-arg]
    model = SeriesTranslation
    extra = 1


class SeasonInline(admin.TabularInline):  # type: ignore[type-arg]
    model = Season
    extra = 1


class EpisodeInline(admin.TabularInline):  # type: ignore[type-arg]
    model = Episode
    extra = 0
    ordering = ("season", "order")
    fields = (
        "season",
        "order",
        "public_id",
        "duration_seconds",
        "publication_status",
        "window_starts_at",
        "window_ends_at",
    )
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
        "public_id",
        "duration_seconds",
        "publication_status",
        "window_starts_at",
        "window_ends_at",
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


class EpisodeTranslationInline(admin.TabularInline):  # type: ignore[type-arg]
    model = EpisodeTranslation
    extra = 1


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "public_id",
        "english_title",
        "publication_status",
        "original_language",
        "editorial_rank",
        "age_rating",
    )
    list_filter = ("publication_status", "genres", "original_language", TakedownListFilter)
    search_fields = (
        "public_id",
        "translations__title",
        "rights__licensor",
        "rights__contract_reference",
    )
    inlines = (SeriesTranslationInline, SeasonInline, EpisodeInline, ContentRightInline)
    filter_horizontal = ("genres",)
    readonly_fields = ("public_id", "created_at", "updated_at")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "public_id",
                    "publication_status",
                    "editorial_rank",
                    "original_language",
                    "genres",
                    "artwork_url",
                )
            },
        ),
        (
            "Metadata (not used to age-gate anonymous catalog)",
            {"fields": ("age_rating", "content_warnings", "attribution")},
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Title")
    def english_title(self, obj: Series) -> str:
        return obj.english_title or "—"

    def save_related(self, request: HttpRequest, form: Any, formsets: Any, change: bool) -> None:
        super().save_related(request, form, formsets, change)
        form.instance.full_clean()


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("series", "number")
    search_fields = ("series__public_id", "series__translations__title")
    inlines = (SeasonEpisodeInline,)


@admin.register(Episode)
class EpisodeAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "public_id",
        "english_title_display",
        "series",
        "season",
        "order",
        "publication_status",
        "duration_seconds",
    )
    list_filter = ("publication_status",)
    search_fields = ("public_id", "translations__title", "series__public_id")
    inlines = (EpisodeTranslationInline,)
    readonly_fields = ("public_id", "created_at", "updated_at")
    ordering = ("series", "season__number", "order")

    @admin.display(description="Title")
    def english_title_display(self, obj: Episode) -> str:
        return obj.english_title or "—"

    def save_related(self, request: HttpRequest, form: Any, formsets: Any, change: bool) -> None:
        super().save_related(request, form, formsets, change)
        form.instance.full_clean()


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
    )
    list_filter = ("takedown", "exclusive", "drm_required")
    search_fields = ("licensor", "contract_reference", "series__public_id")

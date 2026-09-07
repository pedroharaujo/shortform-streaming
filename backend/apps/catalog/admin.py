from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import ForeignKey
from django.http import HttpRequest

from apps.catalog.audit import policy_snapshot, record_policy_revision
from apps.catalog.locking import lock_series_for_access
from apps.catalog.models import (
    ContentRight,
    ContentSegment,
    EditorialAccessRevision,
    Episode,
    EpisodeTranslation,
    Genre,
    Season,
    Series,
    SeriesTranslation,
)


class ImmutableOwnershipForm(forms.ModelForm):  # type: ignore[type-arg]
    """Persisted ownership is immutable, including in submitted inline forms."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            for field in ("series", "season"):
                if field in self.fields:
                    self.fields[field].disabled = True


class CatalogAccessAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    form = ImmutableOwnershipForm

    def changeform_view(
        self,
        request: HttpRequest,
        object_id: str | None = None,
        form_url: str = "",
        extra_context: dict[str, Any] | None = None,
    ) -> Any:
        # Serialize before Django constructs and validates forms and inlines.
        with transaction.atomic():
            if request.method == "POST" and object_id:
                obj = self.get_object(request, object_id)
                if obj is not None:
                    lock_series_for_access(obj.pk if isinstance(obj, Series) else obj.series_id)
            return super().changeform_view(request, object_id, form_url, extra_context)

    def _save_access_object(self, request: HttpRequest, obj: Any) -> None:
        before: dict[str, Any] = {}
        if obj.pk:
            persisted = type(obj).objects.get(pk=obj.pk)
            parent = lock_series_for_access(
                persisted.pk if isinstance(persisted, Series) else persisted.series_id
            )
            persisted.refresh_from_db()
            for field in ("series_id", "season_id"):
                if hasattr(persisted, field) and getattr(persisted, field) != getattr(obj, field):
                    raise ValidationError("Existing catalog ownership cannot be changed in Admin.")
            before = policy_snapshot(persisted)
        elif not isinstance(obj, Series):
            if isinstance(obj, Episode) and not obj.series_id:
                obj.series_id = obj.season.series_id
            parent = lock_series_for_access(obj.series_id)
        else:
            parent = None
        if not isinstance(obj, Series):
            assert parent is not None
            obj.series = parent
            if isinstance(obj, Episode):
                obj.season = Season.objects.get(pk=obj.season_id)
                obj.season.series = parent
        obj.full_clean()
        obj.save()
        record_policy_revision(request, obj, before)

    def save_model(self, request: HttpRequest, obj: Any, form: Any, change: bool) -> None:
        with transaction.atomic():
            self._save_access_object(request, obj)

    def save_formset(self, request: HttpRequest, form: Any, formset: Any, change: bool) -> None:
        with transaction.atomic():
            parent = form.instance
            lock_series_for_access(parent.pk if isinstance(parent, Series) else parent.series_id)
            instances = formset.save(commit=False)
            for obj in formset.deleted_objects:
                obj.delete()
            for obj in instances:
                if isinstance(obj, (Episode, Season, ContentRight)):
                    self._save_access_object(request, obj)
                else:
                    obj.save()
            formset.save_m2m()

    def delete_model(self, request: HttpRequest, obj: Any) -> None:
        with transaction.atomic():
            lock_series_for_access(obj.pk if isinstance(obj, Series) else obj.series_id)
            super().delete_model(request, obj)

    def delete_queryset(self, request: HttpRequest, queryset: Any) -> None:
        with transaction.atomic():
            field = "pk" if self.model is Series else "series_id"
            for series_id in sorted(set(queryset.values_list(field, flat=True))):
                lock_series_for_access(series_id)
            super().delete_queryset(request, queryset)


class SeasonInline(admin.TabularInline):  # type: ignore[type-arg]
    model = Season
    extra = 1


class EpisodeInline(admin.TabularInline):  # type: ignore[type-arg]
    form = ImmutableOwnershipForm
    model = Episode
    extra = 0
    ordering = ("season", "order")
    fields = (
        "season",
        "order",
        "title",
        "public_id",
        "duration_seconds",
        "publication_status",
        "access_mode",
        "coin_price",
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
        "title",
        "public_id",
        "duration_seconds",
        "publication_status",
        "access_mode",
        "coin_price",
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
        "storefronts",
        "original_languages",
        "subtitle_languages",
        "dub_languages",
        "free_access_permission",
        "rewarded_ad_permission",
        "coin_access_permission",
        "paid_promotion_permission",
        "starts_at",
        "ends_at",
        "exclusive",
        "takedown",
        "drm_required",
        "promotional_clip_permission",
        "revenue_share_rule_reference",
    )


class SeriesTranslationInline(admin.TabularInline):  # type: ignore[type-arg]
    model = SeriesTranslation
    extra = 0


class EpisodeTranslationInline(admin.TabularInline):  # type: ignore[type-arg]
    model = EpisodeTranslation
    extra = 0


@admin.register(ContentSegment)
class ContentSegmentAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    search_fields = ("name", "slug")

    def get_readonly_fields(self, request: HttpRequest, obj: Any = None) -> tuple[str, ...]:
        # Slugs select trusted audience eligibility. Membership changes belong to
        # SeriesAdmin, which holds the catalog parent lock through the edit.
        return ("slug",) if obj is not None else ()

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Series)
class SeriesAdmin(CatalogAccessAdmin):
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
    inlines = (SeasonInline, EpisodeInline, ContentRightInline, SeriesTranslationInline)
    filter_horizontal = ("genres", "content_segments")
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
            "Distribution",
            {
                "fields": (
                    "distribution_territories",
                    "distribution_platforms",
                    "distribution_storefronts",
                    "distribution_languages",
                    "original_language",
                    "content_segments",
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


@admin.register(Season)
class SeasonAdmin(CatalogAccessAdmin):
    list_display = ("series", "number")
    search_fields = ("series__public_id", "series__title")
    inlines = (SeasonEpisodeInline,)


@admin.register(Episode)
class EpisodeAdmin(CatalogAccessAdmin):
    inlines = (EpisodeTranslationInline,)
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


@admin.register(ContentRight)
class ContentRightAdmin(CatalogAccessAdmin):
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


@admin.register(EditorialAccessRevision)
class EditorialAccessRevisionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("created_at", "series", "episode", "actor", "policy_version")
    readonly_fields = (
        "series",
        "episode",
        "actor",
        "before",
        "after",
        "policy_version",
        "created_at",
    )

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.db import models, transaction
from django.http import HttpRequest

from apps.accounts.authentication import FirebaseAuthenticationFailed
from apps.accounts.models import UserProfile
from apps.accounts.profiles import lock_current_profile
from apps.catalog.locking import lock_episode_for_access
from apps.catalog.models import Episode
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement


def _lock_targets(profile_ids: set[int], episode_ids: set[int]) -> None:
    profiles = list(UserProfile.objects.filter(pk__in=profile_ids).order_by("pk"))
    if {profile.pk for profile in profiles} != profile_ids:
        raise PermissionDenied
    for profile in profiles:
        try:
            lock_current_profile(profile)
        except FirebaseAuthenticationFailed:
            raise PermissionDenied from None
    episodes = list(
        Episode.objects.filter(pk__in=episode_ids)
        .order_by("series_id", "pk")
        .values_list("pk", flat=True)
    )
    if set(episodes) != episode_ids:
        raise PermissionDenied
    for episode_id in episodes:
        if lock_episode_for_access(episode_id) is None:
            raise PermissionDenied


def _posted_id(request: HttpRequest, field: str) -> int | None:
    value = request.POST.get(field, "")
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None
    return result if 0 < result < 2**63 else None


@admin.register(EpisodeEntitlement)
class EpisodeEntitlementAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Manual grants share access locks; financial grants are read-only."""

    list_display = ("id", "user_profile", "episode", "source", "granted_at")
    list_filter = ("source",)
    search_fields = ("user_profile__public_id", "episode__public_id")
    readonly_fields = ("granted_at",)
    fields = ("user_profile", "episode", "source", "granted_at")
    ordering = ("-granted_at",)

    def get_changeform_initial_data(self, request: HttpRequest) -> dict[str, str | list[str]]:
        del request
        return {"source": EntitlementSource.STAFF}

    def formfield_for_choice_field(
        self, db_field: models.Field[Any, Any], request: HttpRequest, **kwargs: Any
    ) -> Any:
        if db_field.name == "source":
            kwargs["choices"] = [
                (value, label)
                for value, label in EntitlementSource.choices
                if value != EntitlementSource.COIN
            ]
        return super().formfield_for_choice_field(db_field, request, **kwargs)

    def get_readonly_fields(
        self, request: HttpRequest, obj: EpisodeEntitlement | None = None
    ) -> tuple[str, ...]:
        del request
        if obj is not None:
            return ("user_profile", "episode", "granted_at")
        return ("granted_at",)

    def has_change_permission(
        self, request: HttpRequest, obj: EpisodeEntitlement | None = None
    ) -> bool:
        return (
            obj is None or obj.source != EntitlementSource.COIN
        ) and super().has_change_permission(request, obj)

    def has_delete_permission(
        self, request: HttpRequest, obj: EpisodeEntitlement | None = None
    ) -> bool:
        return (
            obj is None or obj.source != EntitlementSource.COIN
        ) and super().has_delete_permission(request, obj)

    def changeform_view(
        self,
        request: HttpRequest,
        object_id: str | None = None,
        form_url: str = "",
        extra_context: dict[str, Any] | None = None,
    ) -> Any:
        with transaction.atomic():
            if request.method == "POST":
                if object_id is not None:
                    obj = self.get_object(request, object_id)
                    if obj is not None:
                        _lock_targets({obj.user_profile_id}, {obj.episode_id})
                else:
                    profile_id = _posted_id(request, "user_profile")
                    episode_id = _posted_id(request, "episode")
                    if profile_id is not None and episode_id is not None:
                        # Lock before form uniqueness checks. A concurrent coin
                        # grant must become a form conflict, never an overwrite.
                        _lock_targets({profile_id}, {episode_id})
            return super().changeform_view(request, object_id, form_url, extra_context)

    def save_model(
        self, request: HttpRequest, obj: EpisodeEntitlement, form: Any, change: bool
    ) -> None:
        with transaction.atomic():
            _lock_targets({obj.user_profile_id}, {obj.episode_id})
            if obj.source == EntitlementSource.COIN:
                raise PermissionDenied
            if obj.pk is not None:
                persisted = EpisodeEntitlement.objects.select_for_update().get(pk=obj.pk)
                if (
                    persisted.source == EntitlementSource.COIN
                    or persisted.user_profile_id != obj.user_profile_id
                    or persisted.episode_id != obj.episode_id
                ):
                    raise PermissionDenied
            super().save_model(request, obj, form, change)

    def delete_view(
        self, request: HttpRequest, object_id: str, extra_context: dict[str, Any] | None = None
    ) -> Any:
        with transaction.atomic():
            if request.method == "POST":
                obj = self.get_object(request, object_id)
                if obj is not None:
                    _lock_targets({obj.user_profile_id}, {obj.episode_id})
            return super().delete_view(request, object_id, extra_context)

    def delete_model(self, request: HttpRequest, obj: EpisodeEntitlement) -> None:
        self.delete_queryset(request, EpisodeEntitlement.objects.filter(pk=obj.pk))

    def delete_queryset(
        self, request: HttpRequest, queryset: models.QuerySet[EpisodeEntitlement]
    ) -> None:
        with transaction.atomic():
            selected = list(queryset)
            _lock_targets(
                {obj.user_profile_id for obj in selected}, {obj.episode_id for obj in selected}
            )
            fresh = EpisodeEntitlement.objects.select_for_update().filter(
                pk__in=[obj.pk for obj in selected]
            )
            if any(obj.source == EntitlementSource.COIN for obj in fresh):
                raise PermissionDenied
            super().delete_queryset(request, fresh)

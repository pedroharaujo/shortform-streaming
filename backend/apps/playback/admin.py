from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase

from apps.playback.exceptions import VideoProviderError
from apps.playback.ingest import ingest_master, reconcile, takedown_asset
from apps.playback.models import MediaAsset
from apps.playback.redact import sanitize_diagnostic


class MediaAssetCreateForm(forms.ModelForm):  # type: ignore[type-arg]
    master_file = forms.FileField(
        help_text="Vertical master. Django does not store or serve these bytes.",
    )
    captions_file = forms.FileField(
        required=False,
        help_text="Optional WebVTT sidecar. Required before the asset can become ready.",
    )
    expected_checksum = forms.CharField(
        required=False,
        max_length=64,
        help_text="Optional SHA-256 hex of the master. Rejected on mismatch.",
    )
    ingested_asset: MediaAsset | None = None

    class Meta:
        model = MediaAsset
        fields = ("episode", "captions_language")

    def clean_expected_checksum(self) -> str:
        value = str(self.cleaned_data.get("expected_checksum") or "").strip().lower()
        if value and len(value) != 64:
            raise ValidationError("Expected checksum must be a SHA-256 hex digest.")
        return value

    def _post_clean(self) -> None:
        # Ingest creates and validates the row. Skip model.clean on the empty add instance.
        return

    def clean(self) -> dict[str, Any]:
        cleaned = super().clean() or {}
        if self.errors:
            return cleaned
        master = cleaned.get("master_file")
        episode = cleaned.get("episode")
        if master is None or episode is None:
            return cleaned
        video_bytes = master.read()
        captions = cleaned.get("captions_file")
        captions_bytes = captions.read() if captions is not None else None
        try:
            self.ingested_asset = ingest_master(
                episode=episode,
                video_bytes=video_bytes,
                captions_bytes=captions_bytes,
                captions_language=cleaned.get("captions_language") or "en",
                expected_checksum=cleaned.get("expected_checksum") or None,
            )
        except ValidationError:
            self.ingested_asset = None
            raise
        return cleaned

    def save(self, commit: bool = True) -> MediaAsset:
        del commit
        if self.ingested_asset is None:
            raise ValidationError("Upload was not ingested.")
        self.instance = self.ingested_asset
        self.save_m2m = lambda: None  # type: ignore[method-assign]
        return self.ingested_asset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "id",
        "episode",
        "state",
        "provider_name",
        "checksum_short",
        "has_captions",
        "thumbnail_count",
        "updated_at",
    )
    list_filter = ("state", "provider_name", "has_captions")
    search_fields = (
        "checksum",
        "provider_asset_id",
        "episode__public_id",
        "diagnostic_message",
    )
    actions = ("retry_selected", "takedown_selected")
    readonly_fields = (
        "episode",
        "checksum",
        "provider_name",
        "provider_asset_id",
        "state",
        "captions_language",
        "has_captions",
        "thumbnail_count",
        "duration_seconds",
        "renditions",
        "diagnostic_message",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)

    @admin.display(description="Checksum")
    def checksum_short(self, obj: MediaAsset) -> str:
        return obj.checksum[:12]

    def get_form(
        self,
        request: HttpRequest,
        obj: MediaAsset | None = None,
        change: bool = False,
        **kwargs: Any,
    ) -> Any:
        if obj is None:
            kwargs["form"] = MediaAssetCreateForm
        return super().get_form(request, obj, change=change, **kwargs)

    def get_fields(self, request: HttpRequest, obj: MediaAsset | None = None) -> tuple[str, ...]:
        del request
        if obj is None:
            return (
                "episode",
                "captions_language",
                "master_file",
                "captions_file",
                "expected_checksum",
            )
        return (
            "episode",
            "checksum",
            "provider_name",
            "provider_asset_id",
            "state",
            "captions_language",
            "has_captions",
            "thumbnail_count",
            "duration_seconds",
            "renditions",
            "diagnostic_message",
            "created_at",
            "updated_at",
        )

    def get_readonly_fields(
        self, request: HttpRequest, obj: MediaAsset | None = None
    ) -> tuple[str, ...]:
        del request
        if obj is None:
            return ()
        return (
            "episode",
            "checksum",
            "provider_name",
            "provider_asset_id",
            "state",
            "captions_language",
            "has_captions",
            "thumbnail_count",
            "duration_seconds",
            "renditions",
            "diagnostic_message",
            "created_at",
            "updated_at",
        )

    def has_delete_permission(self, request: HttpRequest, obj: MediaAsset | None = None) -> bool:
        del request, obj
        return False

    def save_model(self, request: HttpRequest, obj: MediaAsset, form: Any, change: bool) -> None:
        if change:
            obj.full_clean()
            super().save_model(request, obj, form, change)
            return
        ingested = getattr(form, "ingested_asset", None)
        if ingested is None:
            raise ValidationError("Upload was not ingested.")
        obj.pk = ingested.pk
        obj._state.adding = False
        obj.refresh_from_db()

    def save_related(self, request: HttpRequest, form: Any, formsets: Any, change: bool) -> None:
        if not change:
            return
        super().save_related(request, form, formsets, change)
        form.instance.full_clean()

    @admin.action(description="Retry reconcile")
    def retry_selected(self, request: HttpRequest, queryset: QuerySet[MediaAsset]) -> None:
        for asset in queryset:
            try:
                reconcile(asset)
            except ValidationError as error:
                self.message_user(
                    request,
                    sanitize_diagnostic(str(error)),
                    level=messages.ERROR,
                )

    @admin.action(description="Takedown (delete provider asset)")
    def takedown_selected(
        self, request: HttpRequest, queryset: QuerySet[MediaAsset]
    ) -> HttpResponseBase:
        failed = 0
        succeeded = 0
        for asset in queryset:
            try:
                takedown_asset(asset)
                succeeded += 1
            except (ValidationError, VideoProviderError) as error:
                failed += 1
                self.message_user(
                    request,
                    sanitize_diagnostic(str(error)),
                    level=messages.ERROR,
                )
        if failed:
            self.message_user(
                request,
                f"{failed} takedown(s) could not complete. The asset was not marked removed.",
                level=messages.ERROR,
            )
        elif succeeded:
            self.message_user(
                request,
                f"{succeeded} asset(s) taken down.",
                level=messages.SUCCESS,
            )
        return HttpResponseRedirect(request.get_full_path())

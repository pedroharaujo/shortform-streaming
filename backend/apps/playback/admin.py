from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db.models import QuerySet
from django.http import Http404, HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.template.response import TemplateResponse
from django.urls import path, reverse

from apps.catalog.models import Episode
from apps.playback.exceptions import VideoProviderError
from apps.playback.ingest import (
    begin_staff_upload,
    complete_staff_upload,
    ingest_master,
    reconcile,
    takedown_asset,
)
from apps.playback.models import SHA256_HEX, MediaAsset
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


class StaffSignedUploadForm(forms.Form):
    episode = forms.ModelChoiceField(queryset=Episode.objects.all())
    expected_checksum = forms.CharField(
        max_length=64,
        help_text="SHA-256 hex of the master that will be PUT to object storage.",
    )
    captions_language = forms.CharField(max_length=2, initial="en")

    def clean_expected_checksum(self) -> str:
        value = str(self.cleaned_data.get("expected_checksum") or "").strip().lower()
        if not SHA256_HEX.fullmatch(value):
            raise ValidationError("Expected checksum must be a SHA-256 hex digest.")
        return value

    def clean_captions_language(self) -> str:
        return str(self.cleaned_data.get("captions_language") or "en").strip().lower() or "en"


class StaffCompleteUploadForm(forms.Form):
    captions_file = forms.FileField(
        required=False,
        help_text="Optional WebVTT sidecar. Required before the asset can become ready.",
    )


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
    change_list_template = "admin/playback/mediaasset/change_list.html"
    change_form_template = "admin/playback/mediaasset/change_form.html"

    def get_urls(self) -> list[Any]:
        info = self.opts.app_label, self.opts.model_name
        custom = [
            path(
                "signed-upload/",
                self.admin_site.admin_view(self.signed_upload_view),
                name=f"{info[0]}_{info[1]}_signed_upload",
            ),
            path(
                "<path:object_id>/complete-upload/",
                self.admin_site.admin_view(self.complete_upload_view),
                name=f"{info[0]}_{info[1]}_complete_upload",
            ),
        ]
        return custom + super().get_urls()

    def signed_upload_view(self, request: HttpRequest) -> HttpResponseBase:
        form = StaffSignedUploadForm(request.POST or None)
        signed_put_url: str | None = None
        expires_at = None
        asset: MediaAsset | None = None
        if request.method == "POST" and form.is_valid():
            try:
                asset, signed_put_url, expires_at = begin_staff_upload(
                    episode=form.cleaned_data["episode"],
                    expected_checksum=form.cleaned_data["expected_checksum"],
                    captions_language=form.cleaned_data.get("captions_language") or "en",
                )
            except ValidationError as error:
                form.add_error(None, error)
                signed_put_url = None
                asset = None
                expires_at = None
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "form": form,
            "signed_put_url": signed_put_url,
            "expires_at": expires_at,
            "asset": asset,
            "title": "Signed staff upload",
        }
        return TemplateResponse(
            request,
            "admin/playback/mediaasset/signed_upload.html",
            context,
        )

    def complete_upload_view(self, request: HttpRequest, object_id: str) -> HttpResponseBase:
        asset = self.get_object(request, object_id)
        if asset is None:
            raise Http404()
        form = StaffCompleteUploadForm(request.POST or None, request.FILES or None)
        if request.method == "POST" and form.is_valid():
            captions = form.cleaned_data.get("captions_file")
            captions_bytes = captions.read() if captions is not None else None
            try:
                complete_staff_upload(asset, captions_bytes=captions_bytes)
            except ValidationError as error:
                form.add_error(None, error)
            else:
                self.message_user(
                    request,
                    "Upload completed. Encoding started.",
                    level=messages.SUCCESS,
                )
                return HttpResponseRedirect(
                    reverse("admin:playback_mediaasset_change", args=[asset.pk])
                )
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "form": form,
            "original": asset,
            "title": "Complete signed upload",
        }
        return TemplateResponse(
            request,
            "admin/playback/mediaasset/complete_upload.html",
            context,
        )

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

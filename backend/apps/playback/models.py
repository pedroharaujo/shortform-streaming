from __future__ import annotations

import re
from typing import Any

from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

SHA256_HEX = re.compile(r"^[a-f0-9]{64}$")
ISO_639_1 = re.compile(r"^[a-z]{2}$")

IN_FLIGHT_STATES = frozenset({"pending_upload", "uploaded", "processing", "ready"})


class MediaAssetState(models.TextChoices):
    PENDING_UPLOAD = "pending_upload", "Pending upload"
    UPLOADED = "uploaded", "Uploaded"
    PROCESSING = "processing", "Processing"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"
    BLOCKED = "blocked", "Blocked"
    REMOVED = "removed", "Removed"


ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    MediaAssetState.PENDING_UPLOAD: frozenset(
        {
            MediaAssetState.PENDING_UPLOAD,
            MediaAssetState.UPLOADED,
            MediaAssetState.FAILED,
            MediaAssetState.BLOCKED,
            MediaAssetState.REMOVED,
        }
    ),
    MediaAssetState.UPLOADED: frozenset(
        {
            MediaAssetState.UPLOADED,
            MediaAssetState.PROCESSING,
            MediaAssetState.FAILED,
            MediaAssetState.BLOCKED,
            MediaAssetState.REMOVED,
        }
    ),
    MediaAssetState.PROCESSING: frozenset(
        {
            MediaAssetState.PROCESSING,
            MediaAssetState.READY,
            MediaAssetState.FAILED,
            MediaAssetState.BLOCKED,
            MediaAssetState.REMOVED,
        }
    ),
    MediaAssetState.READY: frozenset(
        {
            MediaAssetState.READY,
            MediaAssetState.BLOCKED,
            MediaAssetState.REMOVED,
        }
    ),
    MediaAssetState.FAILED: frozenset(
        {
            MediaAssetState.FAILED,
            MediaAssetState.PROCESSING,
            MediaAssetState.BLOCKED,
            MediaAssetState.REMOVED,
        }
    ),
    MediaAssetState.BLOCKED: frozenset(
        {
            MediaAssetState.BLOCKED,
            MediaAssetState.REMOVED,
        }
    ),
    MediaAssetState.REMOVED: frozenset({MediaAssetState.REMOVED}),
}


class MediaAsset(models.Model):
    """Provider-agnostic media row. Postgres stores ids and readiness, not CDN files.

    Unique rule: at most one in-flight or ready row per episode (any checksum).
    Same checksum + episode reuses that row. Failed/blocked/removed rows are history.
    Django never stores or serves the uploaded bytes.
    """

    episode = models.ForeignKey(
        "catalog.Episode",
        on_delete=models.CASCADE,
        related_name="media_assets",
    )
    checksum = models.CharField(
        max_length=64,
        help_text="SHA-256 hex digest of the uploaded master bytes.",
    )
    provider_name = models.CharField(max_length=32)
    provider_asset_id = models.CharField(max_length=128, blank=True, default="")
    state = models.CharField(
        max_length=16,
        choices=MediaAssetState.choices,
        default=MediaAssetState.PENDING_UPLOAD,
        db_index=True,
    )
    captions_language = models.CharField(
        max_length=2,
        default="en",
        help_text="ISO 639-1 language of the sidecar captions.",
    )
    has_captions = models.BooleanField(default=False)
    thumbnail_count = models.PositiveIntegerField(default=0)
    duration_seconds = models.FloatField(null=True, blank=True)
    renditions = ArrayField(models.CharField(max_length=16), blank=True, default=list)
    diagnostic_message = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Safe, redacted staff diagnostic. Never keys, payloads, or signed URLs.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "id")
        indexes = [
            models.Index(fields=("episode", "state")),
            models.Index(fields=("checksum",)),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("episode", "checksum"),
                condition=Q(
                    state__in=(
                        "pending_upload",
                        "uploaded",
                        "processing",
                        "ready",
                    )
                ),
                name="playback_mediaasset_unique_active_checksum",
            ),
            models.UniqueConstraint(
                fields=("episode",),
                condition=Q(
                    state__in=(
                        "pending_upload",
                        "uploaded",
                        "processing",
                        "ready",
                    )
                ),
                name="playback_mediaasset_one_active_per_episode",
            ),
            models.UniqueConstraint(
                fields=("episode",),
                condition=Q(state=MediaAssetState.READY),
                name="playback_mediaasset_one_ready_per_episode",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.episode_id} · {self.state} · {self.checksum[:12]}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.checksum = self.checksum.strip().lower()
        self.captions_language = self.captions_language.strip().lower()
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        checksum = self.checksum.strip().lower()
        if not SHA256_HEX.fullmatch(checksum):
            errors["checksum"] = "Checksum must be a SHA-256 hex digest."
        self.checksum = checksum
        language = self.captions_language.strip().lower()
        if not ISO_639_1.fullmatch(language):
            errors["captions_language"] = "Caption language must be ISO 639-1."
        self.captions_language = language
        if self.state == MediaAssetState.READY and not self.provider_asset_id.strip():
            errors["provider_asset_id"] = "A ready asset requires a provider asset id."
        if errors:
            raise ValidationError(errors)

    def transition_to(self, new_state: str) -> None:
        allowed = ALLOWED_TRANSITIONS.get(self.state, frozenset())
        if new_state not in allowed:
            raise ValidationError(
                {"state": f"Illegal media-asset transition {self.state} → {new_state}."}
            )
        self.state = new_state

    def mark_failed(self, diagnostic: str) -> None:
        from django.db import IntegrityError

        from apps.playback.redact import sanitize_diagnostic

        self.diagnostic_message = sanitize_diagnostic(diagnostic)
        if self.state != MediaAssetState.FAILED:
            self.transition_to(MediaAssetState.FAILED)
        try:
            self.save()
        except IntegrityError:
            type(self).objects.filter(pk=self.pk).update(
                state=MediaAssetState.FAILED,
                diagnostic_message=self.diagnostic_message,
            )
            self.refresh_from_db()

    @property
    def is_ready(self) -> bool:
        return self.state == MediaAssetState.READY

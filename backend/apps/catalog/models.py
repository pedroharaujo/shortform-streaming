from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.catalog.public_ids import (
    EPISODE_PUBLIC_ID_PREFIX,
    SERIES_PUBLIC_ID_PREFIX,
    generate_public_id,
)

MVP_CATALOG_LANGUAGE = "en"
MVP_DISTRIBUTION_COUNTRY = "FR"
MVP_PLATFORM = "android"
ISO_3166_1_ALPHA_2 = re.compile(r"^[A-Za-z]{2}$")
ISO_639_1 = re.compile(r"^[A-Za-z]{2}$")
ALLOWED_PLATFORMS = frozenset({"ios", "android"})


class PublicationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"


def _dedupe_codes(values: list[str] | None, transform: Callable[[str], str]) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        code = transform(raw.strip())
        if code in seen:
            continue
        seen.add(code)
        normalized.append(code)
    return normalized


def normalize_territory_codes(values: list[str] | None) -> list[str]:
    return _dedupe_codes(values, str.upper)


def normalize_language_codes(values: list[str] | None) -> list[str]:
    return _dedupe_codes(values, str.lower)


def normalize_platforms(values: list[str] | None) -> list[str]:
    return _dedupe_codes(values, str.lower)


def _validate_territory_codes(values: list[str], field_name: str) -> None:
    if any(not ISO_3166_1_ALPHA_2.fullmatch(code) for code in values):
        raise ValidationError({field_name: "Territory codes must be ISO 3166-1 alpha-2."})


def _validate_language_codes(values: list[str], field_name: str) -> None:
    if any(not ISO_639_1.fullmatch(code) for code in values):
        raise ValidationError({field_name: "Language codes must be ISO 639-1 (two letters)."})


class Genre(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Series(models.Model):
    """Self-owned or licensed English series for the France/Android MVP."""

    public_id = models.CharField(max_length=40, unique=True, editable=False)
    title = models.CharField(max_length=200, blank=True, default="")
    synopsis = models.TextField(blank=True, default="")
    publication_status = models.CharField(
        max_length=16,
        choices=PublicationStatus.choices,
        default=PublicationStatus.DRAFT,
        db_index=True,
    )
    editorial_rank = models.IntegerField(
        default=0,
        help_text="Lower values appear first on home, then public_id.",
    )
    original_language = models.CharField(
        max_length=2,
        default=MVP_CATALOG_LANGUAGE,
        help_text="ISO 639-1 original language. MVP catalog language is English.",
    )
    artwork_url = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="URL or path metadata only. Do not store binary artwork here.",
    )
    age_rating = models.CharField(
        max_length=16,
        blank=True,
        default="",
        help_text="Optional metadata. Anonymous catalog GET does not age-gate.",
    )
    content_warnings = models.TextField(blank=True, default="")
    attribution = models.TextField(blank=True, default="")
    genres = models.ManyToManyField(Genre, blank=True, related_name="series")
    self_owned = models.BooleanField(
        default=False,
        help_text="Select the provenance path; otherwise publication requires a licensed right.",
    )
    provenance_reference = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Opaque reference to the private ownership/component-provenance record.",
    )
    promotional_use_approved = models.BooleanField(
        default=False,
        help_text="Confirms promotional use for self-owned material.",
    )
    takedown = models.BooleanField(default=False, db_index=True)
    free_episode_count = models.PositiveIntegerField(
        default=5,
        help_text="Episodes 1 through this order are free in each season.",
    )
    rewarded_ads_enabled = models.BooleanField(
        default=True,
        help_text="Server-side kill switch for rewarded-ad offers on this series.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "series"
        ordering = ("editorial_rank", "public_id")

    def __str__(self) -> str:
        return self.title or self.public_id

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.public_id:
            self.public_id = generate_public_id(SERIES_PUBLIC_ID_PREFIX)
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        if self.publication_status != PublicationStatus.PUBLISHED:
            return
        errors: dict[str, str] = {}
        if not self.title.strip():
            errors["title"] = "Publishing requires an English title."
        if not self.synopsis.strip():
            errors["synopsis"] = "Publishing requires an English synopsis."
        if self.takedown:
            errors["takedown"] = "A taken-down series cannot be published."
        if self.self_owned:
            if not self.provenance_reference.strip():
                errors["provenance_reference"] = (
                    "Publishing self-owned content requires a private provenance reference."
                )
            if not self.promotional_use_approved:
                errors["promotional_use_approved"] = (
                    "Promotional use must be approved before publication."
                )
        elif not self.has_publishable_right():
            errors["publication_status"] = (
                "Publishing licensed content requires a structurally valid, non-takedown "
                "ContentRight with promotional-use permission."
            )
        if errors:
            raise ValidationError(errors)

    def is_publishable(self) -> bool:
        if not self.title.strip() or not self.synopsis.strip() or self.takedown:
            return False
        if self.self_owned:
            return bool(self.provenance_reference.strip()) and self.promotional_use_approved
        return self.has_publishable_right()

    def has_publishable_right(self) -> bool:
        return bool(self.pk) and any(
            right.is_structurally_publishable() for right in self.rights.all()
        )


class Season(models.Model):
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name="seasons")
    number = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("series", "number"), name="catalog_season_unique_number"
            ),
        ]
        ordering = ("number",)

    def __str__(self) -> str:
        return f"{self.series} · season {self.number}"


class SeriesTranslation(models.Model):  # noqa: DJ008
    """Dormant pre-MVP-simplification rows retained for safe cascaded deletion."""

    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(
        max_length=2, help_text="ISO 639-1. English is required to publish."
    )
    title = models.CharField(max_length=200)
    synopsis = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("series", "language"),
                name="catalog_seriestranslation_unique_language",
            ),
        ]
        ordering = ("language",)


class Episode(models.Model):
    """English episode metadata; playback still requires a ready provider asset."""

    public_id = models.CharField(max_length=40, unique=True, editable=False)
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name="episodes")
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="episodes")
    order = models.PositiveIntegerField(help_text="1-based order unique within the season.")
    title = models.CharField(max_length=200, blank=True, default="")
    synopsis = models.TextField(blank=True, default="")
    duration_seconds = models.PositiveIntegerField(default=0)
    publication_status = models.CharField(
        max_length=16,
        choices=PublicationStatus.choices,
        default=PublicationStatus.DRAFT,
        db_index=True,
    )
    window_starts_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional publication window start (inclusive).",
    )
    window_ends_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional publication window end (exclusive). Null is open-ended.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("season", "order"),
                name="catalog_episode_unique_season_order",
            ),
            models.CheckConstraint(
                condition=(
                    Q(window_ends_at__isnull=True)
                    | Q(window_starts_at__isnull=True)
                    | Q(window_starts_at__lt=models.F("window_ends_at"))
                ),
                name="catalog_episode_window_start_before_end",
            ),
        ]
        ordering = ("season__number", "order")

    def __str__(self) -> str:
        return self.title or self.public_id

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.public_id:
            self.public_id = generate_public_id(EPISODE_PUBLIC_ID_PREFIX)
        if self.season_id and not self.series_id:
            self.series_id = self.season.series_id
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        if self.season_id and self.series_id and self.season.series_id != self.series_id:
            raise ValidationError({"season": "Season must belong to the same series."})
        if self.season_id and not self.series_id:
            self.series_id = self.season.series_id
        if self.publication_status != PublicationStatus.PUBLISHED:
            return
        errors: dict[str, str] = {}
        if self.duration_seconds < 1:
            errors["duration_seconds"] = "Publishing requires a positive duration."
        if not self.title.strip():
            errors["title"] = "Publishing requires an English episode title."
        if not self.synopsis.strip():
            errors["synopsis"] = "Publishing requires an English episode synopsis."
        if not self.series.is_publishable():
            errors["publication_status"] = (
                "The parent series must pass its self-owned or licensed publication gate."
            )
        if not self.has_ready_media_asset():
            errors["publication_status"] = "Publishing requires a ready media asset."
        if errors:
            raise ValidationError(errors)

    def has_ready_media_asset(self) -> bool:
        if not self.pk:
            return False
        from apps.playback.models import MediaAssetState

        return self.media_assets.filter(state=MediaAssetState.READY).exists()


class EpisodeTranslation(models.Model):  # noqa: DJ008
    """Dormant pre-MVP-simplification rows retained for safe cascaded deletion."""

    episode = models.ForeignKey(Episode, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=2)
    title = models.CharField(max_length=200)
    synopsis = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("episode", "language"),
                name="catalog_episodetranslation_unique_language",
            ),
        ]
        ordering = ("language",)


class ContentRight(models.Model):  # noqa: DJ008
    """Licensed-series grant metadata with opaque private-system references only."""

    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name="rights")
    licensor = models.CharField(
        max_length=200,
        help_text="Licensor display/reference name. Use synthetic values in this repository.",
    )
    contract_reference = models.CharField(
        max_length=200,
        help_text="Opaque private-system contract reference. Never store rates.",
    )
    territory_allowlist = ArrayField(
        models.CharField(max_length=2),
        help_text="ISO 3166-1 alpha-2 codes. Empty allowlists are invalid.",
    )
    territory_denylist = ArrayField(
        models.CharField(max_length=2),
        blank=True,
        default=list,
        help_text="ISO 3166-1 alpha-2 codes subtracted from the allowlist.",
    )
    platforms = ArrayField(
        models.CharField(max_length=16),
        help_text="Granted platforms. MVP values: ios, android.",
    )
    languages = ArrayField(
        models.CharField(max_length=2),
        help_text="Licensed original/subtitle/dub language codes (ISO 639-1).",
    )
    starts_at = models.DateTimeField(help_text="Rights window start (inclusive).")
    ends_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Rights window end (exclusive). Null means open-ended.",
    )
    exclusive = models.BooleanField(default=False)
    takedown = models.BooleanField(default=False, db_index=True)
    drm_required = models.BooleanField(
        default=False,
        help_text="DRM-required grants fail closed until a compliant provider is approved.",
    )
    revenue_share_rule_reference = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Opaque private-system rule reference. Never store rates.",
    )
    promotional_clip_permission = models.BooleanField(
        default=False,
        help_text="Required before a licensed series can publish or appear in promotion.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True) | Q(starts_at__lt=models.F("ends_at")),
                name="catalog_contentright_window_start_before_end",
            ),
            models.CheckConstraint(
                condition=Q(territory_allowlist__len__gt=0),
                name="catalog_contentright_allowlist_not_empty",
            ),
            models.CheckConstraint(
                condition=Q(platforms__len__gt=0),
                name="catalog_contentright_platforms_not_empty",
            ),
            models.CheckConstraint(
                condition=Q(languages__len__gt=0),
                name="catalog_contentright_languages_not_empty",
            ),
        ]
        ordering = ("starts_at", "id")

    def __str__(self) -> str:
        status = "takedown" if self.takedown else "active"
        return f"{self.licensor} ({status})"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.territory_allowlist = normalize_territory_codes(self.territory_allowlist)
        self.territory_denylist = normalize_territory_codes(self.territory_denylist)
        self.platforms = normalize_platforms(self.platforms)
        self.languages = normalize_language_codes(self.languages)
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        self.territory_allowlist = normalize_territory_codes(self.territory_allowlist)
        self.territory_denylist = normalize_territory_codes(self.territory_denylist)
        self.platforms = normalize_platforms(self.platforms)
        self.languages = normalize_language_codes(self.languages)

        errors: dict[str, str] = {}
        if not self.licensor.strip():
            errors["licensor"] = "Licensor is required."
        if not self.contract_reference.strip():
            errors["contract_reference"] = "Opaque contract reference is required."
        if not self.territory_allowlist:
            errors["territory_allowlist"] = "Territory allowlist must contain at least one code."
        else:
            try:
                _validate_territory_codes(self.territory_allowlist, "territory_allowlist")
            except ValidationError as exc:
                errors["territory_allowlist"] = exc.message_dict["territory_allowlist"][0]
        if self.territory_denylist:
            try:
                _validate_territory_codes(self.territory_denylist, "territory_denylist")
            except ValidationError as exc:
                errors["territory_denylist"] = exc.message_dict["territory_denylist"][0]
        if not self.platforms:
            errors["platforms"] = "At least one platform is required."
        elif set(self.platforms) - ALLOWED_PLATFORMS:
            errors["platforms"] = "Platforms must be ios and/or android."
        if not self.languages:
            errors["languages"] = "At least one language grant is required."
        else:
            try:
                _validate_language_codes(self.languages, "languages")
            except ValidationError as exc:
                errors["languages"] = exc.message_dict["languages"][0]
        if (
            self.starts_at is not None
            and self.ends_at is not None
            and self.starts_at >= self.ends_at
        ):
            errors["ends_at"] = "Rights window end must be after start (end is exclusive)."
        if errors:
            raise ValidationError(errors)

    def is_structurally_publishable(self) -> bool:
        return (
            not self.takedown
            and self.promotional_clip_permission
            and bool(self.licensor.strip())
            and bool(self.contract_reference.strip())
            and bool(self.territory_allowlist)
            and all(ISO_3166_1_ALPHA_2.fullmatch(code) for code in self.territory_allowlist)
            and all(ISO_3166_1_ALPHA_2.fullmatch(code) for code in self.territory_denylist)
            and bool(self.platforms)
            and not (set(self.platforms) - ALLOWED_PLATFORMS)
            and bool(self.languages)
            and all(ISO_639_1.fullmatch(code) for code in self.languages)
            and self.starts_at is not None
            and (self.ends_at is None or self.starts_at < self.ends_at)
        )

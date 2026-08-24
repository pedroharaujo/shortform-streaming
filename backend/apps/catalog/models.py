from __future__ import annotations

import re
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

ISO_3166_1_ALPHA_2 = re.compile(r"^[A-Za-z]{2}$")
ISO_639_1 = re.compile(r"^[A-Za-z]{2}$")
REQUIRED_CATALOG_LANGUAGE = "en"
ALLOWED_PLATFORMS = frozenset({"ios", "android"})


class PublicationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"


class Platform(models.TextChoices):
    IOS = "ios", "iOS"
    ANDROID = "android", "Android"


def normalize_territory_codes(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        code = raw.strip().upper()
        if code in seen:
            continue
        seen.add(code)
        normalized.append(code)
    return normalized


def normalize_language_codes(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        code = raw.strip().lower()
        if code in seen:
            continue
        seen.add(code)
        normalized.append(code)
    return normalized


def normalize_platforms(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        code = raw.strip().lower()
        if code in seen:
            continue
        seen.add(code)
        normalized.append(code)
    return normalized


def _validate_territory_codes(values: list[str], field_name: str) -> None:
    invalid = [code for code in values if not ISO_3166_1_ALPHA_2.fullmatch(code)]
    if invalid:
        raise ValidationError({field_name: "Territory codes must be ISO 3166-1 alpha-2."})


def _validate_language_codes(values: list[str], field_name: str) -> None:
    invalid = [code for code in values if not ISO_639_1.fullmatch(code)]
    if invalid:
        raise ValidationError({field_name: "Language codes must be ISO 639-1 (two letters)."})


class Genre(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Series(models.Model):
    """Editorial series. Eligibility for anonymous catalog is evaluated at request time.

    Publish rule (P2-T03): a series may be stored as published only when it has an
    English translation (title + synopsis) and at least one structurally valid,
    non-takedown ContentRight (licensor, opaque contract_reference, window,
    territory allowlist, platforms, languages). Expired windows do not block the
    published flag; the public API hides ineligible titles at read time.
    Age rating is stored as metadata only; anonymous GET is not age-gated (D-003).
    """

    public_id = models.CharField(max_length=40, unique=True, editable=False)
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
        default=REQUIRED_CATALOG_LANGUAGE,
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "series"
        ordering = ("editorial_rank", "public_id")

    def __str__(self) -> str:
        return self.english_title or self.public_id

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.public_id:
            self.public_id = generate_public_id(SERIES_PUBLIC_ID_PREFIX)
        self.original_language = self.original_language.strip().lower()
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        language = self.original_language.strip().lower()
        if not ISO_639_1.fullmatch(language):
            raise ValidationError({"original_language": "Original language must be ISO 639-1."})
        self.original_language = language
        if self.publication_status != PublicationStatus.PUBLISHED:
            return
        if not self.pk:
            raise ValidationError(
                {
                    "publication_status": (
                        "Save the series as a draft, add an English translation and a valid "
                        "non-takedown ContentRight, then publish."
                    )
                }
            )
        self.validate_publish_requirements()

    def validate_publish_requirements(self) -> None:
        english = self.translations.filter(language=REQUIRED_CATALOG_LANGUAGE).first()
        if english is None or not english.title.strip() or not english.synopsis.strip():
            raise ValidationError(
                {
                    "publication_status": (
                        "Publishing requires an English title and synopsis "
                        f"(language={REQUIRED_CATALOG_LANGUAGE})."
                    )
                }
            )
        if not self.has_publishable_right():
            raise ValidationError(
                {
                    "publication_status": (
                        "Publishing requires at least one non-takedown ContentRight with "
                        "licensor, contract_reference, starts_at, territory allowlist, "
                        "platforms, and languages."
                    )
                }
            )

    def has_publishable_right(self) -> bool:
        return any(right.is_structurally_publishable() for right in self.rights.all())

    @property
    def english_title(self) -> str:
        if not self.pk:
            return ""
        translation = self.translations.filter(language=REQUIRED_CATALOG_LANGUAGE).first()
        return translation.title if translation else ""


class SeriesTranslation(models.Model):
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(
        max_length=2, help_text="ISO 639-1. English is required to publish."
    )
    title = models.CharField(max_length=200)
    synopsis = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("series", "language"), name="catalog_seriestranslation_unique_language"
            ),
        ]
        ordering = ("language",)

    def __str__(self) -> str:
        return f"{self.language}: {self.title}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.language = self.language.strip().lower()
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        language = self.language.strip().lower()
        if not ISO_639_1.fullmatch(language):
            raise ValidationError({"language": "Language must be ISO 639-1."})
        self.language = language
        if not self.title.strip():
            raise ValidationError({"title": "Title is required."})
        if not self.synopsis.strip():
            raise ValidationError({"synopsis": "Synopsis is required."})


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


class Episode(models.Model):
    """Episode metadata. Monetization lock state is omitted (P3 / P2-T04).

    Publish rule: English title + synopsis, positive duration, valid optional
    window, and the parent series must have a structurally valid non-takedown
    ContentRight. MediaAsset readiness is not a publish gate in P2-T03 (P2-T06).
    """

    public_id = models.CharField(max_length=40, unique=True, editable=False)
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name="episodes")
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="episodes")
    order = models.PositiveIntegerField(help_text="1-based order unique within the season.")
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
        return self.english_title or self.public_id

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
        if (
            self.window_starts_at is not None
            and self.window_ends_at is not None
            and self.window_starts_at >= self.window_ends_at
        ):
            raise ValidationError({"window_ends_at": "Episode window end must be after start."})
        if self.publication_status != PublicationStatus.PUBLISHED:
            return
        if not self.pk:
            raise ValidationError(
                {
                    "publication_status": (
                        "Save the episode as a draft, add an English translation, then publish."
                    )
                }
            )
        self.validate_publish_requirements()

    def validate_publish_requirements(self) -> None:
        if self.duration_seconds < 1:
            raise ValidationError({"duration_seconds": "Publishing requires a positive duration."})
        english = self.translations.filter(language=REQUIRED_CATALOG_LANGUAGE).first()
        if english is None or not english.title.strip() or not english.synopsis.strip():
            raise ValidationError(
                {
                    "publication_status": (
                        "Publishing requires an English episode title and synopsis."
                    )
                }
            )
        series = self.series
        if not series.has_publishable_right():
            raise ValidationError(
                {
                    "publication_status": (
                        "Publishing an episode requires the series to have a valid "
                        "non-takedown ContentRight."
                    )
                }
            )

    @property
    def english_title(self) -> str:
        if not self.pk:
            return ""
        translation = self.translations.filter(language=REQUIRED_CATALOG_LANGUAGE).first()
        return translation.title if translation else ""


class EpisodeTranslation(models.Model):
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

    def __str__(self) -> str:
        return f"{self.language}: {self.title}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.language = self.language.strip().lower()
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        language = self.language.strip().lower()
        if not ISO_639_1.fullmatch(language):
            raise ValidationError({"language": "Language must be ISO 639-1."})
        self.language = language
        if not self.title.strip():
            raise ValidationError({"title": "Title is required."})
        if not self.synopsis.strip():
            raise ValidationError({"synopsis": "Synopsis is required."})


class ContentRight(models.Model):
    """Series-level rights grant. Opaque contract references only; never rates or PII.

    Language grant: `languages` is the licensed original/subtitle/dub grant. A request
    is eligible only when X-Language is in this list. Series.original_language is
    metadata and is not an implicit grant.
    """

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
        help_text="Stored for D-019; catalog GET does not enforce DRM.",
    )
    revenue_share_rule_reference = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Opaque private-system rule reference. Never store rates.",
    )
    promotional_clip_permission = models.BooleanField(default=False)
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
            errors["contract_reference"] = "Opaque contract_reference is required."
        if not self.territory_allowlist:
            errors["territory_allowlist"] = "Territory allowlist must contain at least one code."
        else:
            try:
                _validate_territory_codes(self.territory_allowlist, "territory_allowlist")
            except ValidationError as exc:
                errors.update(
                    {str(key): str(messages[0]) for key, messages in exc.message_dict.items()}
                )
        if self.territory_denylist:
            try:
                _validate_territory_codes(self.territory_denylist, "territory_denylist")
            except ValidationError as exc:
                errors.update(
                    {str(key): str(messages[0]) for key, messages in exc.message_dict.items()}
                )
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
                errors.update(
                    {str(key): str(messages[0]) for key, messages in exc.message_dict.items()}
                )
        if (
            self.ends_at is not None
            and self.starts_at is not None
            and self.starts_at >= self.ends_at
        ):
            errors["ends_at"] = "Rights window end must be after start (end is exclusive)."
        if errors:
            raise ValidationError(errors)

    def is_structurally_publishable(self) -> bool:
        if self.takedown:
            return False
        if not self.licensor.strip() or not self.contract_reference.strip():
            return False
        if not self.territory_allowlist or not self.platforms or not self.languages:
            return False
        if self.ends_at is not None and self.starts_at >= self.ends_at:
            return False
        return True

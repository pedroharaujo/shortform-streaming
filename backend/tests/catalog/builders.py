from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

from apps.catalog.models import (
    REQUIRED_CATALOG_LANGUAGE,
    ContentRight,
    Episode,
    EpisodeTranslation,
    Genre,
    PublicationStatus,
    Season,
    Series,
    SeriesTranslation,
)
from apps.playback.models import MediaAsset, MediaAssetState

DEFAULT_NOW = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)


def make_genre(*, name: str = "Revenge") -> Genre:
    slug = name.lower().replace(" ", "-")
    genre, _created = Genre.objects.get_or_create(name=name, defaults={"slug": slug})
    return genre


def make_series(
    *,
    title: str = "Synthetic Series",
    synopsis: str = "Generated synopsis for automated tests.",
    original_language: str = REQUIRED_CATALOG_LANGUAGE,
    editorial_rank: int = 0,
    artwork_url: str = "",
    public_id: str | None = None,
) -> Series:
    series = Series(
        publication_status=PublicationStatus.DRAFT,
        original_language=original_language,
        editorial_rank=editorial_rank,
        artwork_url=artwork_url,
        age_rating="16+",
        content_warnings="Synthetic fixture.",
        attribution="Generated metadata.",
    )
    if public_id is not None:
        series.public_id = public_id
    series.save()
    SeriesTranslation.objects.create(
        series=series,
        language=REQUIRED_CATALOG_LANGUAGE,
        title=title,
        synopsis=synopsis,
    )
    return series


def make_season(series: Series, *, number: int = 1) -> Season:
    season, _created = Season.objects.get_or_create(series=series, number=number)
    return season


def make_right(
    series: Series,
    *,
    licensor: str = "Synthetic Licensor",
    contract_reference: str | None = None,
    territories: list[str] | None = None,
    denylist: list[str] | None = None,
    platforms: list[str] | None = None,
    languages: list[str] | None = None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    takedown: bool = False,
    exclusive: bool = False,
) -> ContentRight:
    right = ContentRight(
        series=series,
        licensor=licensor,
        contract_reference=contract_reference or f"synthetic-contract-{series.public_id}",
        territory_allowlist=territories if territories is not None else ["FR"],
        territory_denylist=denylist if denylist is not None else [],
        platforms=platforms if platforms is not None else ["ios", "android"],
        languages=languages if languages is not None else [REQUIRED_CATALOG_LANGUAGE],
        starts_at=starts_at if starts_at is not None else DEFAULT_NOW - timedelta(days=30),
        ends_at=ends_at,
        exclusive=exclusive,
        takedown=takedown,
        drm_required=False,
        revenue_share_rule_reference="synthetic-revshare",
        promotional_clip_permission=True,
    )
    right.full_clean()
    right.save()
    return right


def make_episode(
    series: Series,
    *,
    season: Season | None = None,
    order: int = 1,
    title: str | None = None,
    synopsis: str = "Generated episode synopsis.",
    duration_seconds: int = 90,
    publication_status: str = PublicationStatus.DRAFT,
    window_starts_at: datetime | None = None,
    window_ends_at: datetime | None = None,
    public_id: str | None = None,
) -> Episode:
    season = season or make_season(series)
    episode = Episode(
        series=series,
        season=season,
        order=order,
        duration_seconds=duration_seconds,
        publication_status=PublicationStatus.DRAFT,
        window_starts_at=window_starts_at,
        window_ends_at=window_ends_at,
    )
    if public_id is not None:
        episode.public_id = public_id
    episode.save()
    EpisodeTranslation.objects.create(
        episode=episode,
        language=REQUIRED_CATALOG_LANGUAGE,
        title=title or f"{series.english_title} · Episode {order}",
        synopsis=synopsis,
    )
    if publication_status == PublicationStatus.PUBLISHED:
        make_ready_media_asset(episode)
        episode.publication_status = PublicationStatus.PUBLISHED
        episode.full_clean()
        episode.save()
    return episode


def make_ready_media_asset(
    episode: Episode,
    *,
    provider_asset_id: str | None = None,
    checksum: str | None = None,
    provider_name: str = "fake",
) -> MediaAsset:
    """Attach a ready MediaAsset so published fixtures satisfy the P2-T06 gate."""
    digest = checksum or hashlib.sha256(f"synthetic:{episode.public_id}".encode()).hexdigest()
    asset = MediaAsset(
        episode=episode,
        checksum=digest,
        provider_name=provider_name,
        provider_asset_id=provider_asset_id or f"fake_{episode.public_id}",
        state=MediaAssetState.READY,
        captions_language=REQUIRED_CATALOG_LANGUAGE,
        has_captions=True,
        thumbnail_count=1,
        duration_seconds=float(episode.duration_seconds),
        renditions=["360p", "540p", "720p"],
        diagnostic_message="",
    )
    asset.full_clean()
    asset.save()
    return asset


def make_published_title(
    *,
    title: str,
    territory: str,
    editorial_rank: int = 0,
    platforms: list[str] | None = None,
    languages: list[str] | None = None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    takedown: bool = False,
) -> tuple[Series, Episode]:
    """Draft → rights → episode → publish. Does not use the seed command."""
    series = make_series(title=title, editorial_rank=editorial_rank)
    make_right(
        series,
        territories=[territory],
        platforms=platforms,
        languages=languages,
        starts_at=starts_at,
        ends_at=ends_at,
        takedown=takedown,
    )
    episode = make_episode(series, publication_status=PublicationStatus.PUBLISHED)
    series.publication_status = PublicationStatus.PUBLISHED
    series.full_clean()
    series.save(update_fields=["publication_status", "updated_at"])
    series.refresh_from_db()
    return series, episode

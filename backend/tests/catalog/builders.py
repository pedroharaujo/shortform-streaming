from __future__ import annotations

import hashlib

from apps.catalog.models import Episode, Genre, PublicationStatus, Season, Series
from apps.playback.models import MediaAsset, MediaAssetState


def make_genre(*, name: str = "Revenge") -> Genre:
    slug = name.lower().replace(" ", "-")
    genre, _ = Genre.objects.get_or_create(name=name, defaults={"slug": slug})
    return genre


def make_series(
    *,
    title: str = "Synthetic Series",
    synopsis: str = "Generated synopsis for automated tests.",
    editorial_rank: int = 0,
    artwork_url: str = "",
    public_id: str | None = None,
    self_owned: bool = True,
    promotional_use_approved: bool = True,
    provenance_reference: str = "synthetic-self-owned-fixture",
    takedown: bool = False,
) -> Series:
    series = Series(
        title=title,
        synopsis=synopsis,
        publication_status=PublicationStatus.DRAFT,
        editorial_rank=editorial_rank,
        artwork_url=artwork_url,
        age_rating="16+",
        content_warnings="Synthetic fixture.",
        attribution="Generated metadata.",
        self_owned=self_owned,
        promotional_use_approved=promotional_use_approved,
        provenance_reference=provenance_reference,
        takedown=takedown,
    )
    if public_id is not None:
        series.public_id = public_id
    series.save()
    return series


def make_season(series: Series, *, number: int = 1) -> Season:
    season, _ = Season.objects.get_or_create(series=series, number=number)
    return season


def make_episode(
    series: Series,
    *,
    season: Season | None = None,
    order: int = 1,
    title: str | None = None,
    synopsis: str = "Generated episode synopsis.",
    duration_seconds: int = 90,
    publication_status: str = PublicationStatus.DRAFT,
    public_id: str | None = None,
) -> Episode:
    season = season or make_season(series)
    episode = Episode(
        series=series,
        season=season,
        order=order,
        title=title or f"{series.title} · Episode {order}",
        synopsis=synopsis,
        duration_seconds=duration_seconds,
        publication_status=PublicationStatus.DRAFT,
    )
    if public_id is not None:
        episode.public_id = public_id
    episode.save()
    if publication_status == PublicationStatus.PUBLISHED:
        make_ready_media_asset(episode)
        episode.publication_status = PublicationStatus.PUBLISHED
        episode.full_clean()
        episode.save(update_fields=["publication_status", "updated_at"])
    return episode


def make_ready_media_asset(
    episode: Episode,
    *,
    provider_asset_id: str | None = None,
) -> MediaAsset:
    asset = MediaAsset(
        episode=episode,
        checksum=hashlib.sha256(f"synthetic:{episode.public_id}".encode()).hexdigest(),
        provider_name="fake",
        provider_asset_id=provider_asset_id or f"fake_{episode.public_id}",
        state=MediaAssetState.READY,
        has_captions=True,
        thumbnail_count=1,
        duration_seconds=float(episode.duration_seconds),
        renditions=["360p", "540p", "720p"],
    )
    asset.full_clean()
    asset.save()
    return asset


def make_published_title(
    *,
    title: str,
    editorial_rank: int = 0,
    takedown: bool = False,
) -> tuple[Series, Episode]:
    series = make_series(title=title, editorial_rank=editorial_rank, takedown=takedown)
    episode = make_episode(series, publication_status=PublicationStatus.PUBLISHED)
    if not takedown:
        series.publication_status = PublicationStatus.PUBLISHED
        series.full_clean()
        series.save(update_fields=["publication_status", "updated_at"])
    return series, episode

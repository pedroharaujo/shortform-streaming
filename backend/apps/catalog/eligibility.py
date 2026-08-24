from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone

from apps.catalog.models import ContentRight, Episode, PublicationStatus, Series

# Language eligibility uses ContentRight.languages (licensed original/subtitle/dub
# grant). X-Language must be in that list. Series.original_language is metadata
# and is not an implicit grant: an English original whose rights grant is only
# `fr` is not eligible for X-Language=en.


@dataclass(frozen=True, slots=True)
class CatalogRequestContext:
    territory: str
    platform: str
    language: str


def matching_rights_q(
    context: CatalogRequestContext,
    now: datetime,
) -> Q:
    """Filter ContentRight rows that grant this request. Fail closed."""
    return (
        Q(takedown=False)
        & Q(starts_at__lte=now)
        & (Q(ends_at__isnull=True) | Q(ends_at__gt=now))
        & Q(territory_allowlist__contains=[context.territory])
        & ~Q(territory_denylist__contains=[context.territory])
        & Q(platforms__contains=[context.platform])
        & Q(languages__contains=[context.language])
    )


def eligible_series_queryset(
    context: CatalogRequestContext,
    *,
    now: datetime | None = None,
) -> QuerySet[Series]:
    instant = now if now is not None else timezone.now()
    matching = ContentRight.objects.filter(series_id=OuterRef("pk")).filter(
        matching_rights_q(context, instant)
    )
    return (
        Series.objects.filter(publication_status=PublicationStatus.PUBLISHED)
        .filter(Exists(matching))
        .order_by("editorial_rank", "public_id")
    )


def series_is_eligible(
    series: Series,
    context: CatalogRequestContext,
    *,
    now: datetime | None = None,
) -> bool:
    if series.publication_status != PublicationStatus.PUBLISHED:
        return False
    return eligible_series_queryset(context, now=now).filter(pk=series.pk).exists()


def episode_window_is_open(episode: Episode, now: datetime) -> bool:
    """Episode window: start inclusive, end exclusive. Null bound means unbounded."""
    if episode.window_starts_at is not None and now < episode.window_starts_at:
        return False
    if episode.window_ends_at is not None and now >= episode.window_ends_at:
        return False
    return True


def eligible_episodes_for_series(
    series: Series,
    *,
    now: datetime | None = None,
) -> QuerySet[Episode]:
    """Published episodes of an already-eligible series, honoring episode windows.

    Monetization access_state is omitted. Callers must already have verified series
    eligibility so unpublished/ineligible series never leak episode lists.
    """
    instant = now if now is not None else timezone.now()
    queryset = series.episodes.filter(
        publication_status=PublicationStatus.PUBLISHED
    ).select_related("season")
    open_window = Q(window_starts_at__isnull=True) | Q(window_starts_at__lte=instant)
    open_end = Q(window_ends_at__isnull=True) | Q(window_ends_at__gt=instant)
    filtered: QuerySet[Episode] = queryset.filter(open_window, open_end).order_by(
        "season__number", "order"
    )
    return filtered


def episode_is_eligible(
    episode: Episode,
    context: CatalogRequestContext,
    *,
    now: datetime | None = None,
) -> bool:
    instant = now if now is not None else timezone.now()
    if episode.publication_status != PublicationStatus.PUBLISHED:
        return False
    if not episode_window_is_open(episode, instant):
        return False
    return series_is_eligible(episode.series, context, now=instant)

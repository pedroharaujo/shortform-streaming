from __future__ import annotations

from datetime import datetime

from django.db.models import Exists, OuterRef, Q, QuerySet, TextField
from django.db.models.functions import Cast
from django.utils import timezone

from apps.catalog.models import (
    MVP_CATALOG_LANGUAGE,
    MVP_DISTRIBUTION_COUNTRY,
    MVP_PLATFORM,
    ContentRight,
    Episode,
    PublicationStatus,
    Series,
)
from apps.playback.models import MediaAssetState


def matching_licensed_rights_q(now: datetime) -> Q:
    """Licensed grants usable by the fixed France/Android/English MVP."""
    return (
        Q(takedown=False)
        & Q(drm_required=False)
        & Q(promotional_clip_permission=True)
        & Q(licensor__regex=r"\S")
        & Q(contract_reference__regex=r"\S")
        & Q(starts_at__lte=now)
        & (Q(ends_at__isnull=True) | Q(ends_at__gt=now))
        & Q(territory_allowlist__contains=[MVP_DISTRIBUTION_COUNTRY])
        & ~Q(territory_denylist__contains=[MVP_DISTRIBUTION_COUNTRY])
        & Q(platforms__contains=[MVP_PLATFORM])
        & Q(languages__contains=[MVP_CATALOG_LANGUAGE])
    )


def eligible_series_queryset(*, now: datetime | None = None) -> QuerySet[Series]:
    """Published self-owned or licensed series eligible for the fixed MVP market."""
    instant = now if now is not None else timezone.now()
    matching_right = (
        ContentRight.objects.filter(series_id=OuterRef("pk"))
        .annotate(
            normalized_territories=Cast("territory_allowlist", TextField()),
            normalized_denials=Cast("territory_denylist", TextField()),
            normalized_platforms=Cast("platforms", TextField()),
            normalized_languages=Cast("languages", TextField()),
        )
        .filter(
            matching_licensed_rights_q(instant),
            normalized_territories__regex=r"^\{[A-Z]{2}(?:,[A-Z]{2})*\}$",
            normalized_denials__regex=r"^\{(?:[A-Z]{2}(?:,[A-Z]{2})*)?\}$",
            normalized_platforms__regex=r"^\{(?:android|ios)(?:,(?:android|ios))*\}$",
            normalized_languages__regex=r"^\{[a-z]{2}(?:,[a-z]{2})*\}$",
        )
    )
    self_owned_gate = (
        Q(self_owned=True) & Q(promotional_use_approved=True) & Q(provenance_reference__regex=r"\S")
    )
    licensed_gate = Q(self_owned=False) & Exists(matching_right)
    return (
        Series.objects.filter(
            publication_status=PublicationStatus.PUBLISHED,
            takedown=False,
            title__regex=r"\S",
            synopsis__regex=r"\S",
        )
        .filter(self_owned_gate | licensed_gate)
        .order_by("editorial_rank", "public_id")
    )


def series_is_eligible(series: Series, *, now: datetime | None = None) -> bool:
    if series.publication_status != PublicationStatus.PUBLISHED:
        return False
    return eligible_series_queryset(now=now).filter(pk=series.pk).exists()


def episode_window_is_open(episode: Episode, now: datetime) -> bool:
    """Episode windows are start-inclusive and end-exclusive."""
    if episode.window_starts_at is not None and now < episode.window_starts_at:
        return False
    return episode.window_ends_at is None or now < episode.window_ends_at


def eligible_episodes_for_series(
    series: Series, *, now: datetime | None = None
) -> QuerySet[Episode]:
    instant = now if now is not None else timezone.now()
    open_start = Q(window_starts_at__isnull=True) | Q(window_starts_at__lte=instant)
    open_end = Q(window_ends_at__isnull=True) | Q(window_ends_at__gt=instant)
    return (
        series.episodes.filter(
            publication_status=PublicationStatus.PUBLISHED,
            media_assets__state=MediaAssetState.READY,
        )
        .filter(open_start, open_end)
        .select_related("season")
        .distinct()
        .order_by("season__number", "order")
    )


def episode_is_eligible(episode: Episode, *, now: datetime | None = None) -> bool:
    instant = now if now is not None else timezone.now()
    return (
        episode.publication_status == PublicationStatus.PUBLISHED
        and episode_window_is_open(episode, instant)
        and episode.has_ready_media_asset()
        and series_is_eligible(episode.series, now=instant)
    )

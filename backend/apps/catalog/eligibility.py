from __future__ import annotations

from django.db.models import QuerySet

from apps.catalog.models import Episode, PublicationStatus, Series
from apps.playback.models import MediaAssetState


def eligible_series_queryset() -> QuerySet[Series]:
    """Published, provenance-approved self-owned series for the fixed MVP market."""
    return (
        Series.objects.filter(
            publication_status=PublicationStatus.PUBLISHED,
            self_owned=True,
            promotional_use_approved=True,
            takedown=False,
        )
        .exclude(provenance_reference="")
        .order_by("editorial_rank", "public_id")
    )


def series_is_eligible(series: Series) -> bool:
    return series.is_publishable() and series.publication_status == PublicationStatus.PUBLISHED


def eligible_episodes_for_series(series: Series) -> QuerySet[Episode]:
    return (
        series.episodes.filter(
            publication_status=PublicationStatus.PUBLISHED,
            media_assets__state=MediaAssetState.READY,
        )
        .select_related("season")
        .distinct()
        .order_by("season__number", "order")
    )


def episode_is_eligible(episode: Episode) -> bool:
    return (
        episode.publication_status == PublicationStatus.PUBLISHED
        and episode.has_ready_media_asset()
        and series_is_eligible(episode.series)
    )

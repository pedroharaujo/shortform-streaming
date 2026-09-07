"""Access writers must hold the series parent lock until their transaction commits."""

from django.db import connection
from django.db.transaction import TransactionManagementError

from apps.catalog.models import Episode, Series


def lock_series_for_access(series_id: int) -> Series:
    if not connection.in_atomic_block:
        raise TransactionManagementError("Catalog access locks require an atomic transaction.")
    return Series.objects.select_for_update(of=("self",)).get(pk=series_id)


def lock_episode_for_access(episode_id: int) -> Episode | None:
    if not connection.in_atomic_block:
        raise TransactionManagementError("Catalog access locks require an atomic transaction.")
    series_id = Episode.objects.filter(pk=episode_id).values_list("series_id", flat=True).first()
    if series_id is None:
        return None
    try:
        series = lock_series_for_access(series_id)
    except Series.DoesNotExist:
        return None
    episode = (
        Episode.objects.select_for_update(of=("self",))
        .select_related("season")
        .filter(pk=episode_id, series_id=series_id)
        .first()
    )
    if episode is not None:
        episode.series = series
        episode.season.series = series
    return episode

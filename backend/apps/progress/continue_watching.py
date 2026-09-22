from __future__ import annotations

from typing import TypedDict

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import eligible_episodes_for_series
from apps.catalog.models import Episode
from apps.catalog.serializers import series_artwork_url
from apps.progress.models import WatchProgress

MAX_CONTINUE_ITEMS = 8


class ContinueWatchingItem(TypedDict):
    series_id: str
    series_title: str
    artwork_url: str | None
    episode_id: str
    episode_title: str
    episode_order: int
    position_seconds: int
    duration_seconds: int


def list_continue_watching(
    *,
    user_profile: UserProfile | None,
    device_id: str | None,
) -> list[ContinueWatchingItem]:
    """One resume target per series, newest activity first.

    A partial episode is resumed. A completed episode advances to the next
    eligible episode the viewer has not finished. Taken-down or unpublished
    episodes are omitted. No playback URL is returned.
    """
    if (user_profile is None) == (device_id is None):
        raise ValueError("Exactly one of user_profile or device_id is required.")

    rows = list(_subject_progress(user_profile, device_id))
    progress_by_episode: dict[int, WatchProgress] = {}
    latest_by_series: dict[int, WatchProgress] = {}
    series_order: list[int] = []
    for row in rows:
        progress_by_episode[row.episode_id] = row
        series_id = row.episode.series_id
        current = latest_by_series.get(series_id)
        if current is None or (row.updated_at, row.pk) > (current.updated_at, current.pk):
            if current is None:
                series_order.append(series_id)
            latest_by_series[series_id] = row

    series_order.sort(
        key=lambda series_id: (
            latest_by_series[series_id].updated_at,
            latest_by_series[series_id].pk,
        ),
        reverse=True,
    )
    items: list[ContinueWatchingItem] = []
    for series_id in series_order:
        latest = latest_by_series[series_id]
        item = _resume_item(latest, progress_by_episode)
        if item is None:
            continue
        items.append(item)
        if len(items) >= MAX_CONTINUE_ITEMS:
            break
    return items


def _subject_progress(
    user_profile: UserProfile | None, device_id: str | None
) -> list[WatchProgress]:
    queryset = WatchProgress.objects.select_related("episode__series", "episode__season")
    if user_profile is not None:
        queryset = queryset.filter(user_profile=user_profile)
    else:
        queryset = queryset.filter(device_id=device_id)
    return list(queryset)


def _resume_item(
    latest: WatchProgress, progress_by_episode: dict[int, WatchProgress]
) -> ContinueWatchingItem | None:
    episodes = list(eligible_episodes_for_series(latest.episode.series))
    if not episodes:
        return None
    index = next((i for i, episode in enumerate(episodes) if episode.pk == latest.episode_id), None)
    if index is not None and not latest.completed:
        return _item(episodes[index], latest.position_seconds)

    start = 0 if index is None else index + 1
    for episode in episodes[start:]:
        row = progress_by_episode.get(episode.pk)
        if row is not None and row.completed:
            continue
        position = 0 if row is None else row.position_seconds
        return _item(episode, position)
    return None


def _item(episode: Episode, position_seconds: int) -> ContinueWatchingItem:
    series = episode.series
    return {
        "series_id": series.public_id,
        "series_title": series.title,
        "artwork_url": series_artwork_url(series),
        "episode_id": episode.public_id,
        "episode_title": episode.title,
        "episode_order": episode.order,
        "position_seconds": position_seconds,
        "duration_seconds": episode.duration_seconds,
    }

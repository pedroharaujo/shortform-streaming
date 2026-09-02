from __future__ import annotations

import pytest

from apps.catalog.eligibility import eligible_series_queryset, episode_is_eligible
from apps.catalog.models import PublicationStatus
from tests.catalog.builders import (
    make_episode,
    make_published_title,
    make_ready_media_asset,
    make_series,
)


@pytest.mark.django_db
def test_only_published_self_owned_non_takedown_series_are_eligible() -> None:
    visible, _ = make_published_title(title="Visible")
    make_series(title="Draft")
    taken, _ = make_published_title(title="Taken")
    taken.takedown = True
    taken.save(update_fields=["takedown"])

    assert list(eligible_series_queryset().values_list("public_id", flat=True)) == [
        visible.public_id
    ]


@pytest.mark.django_db
def test_episode_requires_published_metadata_ready_media_and_eligible_series() -> None:
    series = make_series()
    episode = make_episode(series)
    assert not episode_is_eligible(episode)

    series.publication_status = PublicationStatus.PUBLISHED
    series.save(update_fields=["publication_status"])
    type(episode).objects.filter(pk=episode.pk).update(
        publication_status=PublicationStatus.PUBLISHED
    )
    episode.refresh_from_db()
    assert not episode_is_eligible(episode)

    make_ready_media_asset(episode)
    episode.refresh_from_db()
    assert episode_is_eligible(episode)

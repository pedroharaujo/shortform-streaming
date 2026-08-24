from __future__ import annotations

from datetime import timedelta

import pytest

from apps.catalog.eligibility import (
    CatalogRequestContext,
    eligible_series_queryset,
    episode_is_eligible,
    episode_window_is_open,
)
from apps.catalog.models import PublicationStatus
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_series,
)

FR_IOS_EN = CatalogRequestContext(territory="FR", platform="ios", language="en")


@pytest.mark.django_db
def test_denylist_subtracts_territory_on_the_same_right() -> None:
    blocked, _ = make_published_title(title="Blocked FR", territory="FR")
    # Replace the simple allowlist with allow FR+DE and deny FR on one right.
    blocked.rights.all().delete()
    make_right(blocked, territories=["FR", "DE"], denylist=["FR"])
    visible, _ = make_published_title(title="Open DE", territory="DE")

    fr_ids = list(
        eligible_series_queryset(FR_IOS_EN, now=DEFAULT_NOW).values_list("public_id", flat=True)
    )
    de_ids = list(
        eligible_series_queryset(
            CatalogRequestContext(territory="DE", platform="ios", language="en"),
            now=DEFAULT_NOW,
        ).values_list("public_id", flat=True)
    )
    assert blocked.public_id not in fr_ids
    assert visible.public_id in de_ids
    assert blocked.public_id in de_ids


@pytest.mark.django_db
def test_language_grant_is_not_implied_by_original_language() -> None:
    series, episode = make_published_title(
        title="English original, German grant",
        territory="FR",
        languages=["de"],
    )
    assert series.original_language == "en"
    assert not eligible_series_queryset(FR_IOS_EN, now=DEFAULT_NOW).filter(pk=series.pk).exists()
    assert not episode_is_eligible(episode, FR_IOS_EN, now=DEFAULT_NOW)
    de_context = CatalogRequestContext(territory="FR", platform="ios", language="de")
    assert eligible_series_queryset(de_context, now=DEFAULT_NOW).filter(pk=series.pk).exists()


@pytest.mark.django_db
def test_second_right_can_grant_when_first_is_taken_down() -> None:
    series = make_series(title="Two rights")
    make_right(series, territories=["FR"], takedown=True, contract_reference="synthetic-a")
    make_right(series, territories=["FR"], takedown=False, contract_reference="synthetic-b")
    make_episode(series, publication_status=PublicationStatus.PUBLISHED)
    series.publication_status = PublicationStatus.PUBLISHED
    series.full_clean()
    series.save()
    assert eligible_series_queryset(FR_IOS_EN, now=DEFAULT_NOW).filter(pk=series.pk).exists()


@pytest.mark.django_db
def test_episode_window_helpers() -> None:
    series, episode = make_published_title(title="Window", territory="FR")
    episode.window_starts_at = DEFAULT_NOW
    episode.window_ends_at = DEFAULT_NOW + timedelta(hours=1)
    episode.save()
    assert episode_window_is_open(episode, DEFAULT_NOW)
    assert not episode_window_is_open(episode, DEFAULT_NOW + timedelta(hours=1))
    assert episode_is_eligible(episode, FR_IOS_EN, now=DEFAULT_NOW)
    assert not episode_is_eligible(episode, FR_IOS_EN, now=DEFAULT_NOW + timedelta(hours=1))

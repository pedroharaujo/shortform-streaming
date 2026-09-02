from __future__ import annotations

from datetime import timedelta

import pytest

from apps.catalog.eligibility import (
    eligible_episodes_for_series,
    eligible_series_queryset,
    episode_is_eligible,
)
from apps.catalog.models import PublicationStatus
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_licensed_title,
    make_published_title,
    make_ready_media_asset,
    make_right,
    make_series,
)


@pytest.mark.django_db
def test_published_self_owned_and_fixed_market_licensed_series_are_eligible() -> None:
    visible, _ = make_published_title(title="Visible")
    licensed, _ = make_published_licensed_title(title="Licensed")
    make_series(title="Draft")
    taken, _ = make_published_title(title="Taken")
    taken.takedown = True
    taken.save(update_fields=["takedown"])

    assert set(eligible_series_queryset(now=DEFAULT_NOW).values_list("public_id", flat=True)) == {
        visible.public_id,
        licensed.public_id,
    }

    visible.provenance_reference = " "
    visible.save(update_fields=["provenance_reference"])
    assert not eligible_series_queryset(now=DEFAULT_NOW).filter(pk=visible.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("territory_allowlist", ["DE"]),
        ("territory_denylist", ["FR"]),
        ("platforms", ["ios"]),
        ("languages", ["de"]),
        ("starts_at", DEFAULT_NOW + timedelta(seconds=1)),
        ("ends_at", DEFAULT_NOW),
        ("takedown", True),
        ("drm_required", True),
        ("promotional_clip_permission", False),
        ("territory_allowlist", ["FR", "12"]),
        ("platforms", ["android", "web"]),
        ("languages", ["en", "12"]),
    ],
)
def test_licensed_series_fails_closed_for_an_unusable_grant(field: str, value: object) -> None:
    series, _ = make_published_licensed_title(title=f"Blocked {field}")
    series.rights.update(**{field: value})

    assert not eligible_series_queryset(now=DEFAULT_NOW).filter(pk=series.pk).exists()


@pytest.mark.django_db
def test_licensed_grant_dimensions_must_match_on_the_same_right() -> None:
    series, _ = make_published_licensed_title(title="Split grants")
    series.rights.update(platforms=["ios"])
    make_right(
        series,
        contract_reference="synthetic-contract-second-right",
        territories=["DE"],
        platforms=["android"],
    )

    assert not eligible_series_queryset(now=DEFAULT_NOW).filter(pk=series.pk).exists()


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


@pytest.mark.django_db
def test_episode_window_is_start_inclusive_and_end_exclusive() -> None:
    series, episode = make_published_licensed_title(title="Scheduled licensed episode")
    episode.window_starts_at = DEFAULT_NOW
    episode.window_ends_at = DEFAULT_NOW + timedelta(hours=1)
    episode.save(update_fields=["window_starts_at", "window_ends_at"])

    assert episode_is_eligible(episode, now=DEFAULT_NOW)
    assert eligible_episodes_for_series(series, now=DEFAULT_NOW).filter(pk=episode.pk).exists()
    end = DEFAULT_NOW + timedelta(hours=1)
    assert not episode_is_eligible(episode, now=end)
    assert not eligible_episodes_for_series(series, now=end).filter(pk=episode.pk).exists()

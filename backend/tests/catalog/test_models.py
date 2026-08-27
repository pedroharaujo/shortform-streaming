from __future__ import annotations

from datetime import UTC, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.catalog.models import ContentRight, Episode, PublicationStatus, Series
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_right,
    make_season,
    make_series,
)

# pytest pythonpath includes backend/, so tests import via `tests.catalog`.


@pytest.mark.django_db
def test_invalid_rights_window_rejected() -> None:
    series = make_series()
    right = ContentRight(
        series=series,
        licensor="Synthetic Licensor",
        contract_reference="synthetic-contract-window",
        territory_allowlist=["FR"],
        territory_denylist=[],
        platforms=["ios"],
        languages=["en"],
        starts_at=DEFAULT_NOW,
        ends_at=DEFAULT_NOW,
    )
    with pytest.raises(ValidationError) as exc_info:
        right.full_clean()
    assert "ends_at" in exc_info.value.message_dict


@pytest.mark.django_db
def test_empty_allowlist_rejected() -> None:
    series = make_series()
    right = ContentRight(
        series=series,
        licensor="Synthetic Licensor",
        contract_reference="synthetic-contract-allowlist",
        territory_allowlist=[],
        platforms=["ios"],
        languages=["en"],
        starts_at=DEFAULT_NOW,
    )
    with pytest.raises(ValidationError) as exc_info:
        right.full_clean()
    assert "territory_allowlist" in exc_info.value.message_dict


@pytest.mark.django_db
def test_empty_platforms_and_languages_rejected() -> None:
    series = make_series()
    right = ContentRight(
        series=series,
        licensor="Synthetic Licensor",
        contract_reference="synthetic-contract-platforms",
        territory_allowlist=["FR"],
        platforms=[],
        languages=[],
        starts_at=DEFAULT_NOW,
    )
    with pytest.raises(ValidationError) as exc_info:
        right.full_clean()
    assert "platforms" in exc_info.value.message_dict
    assert "languages" in exc_info.value.message_dict


@pytest.mark.django_db
def test_duplicate_episode_order_rejected_at_database() -> None:
    series = make_series()
    season = make_season(series)
    make_episode(series, season=season, order=1)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Episode.objects.create(
                series=series,
                season=season,
                order=1,
                duration_seconds=60,
                publication_status=PublicationStatus.DRAFT,
            )


@pytest.mark.django_db
def test_publish_without_english_metadata_rejected() -> None:
    series = Series.objects.create(
        publication_status=PublicationStatus.DRAFT,
        original_language="en",
    )
    make_right(series)
    series.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError) as exc_info:
        series.full_clean()
    assert "publication_status" in exc_info.value.message_dict


@pytest.mark.django_db
def test_publish_without_valid_right_rejected() -> None:
    series = make_series()
    series.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError) as exc_info:
        series.full_clean()
    assert "publication_status" in exc_info.value.message_dict


@pytest.mark.django_db
def test_takedown_right_does_not_satisfy_publish_rule() -> None:
    series = make_series()
    make_right(series, takedown=True)
    series.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError):
        series.full_clean()


@pytest.mark.django_db
def test_expired_right_still_allows_storing_published_flag() -> None:
    series = make_series()
    make_right(
        series,
        starts_at=DEFAULT_NOW - timedelta(days=10),
        ends_at=DEFAULT_NOW - timedelta(days=1),
    )
    series.publication_status = PublicationStatus.PUBLISHED
    series.full_clean()
    series.save()
    series.refresh_from_db()
    assert series.publication_status == PublicationStatus.PUBLISHED


@pytest.mark.django_db
def test_episode_publish_requires_duration_and_english() -> None:
    series = make_series()
    make_right(series)
    episode = Episode.objects.create(
        series=series,
        season=make_season(series),
        order=1,
        duration_seconds=0,
        publication_status=PublicationStatus.DRAFT,
    )
    episode.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError):
        episode.full_clean()


@pytest.mark.django_db
def test_public_ids_are_opaque_prefixed_strings() -> None:
    series = make_series()
    episode = make_episode(series)
    assert series.public_id.startswith("ser_")
    assert episode.public_id.startswith("ep_")
    assert series.public_id != str(series.pk)
    assert episode.public_id != str(episode.pk)


@pytest.mark.django_db
def test_rights_window_database_constraint() -> None:
    series = make_series()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ContentRight.objects.create(
                series=series,
                licensor="Synthetic Licensor",
                contract_reference="synthetic-db-window",
                territory_allowlist=["FR"],
                platforms=["ios"],
                languages=["en"],
                starts_at=DEFAULT_NOW,
                ends_at=DEFAULT_NOW - timedelta(seconds=1),
            )


@pytest.mark.django_db
def test_timezone_aware_defaults() -> None:
    assert DEFAULT_NOW.tzinfo is UTC
    assert timezone.is_aware(DEFAULT_NOW)


@pytest.mark.django_db
def test_episode_publish_requires_ready_media_asset() -> None:
    series = make_series()
    make_right(series)
    episode = make_episode(series, publication_status=PublicationStatus.DRAFT)
    episode.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError) as exc_info:
        episode.full_clean()
    assert "publication_status" in exc_info.value.message_dict
    assert "MediaAsset" in str(exc_info.value)

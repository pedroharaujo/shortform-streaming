from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.models import ContentRight, PublicationStatus, Series
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_right,
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
def test_public_ids_are_opaque_prefixed_strings() -> None:
    series = make_series()
    episode = make_episode(series)
    assert series.public_id.startswith("ser_")
    assert episode.public_id.startswith("ep_")
    assert series.public_id != str(series.pk)
    assert episode.public_id != str(episode.pk)

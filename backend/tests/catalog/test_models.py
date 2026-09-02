from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.models import PublicationStatus
from tests.catalog.builders import make_episode, make_series


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("title", ""),
        ("synopsis", ""),
        ("self_owned", False),
        ("provenance_reference", ""),
        ("promotional_use_approved", False),
        ("takedown", True),
    ],
)
def test_series_publication_fails_closed_without_self_owned_release_gate(
    field: str, value: object
) -> None:
    series = make_series()
    setattr(series, field, value)
    series.publication_status = PublicationStatus.PUBLISHED

    with pytest.raises(ValidationError) as exc_info:
        series.full_clean()

    assert field in exc_info.value.message_dict


@pytest.mark.django_db
def test_episode_publication_requires_metadata_and_ready_media() -> None:
    series = make_series()
    episode = make_episode(series)
    episode.publication_status = PublicationStatus.PUBLISHED

    with pytest.raises(ValidationError) as exc_info:
        episode.full_clean()

    assert "publication_status" in exc_info.value.message_dict


@pytest.mark.django_db
def test_public_ids_are_opaque_prefixed_strings() -> None:
    series = make_series()
    episode = make_episode(series)
    assert series.public_id.startswith("ser_")
    assert episode.public_id.startswith("ep_")
    assert series.public_id != str(series.pk)
    assert episode.public_id != str(episode.pk)

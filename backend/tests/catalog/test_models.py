from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.models import ContentRight, PublicationStatus
from tests.catalog.builders import DEFAULT_NOW, make_episode, make_right, make_series


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("title", ""),
        ("synopsis", ""),
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
def test_licensed_series_publication_requires_a_publishable_right() -> None:
    series = make_series(
        self_owned=False,
        provenance_reference="",
        promotional_use_approved=False,
    )
    series.publication_status = PublicationStatus.PUBLISHED

    with pytest.raises(ValidationError) as exc_info:
        series.full_clean()

    assert "publication_status" in exc_info.value.message_dict

    make_right(series)
    series.full_clean()
    assert series.is_publishable()


@pytest.mark.django_db
def test_content_right_normalizes_codes_and_rejects_invalid_metadata() -> None:
    series = make_series()
    right = make_right(
        series,
        territories=["fr", "FR"],
        platforms=["Android", "android"],
        languages=["EN", "en"],
    )
    assert right.territory_allowlist == ["FR"]
    assert right.platforms == ["android"]
    assert right.languages == ["en"]

    invalid = ContentRight(
        series=series,
        licensor=" ",
        contract_reference=" ",
        territory_allowlist=["France"],
        platforms=["web"],
        languages=["English"],
        starts_at=DEFAULT_NOW,
    )
    with pytest.raises(ValidationError) as exc_info:
        invalid.full_clean()

    assert {
        "licensor",
        "contract_reference",
        "territory_allowlist",
        "platforms",
        "languages",
    } <= exc_info.value.message_dict.keys()

    invalid_window = ContentRight(
        series=series,
        licensor="Synthetic Licensor",
        contract_reference="synthetic-contract-window",
        territory_allowlist=["FR"],
        platforms=["android"],
        languages=["en"],
        starts_at=DEFAULT_NOW,
        ends_at=DEFAULT_NOW,
        promotional_clip_permission=True,
    )
    with pytest.raises(ValidationError) as window_error:
        invalid_window.full_clean()
    assert "ends_at" in window_error.value.message_dict


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

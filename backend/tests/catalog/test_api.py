from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.test import Client

from apps.catalog.models import PublicationStatus
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_series,
)

HOME = "/v1/catalog/home"


def _headers(
    *,
    territory: str = "FR",
    platform: str = "ios",
    language: str = "en",
    request_id: str | None = None,
) -> dict[str, Any]:
    headers = {
        "HTTP_X_TERRITORY": territory,
        "HTTP_X_PLATFORM": platform,
        "HTTP_X_LANGUAGE": language,
    }
    if request_id is not None:
        headers["HTTP_X_REQUEST_ID"] = request_id
    return headers


@pytest.fixture
def freeze_catalog_clock() -> Iterator[None]:
    with patch("apps.catalog.eligibility.timezone.now", return_value=DEFAULT_NOW):
        yield


@pytest.mark.django_db
def test_fr_and_de_clients_see_only_their_eligible_title(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    fr_series, _fr_episode = make_published_title(
        title="Harbor Lights", territory="FR", editorial_rank=0
    )
    de_series, _de_episode = make_published_title(
        title="Alpine Shadows", territory="DE", editorial_rank=1
    )
    make_series(title="Unreleased Draft")

    fr_home = client.get(HOME, **_headers(territory="FR")).json()
    fr_ids = [item["id"] for item in fr_home["rails"][0]["series"]]
    assert fr_ids == [fr_series.public_id]
    assert de_series.public_id not in fr_ids
    assert all(item["title"] == "Harbor Lights" for item in fr_home["rails"][0]["series"])

    de_home = client.get(HOME, **_headers(territory="DE")).json()
    de_ids = [item["id"] for item in de_home["rails"][0]["series"]]
    assert de_ids == [de_series.public_id]
    assert fr_series.public_id not in de_ids


@pytest.mark.django_db
def test_unpublished_expired_future_takedown_wrong_platform_language_hidden(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    visible, _ = make_published_title(title="Visible FR", territory="FR", editorial_rank=0)

    draft = make_series(title="Draft FR")
    make_right(draft, territories=["FR"])
    make_episode(draft, publication_status=PublicationStatus.PUBLISHED)

    expired, _ = make_published_title(
        title="Expired FR",
        territory="FR",
        starts_at=DEFAULT_NOW - timedelta(days=10),
        ends_at=DEFAULT_NOW - timedelta(seconds=1),
        editorial_rank=2,
    )
    future, _ = make_published_title(
        title="Future FR",
        territory="FR",
        starts_at=DEFAULT_NOW + timedelta(seconds=1),
        editorial_rank=3,
    )
    taken_down = make_series(title="Takedown FR")
    make_right(taken_down, territories=["FR"], takedown=True)
    make_episode(taken_down, publication_status=PublicationStatus.DRAFT)
    # Publish is rejected for takedown-only rights; force the stored flag to prove API hiding.
    type(taken_down).objects.filter(pk=taken_down.pk).update(
        publication_status=PublicationStatus.PUBLISHED
    )

    ios_only, _ = make_published_title(
        title="iOS only",
        territory="FR",
        platforms=["ios"],
        editorial_rank=4,
    )
    german_audio, _ = make_published_title(
        title="German grant",
        territory="FR",
        languages=["de"],
        editorial_rank=5,
    )

    home = client.get(HOME, **_headers(territory="FR", platform="android", language="en")).json()
    ids = [item["id"] for item in home["rails"][0]["series"]]
    assert ids == [visible.public_id]
    assert draft.public_id not in ids
    assert expired.public_id not in ids
    assert future.public_id not in ids
    assert taken_down.public_id not in ids
    assert ios_only.public_id not in ids
    assert german_audio.public_id not in ids


@pytest.mark.django_db
def test_missing_and_invalid_headers_return_400_error_envelope(client: Client) -> None:
    missing = client.get(HOME)
    assert missing.status_code == 400
    body = missing.json()
    assert body["code"] == "invalid_request_context"
    assert "request_id" in body and body["request_id"]
    assert "message" in body
    fields = {item["field"] for item in body["field_errors"]}
    assert fields == {"X-Territory", "X-Platform", "X-Language"}

    malformed = client.get(
        HOME,
        **_headers(territory="FRA", platform="web", language="eng"),
    )
    assert malformed.status_code == 400
    payload = malformed.json()
    assert payload["code"] == "invalid_request_context"
    assert {item["field"] for item in payload["field_errors"]} == {
        "X-Territory",
        "X-Platform",
        "X-Language",
    }


@pytest.mark.django_db
def test_well_formed_unknown_territory_returns_empty_home(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    make_published_title(title="Harbor Lights", territory="FR")
    response = client.get(HOME, **_headers(territory="US"))
    assert response.status_code == 200
    payload = response.json()
    assert payload["rails"][0]["series"] == []


@pytest.mark.django_db
def test_ineligible_public_ids_return_404_not_403(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    series, episode = make_published_title(title="Harbor Lights", territory="FR")
    request_id = "req-catalog-404"
    series_response = client.get(
        f"/v1/series/{series.public_id}",
        **_headers(territory="DE", request_id=request_id),
    )
    assert series_response.status_code == 404
    assert series_response.status_code != 403
    body = series_response.json()
    assert body["code"] == "not_found"
    assert body["request_id"] == request_id
    assert "field_errors" not in body or body.get("field_errors") in (None, [])

    missing = client.get("/v1/series/ser_doesnotexist000000000000000000", **_headers())
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"

    episode_response = client.get(f"/v1/episodes/{episode.public_id}", **_headers(territory="DE"))
    assert episode_response.status_code == 404
    assert episode_response.json()["code"] == "not_found"


@pytest.mark.django_db
def test_clock_boundaries_start_inclusive_end_exclusive(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    starting, _ = make_published_title(
        title="Starts now",
        territory="FR",
        starts_at=DEFAULT_NOW,
        ends_at=DEFAULT_NOW + timedelta(days=1),
        editorial_rank=0,
    )
    ending, _ = make_published_title(
        title="Ends now",
        territory="FR",
        starts_at=DEFAULT_NOW - timedelta(days=1),
        ends_at=DEFAULT_NOW,
        editorial_rank=1,
    )
    payload = client.get(HOME, **_headers()).json()
    ids = [item["id"] for item in payload["rails"][0]["series"]]
    assert starting.public_id in ids
    assert ending.public_id not in ids


@pytest.mark.django_db
def test_series_and_episode_detail_omit_db_ids_and_contract_secrets(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    series, episode = make_published_title(title="Harbor Lights", territory="FR")
    series_response = client.get(f"/v1/series/{series.public_id}", **_headers())
    assert series_response.status_code == 200
    detail = series_response.json()
    assert detail["id"] == series.public_id
    assert detail["id"] != str(series.pk)
    assert "pk" not in detail
    body = series_response.content.decode().lower()
    assert "contract" not in body
    assert "revshare" not in body
    assert "licensor" not in body
    assert detail["seasons"][0]["episodes"][0]["id"] == episode.public_id
    assert detail["seasons"][0]["episodes"][0]["id"] != str(episode.pk)
    assert "access_state" not in detail["seasons"][0]["episodes"][0]

    episode_response = client.get(f"/v1/episodes/{episode.public_id}", **_headers())
    assert episode_response.status_code == 200
    episode_body = episode_response.json()
    assert episode_body["id"] == episode.public_id
    assert episode_body["id"] != str(episode.pk)
    assert episode_body["series_id"] == series.public_id
    assert "access_state" not in episode_body
    assert "pk" not in episode_body


@pytest.mark.django_db
def test_draft_episode_omitted_from_eligible_series(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    series, published = make_published_title(title="Harbor Lights", territory="FR")
    draft_episode = make_episode(series, order=2, publication_status=PublicationStatus.DRAFT)
    detail = client.get(f"/v1/series/{series.public_id}", **_headers()).json()
    ids = [item["id"] for item in detail["seasons"][0]["episodes"]]
    assert ids == [published.public_id]
    assert draft_episode.public_id not in ids
    hidden = client.get(f"/v1/episodes/{draft_episode.public_id}", **_headers())
    assert hidden.status_code == 404


@pytest.mark.django_db
def test_episode_window_boundary(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    series, first = make_published_title(title="Harbor Lights", territory="FR")
    closed = make_episode(
        series,
        order=2,
        publication_status=PublicationStatus.PUBLISHED,
        window_starts_at=DEFAULT_NOW - timedelta(days=1),
        window_ends_at=DEFAULT_NOW,
    )
    opening = make_episode(
        series,
        order=3,
        publication_status=PublicationStatus.PUBLISHED,
        window_starts_at=DEFAULT_NOW,
        window_ends_at=None,
    )
    detail = client.get(f"/v1/series/{series.public_id}", **_headers()).json()
    ids = [item["id"] for item in detail["seasons"][0]["episodes"]]
    assert first.public_id in ids
    assert opening.public_id in ids
    assert closed.public_id not in ids
    assert client.get(f"/v1/episodes/{closed.public_id}", **_headers()).status_code == 404
    assert client.get(f"/v1/episodes/{opening.public_id}", **_headers()).status_code == 200


@pytest.mark.django_db
def test_home_orders_by_editorial_rank_then_public_id(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    later, _ = make_published_title(title="Second", territory="FR", editorial_rank=10)
    earlier, _ = make_published_title(title="First", territory="FR", editorial_rank=1)
    payload = client.get(HOME, **_headers()).json()
    ids = [item["id"] for item in payload["rails"][0]["series"]]
    assert ids == [earlier.public_id, later.public_id]


@pytest.mark.django_db
def test_localized_title_prefers_requested_language(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    series, _episode = make_published_title(title="English Title", territory="FR")
    series.translations.create(
        language="de",
        title="Deutscher Titel",
        synopsis="Deutsche Synopsis.",
    )
    payload = client.get(HOME, **_headers(language="en")).json()
    assert payload["rails"][0]["series"][0]["title"] == "English Title"


@pytest.mark.django_db
def test_accept_language_is_ignored(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    make_published_title(title="Harbor Lights", territory="FR")
    response = client.get(
        HOME,
        HTTP_ACCEPT_LANGUAGE="de",
        **_headers(territory="FR", language="en"),
    )
    assert response.status_code == 200
    assert response.json()["rails"][0]["series"][0]["title"] == "Harbor Lights"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "authorization",
    (None, "Bearer not-a-token", "Bearer mock.firebase-user-1"),
)
def test_catalog_stays_anonymous_with_or_without_bearer(
    client: Client, freeze_catalog_clock: None, authorization: str | None
) -> None:
    del freeze_catalog_clock
    series, episode = make_published_title(title="Harbor Lights", territory="FR")
    headers = _headers()
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    home = client.get(HOME, **headers)
    assert home.status_code == 200
    assert home.json()["rails"][0]["series"][0]["id"] == series.public_id

    series_response = client.get(f"/v1/series/{series.public_id}", **headers)
    assert series_response.status_code == 200
    assert series_response.json()["id"] == series.public_id

    episode_response = client.get(f"/v1/episodes/{episode.public_id}", **headers)
    assert episode_response.status_code == 200
    assert episode_response.json()["id"] == episode.public_id

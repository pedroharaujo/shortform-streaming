from __future__ import annotations

import pytest
from django.test import Client

from tests.catalog.builders import make_published_licensed_title, make_published_title, make_series

HOME = "/v1/catalog/home"


@pytest.mark.django_db
def test_home_returns_published_self_owned_and_licensed_series_without_market_headers(
    client: Client,
) -> None:
    visible, _ = make_published_title(title="Harbor Lights")
    licensed, _ = make_published_licensed_title(title="Licensed Lights", editorial_rank=1)
    make_series(title="Draft")

    response = client.get(HOME)

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["rails"][0]["series"]] == [
        visible.public_id,
        licensed.public_id,
    ]


@pytest.mark.django_db
def test_series_and_episode_details_expose_no_internal_ownership_or_database_ids(
    client: Client,
) -> None:
    series, episode = make_published_title(title="Harbor Lights")

    series_response = client.get(f"/v1/series/{series.public_id}")
    episode_response = client.get(f"/v1/episodes/{episode.public_id}")

    assert series_response.status_code == 200
    assert episode_response.status_code == 200
    serialized = series_response.content.decode().lower()
    assert "provenance" not in serialized
    assert "self_owned" not in serialized
    assert str(series.pk) != series_response.json()["id"]
    assert episode_response.json()["series_id"] == series.public_id
    assert "access_state" not in episode_response.json()


@pytest.mark.django_db
def test_unknown_and_taken_down_ids_return_same_404_envelope(client: Client) -> None:
    series, episode = make_published_title(title="Taken")
    series.takedown = True
    series.save(update_fields=["takedown"])

    taken = client.get(f"/v1/episodes/{episode.public_id}")
    missing = client.get("/v1/episodes/ep_does_not_exist")

    assert taken.status_code == missing.status_code == 404
    assert taken.json()["code"] == missing.json()["code"] == "not_found"

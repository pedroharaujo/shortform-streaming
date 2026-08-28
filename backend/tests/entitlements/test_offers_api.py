from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import patch

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_season,
    make_series,
)
from tests.entitlements.builders import grant_staff_entitlement, make_series_access_policy

OFFERS = "/v1/offers/{episode_id}"
VALID_UID = "firebase-user-1"
VALID_CREDENTIAL = f"{MOCK_TOKEN_PREFIX}{VALID_UID}"

_FREE_COPY = ("Free episode", "Included in the free preview.")
_ENTITLEMENT_COPY = ("Unlocked", "This episode is already unlocked on your account.")
_REWARDED_AD_COPY = (
    "Watch an ad to unlock",
    "Watch one rewarded ad to unlock this episode permanently.",
)


def _headers(
    *,
    territory: str = "FR",
    platform: str = "ios",
    language: str = "en",
    request_id: str | None = None,
    authorization: str | None = None,
) -> dict[str, Any]:
    headers: dict[str, Any] = {
        "HTTP_X_TERRITORY": territory,
        "HTTP_X_PLATFORM": platform,
        "HTTP_X_LANGUAGE": language,
    }
    if request_id is not None:
        headers["HTTP_X_REQUEST_ID"] = request_id
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    return headers


def _bearer(credential: str) -> str:
    return f"Bearer {credential}"


def _published_episode(
    *,
    order: int = 1,
    season_number: int = 1,
    title: str = "Harbor Lights",
    ends_at: Any = None,
) -> tuple[Any, Any]:
    series, first = make_published_title(title=title, territory="FR", ends_at=ends_at)
    if season_number == 1 and order == 1:
        return series, first
    season = make_season(series, number=season_number)
    episode = make_episode(
        series,
        season=season,
        order=order,
        publication_status=PublicationStatus.PUBLISHED,
    )
    return series, episode


@pytest.fixture
def freeze_catalog_clock() -> Iterator[None]:
    with patch("apps.catalog.eligibility.timezone.now", return_value=DEFAULT_NOW):
        yield


def _method_types(payload: dict[str, Any]) -> list[str]:
    return [item["type"] for item in payload.get("methods", [])]


def _assert_no_playback_or_commerce(payload: dict[str, Any]) -> None:
    assert "playback_url" not in payload
    assert "expires_at" not in payload
    assert "firebase_uid" not in payload
    assert "coin" not in payload
    assert "subscription" not in payload
    assert "coin" not in _method_types(payload)
    assert "subscription" not in _method_types(payload)


@pytest.mark.django_db
def test_anonymous_order_one_is_granted_free(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, title="Free Offers")
    response = client.get(OFFERS.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "granted"
    assert payload["episode_id"] == episode.public_id
    assert "lock_reasons" not in payload
    assert _method_types(payload) == ["free"]
    assert payload["methods"][0]["title"] == _FREE_COPY[0]
    assert payload["methods"][0]["description"] == _FREE_COPY[1]
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_anonymous_order_six_is_login_required_without_ad_method(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Anon Locked Offers")
    response = client.get(OFFERS.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "locked"
    assert payload["lock_reasons"] == ["login_required"]
    assert payload["methods"] == []
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_authenticated_order_six_includes_rewarded_ad(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Auth Locked Offers")
    response = client.get(
        OFFERS.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "locked"
    assert payload["lock_reasons"] == ["entitlement_required"]
    assert _method_types(payload) == ["rewarded_ad"]
    assert payload["methods"][0]["title"] == _REWARDED_AD_COPY[0]
    assert payload["methods"][0]["description"] == _REWARDED_AD_COPY[1]
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_authenticated_ads_off_locks_with_empty_methods(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=6, title="Ads Off Offers")
    make_series_access_policy(series, rewarded_ad_enabled=False)
    response = client.get(
        OFFERS.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "locked"
    assert payload["lock_reasons"] == ["entitlement_required"]
    assert payload["methods"] == []
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_staff_entitlement_is_granted_entitlement_method(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Entitled Offers")
    profile = get_or_create_profile(VALID_UID)
    grant_staff_entitlement(profile, episode)
    response = client.get(
        OFFERS.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "granted"
    assert _method_types(payload) == ["entitlement"]
    assert payload["methods"][0]["title"] == _ENTITLEMENT_COPY[0]
    assert payload["methods"][0]["description"] == _ENTITLEMENT_COPY[1]
    assert "lock_reasons" not in payload
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_series_free_max_three_locks_order_four_anonymous(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=4, title="Tight Offers")
    make_series_access_policy(series, free_episode_order_max=3)
    response = client.get(OFFERS.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "locked"
    assert payload["lock_reasons"] == ["login_required"]
    assert payload["methods"] == []
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_query_free_max_does_not_grant_order_six(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Query Bypass")
    response = client.get(
        OFFERS.format(episode_id=episode.public_id) + "?free_episode_order_max=10",
        **_headers(),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "locked"
    assert payload["lock_reasons"] == ["login_required"]
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_wrong_territory_and_unpublished_are_404_never_403(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    wrong_territory = client.get(
        OFFERS.format(episode_id=episode.public_id),
        **_headers(territory="DE"),
    )
    assert wrong_territory.status_code == 404
    assert wrong_territory.status_code != 403
    assert "methods" not in wrong_territory.json()

    unpublished = make_series(title="Draft Series")
    make_right(unpublished, territories=["FR"])
    draft = make_episode(unpublished, publication_status=PublicationStatus.DRAFT)
    unpublished_response = client.get(OFFERS.format(episode_id=draft.public_id), **_headers())
    assert unpublished_response.status_code == 404
    assert unpublished_response.status_code != 403


@pytest.mark.django_db
def test_invalid_bearer_is_401(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Invalid Token Offers")
    response = client.get(
        OFFERS.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer("not-a-token")),
    )
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "authentication_required"
    assert "methods" not in body
    _assert_no_playback_or_commerce(body)


@pytest.mark.django_db
def test_missing_catalog_headers_return_400(client: Client) -> None:
    response = client.get(OFFERS.format(episode_id="ep_missing"))
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_request_context"
    assert "request_id" in body
    fields = {item["field"] for item in body["field_errors"]}
    assert fields == {"X-Territory", "X-Platform", "X-Language"}


@pytest.mark.django_db
def test_locked_offers_do_not_call_provider(client: Client, freeze_catalog_clock: None) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="No Provider Offers")
    with patch("apps.playback.providers.factory.get_video_provider", return_value=None) as provider:
        response = client.get(OFFERS.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    assert response.status_code != 503
    payload = response.json()
    assert payload["decision"] == "locked"
    provider.assert_not_called()
    _assert_no_playback_or_commerce(payload)


@pytest.mark.django_db
def test_method_types_exclude_coin_and_subscription(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="No Commerce Types")
    response = client.get(
        OFFERS.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    payload = response.json()
    _assert_no_playback_or_commerce(payload)
    assert set(_method_types(payload)).issubset({"entitlement", "free", "rewarded_ad"})

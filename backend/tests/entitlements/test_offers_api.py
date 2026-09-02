from __future__ import annotations

from typing import Any

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from tests.catalog.builders import make_episode, make_published_title
from tests.entitlements.builders import grant_staff_entitlement

OFFERS = "/v1/offers/{episode_id}"
UID = "firebase-user-1"
BEARER: dict[str, Any] = {"HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}{UID}"}


def _episode(order: int) -> tuple[Any, Any]:
    series, first = make_published_title(title=f"Offers {order}")
    if order == 1:
        return series, first
    return series, make_episode(
        series,
        order=order,
        publication_status=PublicationStatus.PUBLISHED,
    )


def _method_types(payload: dict[str, Any]) -> list[str]:
    return [item["type"] for item in payload.get("methods", [])]


def _assert_no_playback_or_deferred_commerce(payload: dict[str, Any]) -> None:
    serialized = str(payload).lower()
    assert "playback_url" not in payload
    assert "coin" not in serialized
    assert "subscription" not in serialized


@pytest.mark.django_db
def test_free_locked_and_rewarded_offer_decisions(client: Client) -> None:
    _, free = _episode(1)
    _, locked = _episode(6)

    free_payload = client.get(OFFERS.format(episode_id=free.public_id)).json()
    anonymous_payload = client.get(OFFERS.format(episode_id=locked.public_id)).json()
    account_payload = client.get(OFFERS.format(episode_id=locked.public_id), **BEARER).json()

    assert free_payload["decision"] == "granted"
    assert _method_types(free_payload) == ["free"]
    assert anonymous_payload == {
        "decision": "locked",
        "episode_id": locked.public_id,
        "lock_reasons": ["login_required"],
        "methods": [],
    }
    assert account_payload["lock_reasons"] == ["entitlement_required"]
    assert _method_types(account_payload) == ["rewarded_ad"]
    for payload in (free_payload, anonymous_payload, account_payload):
        _assert_no_playback_or_deferred_commerce(payload)


@pytest.mark.django_db
def test_series_settings_control_free_window_and_ad_kill_switch(client: Client) -> None:
    series, episode = _episode(4)
    series.free_episode_count = 3
    series.rewarded_ads_enabled = False
    series.save(update_fields=["free_episode_count", "rewarded_ads_enabled"])

    anonymous = client.get(OFFERS.format(episode_id=episode.public_id)).json()
    account = client.get(OFFERS.format(episode_id=episode.public_id), **BEARER).json()

    assert anonymous["lock_reasons"] == ["login_required"]
    assert account["lock_reasons"] == ["entitlement_required"]
    assert account["methods"] == []


@pytest.mark.django_db
def test_permanent_entitlement_wins_but_never_returns_playback(client: Client) -> None:
    _, episode = _episode(6)
    grant_staff_entitlement(get_or_create_profile(UID), episode)

    payload = client.get(OFFERS.format(episode_id=episode.public_id), **BEARER).json()

    assert payload["decision"] == "granted"
    assert _method_types(payload) == ["entitlement"]
    _assert_no_playback_or_deferred_commerce(payload)


@pytest.mark.django_db
def test_offer_fails_closed_for_invalid_auth_and_unavailable_episode(client: Client) -> None:
    _, episode = _episode(6)
    invalid = client.get(
        OFFERS.format(episode_id=episode.public_id),
        HTTP_AUTHORIZATION="Bearer not-a-token",
    )
    episode.series.takedown = True
    episode.series.save(update_fields=["takedown"])
    taken = client.get(OFFERS.format(episode_id=episode.public_id))

    assert invalid.status_code == 401
    assert taken.status_code == 404
    assert "methods" not in taken.json()

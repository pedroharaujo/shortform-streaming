from __future__ import annotations

from typing import Any, cast

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.entitlements.models import EpisodeEntitlement
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
    assert "playback_url" not in payload
    assert all(method["type"] != "coin" for method in payload.get("methods", []))
    assert "subscription" not in str(payload).lower()


@pytest.mark.django_db
def test_episode_access_policy_decision_table(client: Client, settings: Any) -> None:
    settings.REWARDED_ADS_MODE = "test"
    series, inherited_free = _episode(1)
    inherited_ad = make_episode(series, order=6, publication_status=PublicationStatus.PUBLISHED)
    explicit_free = make_episode(series, order=7, publication_status=PublicationStatus.PUBLISHED)
    explicit_free.access_mode = "free"
    explicit_free.save(update_fields=["access_mode"])
    explicit_ad = make_episode(series, order=3, publication_status=PublicationStatus.PUBLISHED)
    explicit_ad.access_mode = "rewarded_ad"
    explicit_ad.save(update_fields=["access_mode"])
    explicit_paid = make_episode(series, order=2, publication_status=PublicationStatus.PUBLISHED)
    explicit_paid.access_mode = "coin"
    explicit_paid.coin_price = 37
    explicit_paid.save(update_fields=["access_mode", "coin_price"])
    explicit_both = make_episode(series, order=8, publication_status=PublicationStatus.PUBLISHED)
    explicit_both.access_mode = "both"
    explicit_both.coin_price = 71
    explicit_both.save(update_fields=["access_mode", "coin_price"])

    profile = get_or_create_profile(UID)
    unknown_source = make_episode(series, order=9, publication_status=PublicationStatus.PUBLISHED)
    EpisodeEntitlement.objects.create(
        user_profile=profile, episode=unknown_source, source="future_unknown_source"
    )
    rewarded_grant = make_episode(series, order=10, publication_status=PublicationStatus.PUBLISHED)
    EpisodeEntitlement.objects.create(
        user_profile=profile, episode=rewarded_grant, source="rewarded_ad"
    )

    def offers(episode: Any, *, authenticated: bool = False) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            client.get(
                OFFERS.format(episode_id=episode.public_id), **(BEARER if authenticated else {})
            ).json(),
        )

    inherited_free_payload = offers(inherited_free)
    inherited_ad_payload = offers(inherited_ad, authenticated=True)
    explicit_free_payload = offers(explicit_free)
    explicit_ad_guest_payload = offers(explicit_ad)
    explicit_ad_payload = offers(explicit_ad, authenticated=True)
    explicit_paid_guest_payload = offers(explicit_paid)
    explicit_paid_payload = offers(explicit_paid, authenticated=True)
    explicit_both_payload = offers(explicit_both, authenticated=True)
    unknown_source_payload = offers(unknown_source, authenticated=True)
    rewarded_grant_payload = offers(rewarded_grant, authenticated=True)

    assert (inherited_free_payload["decision"], _method_types(inherited_free_payload)) == (
        "granted",
        ["free"],
    )
    assert (inherited_ad_payload["decision"], _method_types(inherited_ad_payload)) == (
        "locked",
        ["rewarded_ad"],
    )
    assert (explicit_free_payload["decision"], _method_types(explicit_free_payload)) == (
        "granted",
        ["free"],
    )
    assert (explicit_ad_guest_payload["decision"], explicit_ad_guest_payload["methods"]) == (
        "locked",
        [],
    )
    assert explicit_ad_guest_payload["lock_reasons"] == ["login_required"]
    assert (explicit_ad_payload["decision"], _method_types(explicit_ad_payload)) == (
        "locked",
        ["rewarded_ad"],
    )
    assert explicit_ad_payload["lock_reasons"] == ["entitlement_required"]
    assert explicit_paid_guest_payload["lock_reasons"] == ["login_required"]
    assert explicit_paid_guest_payload["methods"] == []
    assert explicit_paid_payload["lock_reasons"] == ["entitlement_required"]
    assert explicit_paid_payload["methods"] == []
    assert explicit_paid_payload["coin_price"] == 37
    assert _method_types(explicit_both_payload) == ["rewarded_ad"]
    assert explicit_both_payload["coin_price"] == 71
    assert unknown_source_payload["decision"] == "locked"
    assert (rewarded_grant_payload["decision"], _method_types(rewarded_grant_payload)) == (
        "granted",
        ["entitlement"],
    )

    for payload in (
        inherited_free_payload,
        inherited_ad_payload,
        explicit_free_payload,
        explicit_ad_guest_payload,
        explicit_ad_payload,
        explicit_paid_guest_payload,
        explicit_paid_payload,
        explicit_both_payload,
        unknown_source_payload,
        rewarded_grant_payload,
    ):
        assert len(payload["policy_version"]) == 64
        int(payload["policy_version"], 16)

    original_version = inherited_ad_payload["policy_version"]
    assert offers(inherited_ad, authenticated=True)["policy_version"] == original_version
    inherited_ad.order = 5
    inherited_ad.save(update_fields=["order"])
    assert offers(inherited_ad, authenticated=True)["policy_version"] != original_version

    explicit_ad.access_mode = "inherit"
    explicit_ad.save(update_fields=["access_mode"])
    inherited_again_payload = offers(explicit_ad, authenticated=True)
    assert inherited_again_payload["policy_version"] != explicit_ad_payload["policy_version"]
    assert inherited_again_payload["decision"] == "granted"
    assert _method_types(inherited_again_payload) == ["free"]

    explicit_paid.coin_price = 38
    explicit_paid.save(update_fields=["coin_price"])
    repriced_payload = offers(explicit_paid, authenticated=True)
    assert repriced_payload["policy_version"] != explicit_paid_payload["policy_version"]
    assert repriced_payload["coin_price"] == 38

    series.rewarded_ads_enabled = False
    series.save(update_fields=["rewarded_ads_enabled"])
    killed_ad_payload = offers(explicit_both, authenticated=True)
    assert killed_ad_payload["methods"] == []
    assert killed_ad_payload["policy_version"] != explicit_both_payload["policy_version"]

    series.rewarded_ads_enabled = True
    series.save(update_fields=["rewarded_ads_enabled"])
    settings.REWARDED_ADS_MODE = "disabled"
    assert offers(explicit_both, authenticated=True)["methods"] == []

    series.takedown = True
    series.save(update_fields=["takedown"])
    unavailable = client.get(OFFERS.format(episode_id=explicit_free.public_id))
    assert unavailable.status_code == 404
    assert "methods" not in unavailable.json()


@pytest.mark.django_db
def test_free_locked_and_rewarded_offer_decisions(client: Client, settings: Any) -> None:
    settings.REWARDED_ADS_MODE = "test"
    _, free = _episode(1)
    _, locked = _episode(6)

    free_payload = client.get(OFFERS.format(episode_id=free.public_id)).json()
    anonymous_payload = client.get(OFFERS.format(episode_id=locked.public_id)).json()
    account_payload = client.get(OFFERS.format(episode_id=locked.public_id), **BEARER).json()

    assert free_payload["decision"] == "granted"
    assert _method_types(free_payload) == ["free"]
    assert anonymous_payload["decision"] == "locked"
    assert anonymous_payload["episode_id"] == locked.public_id
    assert anonymous_payload["lock_reasons"] == ["login_required"]
    assert anonymous_payload["methods"] == []
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

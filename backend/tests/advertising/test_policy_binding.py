from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import Client

from apps.advertising.models import RewardIntent
from apps.entitlements.models import EpisodeEntitlement
from tests.advertising.test_callbacks import CALLBACK, signed_query
from tests.advertising.test_rewards_api import create_intent, headers


@pytest.mark.django_db
def test_changed_policy_invalidates_pending_intent_even_when_ads_remain_available(
    client: Client, reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey
) -> None:
    _, episode = reward_setup
    request_id = str(uuid4())
    data = create_intent(client, episode, request_id=request_id).json()
    query = signed_query(ephemeral_signer, data)
    episode.series.free_episode_count = 4
    episode.series.save(update_fields=["free_episode_count"])

    repeated = create_intent(client, episode, request_id=request_id)
    assert repeated.status_code == 200
    assert repeated.json()["id"] == data["id"]
    assert repeated.json()["status"] == "unavailable"
    assert RewardIntent.objects.count() == 1
    assert client.get(f"{CALLBACK}?{query}").status_code == 400
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
def test_expected_policy_version_mismatch_is_unavailable(client: Client, reward_setup: Any) -> None:
    _, episode = reward_setup
    response = create_intent(client, episode, expected_policy_version="0" * 64)
    assert response.status_code == 409
    assert not RewardIntent.objects.exists()


@pytest.mark.django_db
def test_current_offer_version_is_bound_and_client_prices_are_rejected(
    client: Client, reward_setup: Any
) -> None:
    _, episode = reward_setup
    version = client.get(f"/v1/offers/{episode.public_id}", **headers()).json()["policy_version"]
    response = create_intent(client, episode, expected_policy_version=version)
    assert response.status_code == 201
    intent = RewardIntent.objects.get(pk=response.json()["id"])
    assert intent.policy_version == version
    assert create_intent(client, episode, coin_price=1).status_code == 400
    assert create_intent(client, episode, expected_policy_version="untrusted").status_code == 400


@pytest.mark.django_db
def test_historical_blank_pending_intent_cannot_receive_a_grant(
    client: Client, reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey
) -> None:
    _, episode = reward_setup
    data = create_intent(client, episode).json()
    RewardIntent.objects.filter(pk=data["id"]).update(policy_version="")

    assert client.get(f"/v1/rewards/{data['id']}", **headers()).json()["status"] == "unavailable"
    query = signed_query(ephemeral_signer, data)
    assert client.get(f"{CALLBACK}?{query}").status_code == 400
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
def test_unknown_existing_entitlement_is_not_acknowledged_as_a_verified_reward(
    client: Client, reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey
) -> None:
    profile, episode = reward_setup
    data = create_intent(client, episode).json()
    grant = EpisodeEntitlement.objects.create(
        user_profile=profile, episode=episode, source="unknown"
    )
    query = signed_query(ephemeral_signer, data)

    assert client.get(f"{CALLBACK}?{query}").status_code == 400
    assert RewardIntent.objects.get(pk=data["id"]).granted_at is None
    grant.refresh_from_db()
    assert grant.source == "unknown"


@pytest.mark.django_db
def test_granted_replay_survives_policy_change_without_another_entitlement(
    client: Client, reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey
) -> None:
    _, episode = reward_setup
    data = create_intent(client, episode).json()
    query = signed_query(ephemeral_signer, data)
    assert client.get(f"{CALLBACK}?{query}").status_code == 200
    episode.series.rewarded_ads_enabled = False
    episode.series.save(update_fields=["rewarded_ads_enabled"])

    assert client.get(f"{CALLBACK}?{query}").status_code == 200
    assert client.get(f"/v1/rewards/{data['id']}", **headers()).json()["status"] == "granted"
    assert EpisodeEntitlement.objects.count() == 1

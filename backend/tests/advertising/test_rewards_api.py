from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.entitlements.models import EpisodeEntitlement
from tests.catalog.builders import make_episode, make_published_title


def headers(uid: str = "synthetic-reward-user") -> dict[str, Any]:
    return {
        "HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}{uid}",
        "HTTP_X_TERRITORY": "FR",
        "HTTP_X_PLATFORM": "android",
        "HTTP_X_LANGUAGE": "en",
    }


@pytest.fixture
def reward_setup(settings: Any) -> Any:
    settings.DEBUG = True
    settings.REWARDED_ADS_MODE = "test"
    settings.REWARDED_ADS_TEST_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
    profile = get_or_create_profile("synthetic-reward-user")
    profile.ads_consent = True
    profile.save(update_fields=["ads_consent"])
    series, _ = make_published_title(title="Synthetic rewards", territory="FR")
    episode = make_episode(series, order=6, publication_status=PublicationStatus.PUBLISHED)
    return profile, episode


def create_intent(client: Client, episode: Any, **changes: Any) -> Any:
    payload = {"episode_id": episode.public_id, "request_id": str(uuid4()), "accepted": True}
    payload.update(changes)
    return client.post("/v1/rewards/intents", payload, content_type="application/json", **headers())


@pytest.mark.django_db
def test_intent_requires_opt_in_and_never_grants(client: Client, reward_setup: Any) -> None:
    profile, episode = reward_setup
    response = create_intent(client, episode)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["grant_source"] is None
    assert data["episode_id"] == episode.public_id
    assert data["ad_unit_id"] == "ca-app-pub-3940256099942544/5224354917"
    assert data["ssv_user_id"] != profile.firebase_uid
    assert data["custom_data"] != data["ssv_user_id"]
    assert "playback_url" not in data
    assert not EpisodeEntitlement.objects.exists()
    assert client.get(f"/v1/rewards/{data['id']}", **headers()).json() == data
    assert create_intent(client, episode, accepted=False).status_code == 400


@pytest.mark.django_db
def test_intent_auth_ownership_and_idempotency(client: Client, reward_setup: Any) -> None:
    from apps.advertising.models import RewardIntent

    _, episode = reward_setup
    key = str(uuid4())
    first = create_intent(client, episode, request_id=key)
    second = create_intent(client, episode, request_id=key)
    assert second.status_code == 200
    assert first.json() == second.json()
    assert RewardIntent.objects.count() == 1
    assert client.get(f"/v1/rewards/{first.json()['id']}").status_code == 401
    assert (
        client.get(f"/v1/rewards/{first.json()['id']}", **headers("other-synthetic")).status_code
        == 404
    )
    other = make_episode(episode.series, order=7, publication_status=PublicationStatus.PUBLISHED)
    assert create_intent(client, other, request_id=key).status_code == 409
    assert (
        client.post("/v1/rewards/intents", {}, content_type="application/json").status_code == 401
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "change", ["consent", "takedown", "free", "policy", "disabled", "production"]
)
def test_intent_fails_closed(client: Client, reward_setup: Any, settings: Any, change: str) -> None:
    from apps.catalog.models import ContentRight
    from apps.entitlements.models import AccessPolicy

    profile, episode = reward_setup
    if change == "consent":
        profile.ads_consent = False
        profile.save(update_fields=["ads_consent"])
    elif change == "takedown":
        ContentRight.objects.update(takedown=True)
    elif change == "free":
        episode.order = 2
        episode.save(update_fields=["order"])
    elif change == "policy":
        AccessPolicy.objects.create(series=episode.series, rewarded_ad_enabled=False)
    elif change == "disabled":
        settings.REWARDED_ADS_MODE = "disabled"
    else:
        settings.DEBUG = False
    assert create_intent(client, episode).status_code == (404 if change == "takedown" else 409)
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
def test_client_cannot_supply_grant_or_user(client: Client, reward_setup: Any) -> None:
    _, episode = reward_setup
    assert create_intent(client, episode, status="granted", user_id="other").status_code == 400
    assert (
        create_intent(
            client, episode, ad_unit_id="ca-app-pub-1111111111111111/2222222222"
        ).status_code
        == 400
    )
    assert not EpisodeEntitlement.objects.exists()

from __future__ import annotations

import base64
from collections.abc import Iterator
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import Client
from django.utils import timezone

from apps.accounts.lifecycle import request_account_deletion
from apps.accounts.models import UserProfile
from apps.accounts.verification import VerifiedToken
from apps.advertising.models import RewardIntent
from apps.catalog.models import ContentRight, PublicationStatus
from apps.entitlements.models import AccessPolicy, EpisodeEntitlement
from tests.advertising.test_rewards_api import create_intent, headers
from tests.catalog.builders import make_episode

CALLBACK = "/v1/rewards/admob/ssv"


@pytest.fixture
def ephemeral_signer(monkeypatch: pytest.MonkeyPatch) -> Iterator[ec.EllipticCurvePrivateKey]:
    key = ec.generate_private_key(ec.SECP256R1())
    pem = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    # Exercise production parsing and cryptography; substitute only public-key HTTP I/O.
    from apps.advertising import verification

    verification.clear_key_cache()
    monkeypatch.setattr(
        verification, "fetch_key_document", lambda: {"keys": [{"keyId": 7, "pem": pem}]}
    )
    yield key
    verification.clear_key_cache()


def signed_query(key: ec.EllipticCurvePrivateKey, intent: dict[str, Any], **changes: Any) -> str:
    fields = {
        "ad_network": "5450213213286189855",
        "ad_unit": intent["ad_unit_id"].rsplit("/", 1)[-1],
        "custom_data": intent["custom_data"],
        "reward_amount": "1",
        "reward_item": "test reward",
        "timestamp": str(int(timezone.now().timestamp() * 1000)),
        "transaction_id": str(uuid4()),
        "user_id": intent["ssv_user_id"],
    }
    fields.update(changes)
    raw = urlencode(fields)
    signature = (
        base64.urlsafe_b64encode(key.sign(raw.encode(), ec.ECDSA(hashes.SHA256())))
        .decode()
        .rstrip("=")
    )
    return f"{raw}&signature={signature}&key_id=7"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "unit_id",
    ["ca-app-pub-3940256099942544/5224354917", "ca-app-pub-1111111111111111/2222222222"],
)
def test_verified_callback_unlocks_once_and_playback_still_checks_rights(
    client: Client,
    reward_setup: Any,
    ephemeral_signer: ec.EllipticCurvePrivateKey,
    monkeypatch: pytest.MonkeyPatch,
    settings: Any,
    unit_id: str,
) -> None:
    from apps.playback.providers.fake import FakeVideoProvider

    profile, episode = reward_setup
    settings.REWARDED_ADS_TEST_UNIT_ID = unit_id
    provider = FakeVideoProvider(hmac_key="synthetic-rewards", ttl_seconds=600)
    provider.seed_ready_asset(episode.media_assets.get().provider_asset_id)
    monkeypatch.setattr("apps.playback.views.get_video_provider", lambda: provider)
    data = create_intent(client, episode).json()
    assert data["ad_unit_id"] == unit_id
    before = client.post(f"/v1/playback/{episode.public_id}/authorize", **headers())
    assert before.json()["decision"] == "locked"
    query = signed_query(ephemeral_signer, data)
    assert client.get(f"{CALLBACK}?{query}").status_code == 200
    assert client.get(f"{CALLBACK}?{query}").status_code == 200
    assert client.get(f"/v1/rewards/{data['id']}", **headers()).json()["status"] == "granted"
    grant = EpisodeEntitlement.objects.get(user_profile=profile, episode=episode)
    assert grant.source == "rewarded_ad"
    assert EpisodeEntitlement.objects.count() == 1
    assert (
        client.post(f"/v1/playback/{episode.public_id}/authorize", **headers()).json()["decision"]
        == "granted"
    )
    ContentRight.objects.update(takedown=True)
    assert (
        client.post(f"/v1/playback/{episode.public_id}/authorize", **headers()).status_code == 404
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "unit_id",
    ["ca-app-pub-3940256099942544/5224354917", "ca-app-pub-1111111111111111/2222222222"],
)
@pytest.mark.parametrize(
    "field,value",
    [
        ("user_id", "wrong-user"),
        ("user_id", "synthetic-\u00e9"),
        ("custom_data", "unknown-intent"),
        ("custom_data", "synthetic-\x00"),
        ("ad_unit", "3333333333"),
        ("ad_network", "123"),
        ("timestamp", "0"),
        ("timestamp", "999999999999999999999"),
        ("reward_amount", "0"),
        ("reward_item", ""),
        ("transaction_id", ""),
    ],
)
def test_signed_mismatch_never_grants(
    client: Client,
    reward_setup: Any,
    ephemeral_signer: ec.EllipticCurvePrivateKey,
    field: str,
    value: str,
    settings: Any,
    unit_id: str,
) -> None:
    _, episode = reward_setup
    settings.REWARDED_ADS_TEST_UNIT_ID = unit_id
    data = create_intent(client, episode).json()
    query = signed_query(ephemeral_signer, data, **{field: value})
    assert client.get(f"{CALLBACK}?{query}").status_code == 400
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "attack", ["tamper", "duplicate", "unknown-key", "extra", "missing", "encoding", "wrong-key"]
)
def test_forgery_and_ambiguous_query_fail_closed(
    client: Client, reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey, attack: str
) -> None:
    _, episode = reward_setup
    data = create_intent(client, episode).json()
    query = signed_query(ephemeral_signer, data)
    if attack == "tamper":
        query = query.replace("reward_amount=1", "reward_amount=2")
    elif attack == "duplicate":
        query = "ad_unit=5224354917&" + query
    elif attack == "unknown-key":
        query = query.replace("key_id=7", "key_id=8")
    elif attack == "extra":
        query += "&custom_data=other"
    elif attack == "missing":
        query = query.split("&signature=")[0]
    elif attack == "encoding":
        query = query.replace("reward_item=test+reward", "reward_item=%ZZ")
    else:
        query = signed_query(ec.generate_private_key(ec.SECP256R1()), data)
    assert client.get(f"{CALLBACK}?{query}").status_code == 400
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "change",
    [
        "expiry",
        "consent",
        "takedown",
        "territory",
        "platform",
        "language",
        "window",
        "unpublish",
        "media",
        "policy",
        "deletion",
        "free",
        "unit-config",
        "disabled",
        "production",
    ],
)
def test_rechecks_eligibility_and_deletion_at_grant(
    client: Client,
    reward_setup: Any,
    ephemeral_signer: ec.EllipticCurvePrivateKey,
    change: str,
    settings: Any,
) -> None:
    profile, episode = reward_setup
    data = create_intent(client, episode).json()
    query = signed_query(ephemeral_signer, data)
    if change == "expiry":
        RewardIntent.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    elif change == "consent":
        UserProfile.objects.filter(pk=profile.pk).update(ads_consent=False)
    elif change in {"takedown", "territory", "platform", "language"}:
        edits: dict[str, dict[str, Any]] = {
            "takedown": {"takedown": True},
            "territory": {"territory_allowlist": ["DE"]},
            "platform": {"platforms": ["ios"]},
            "language": {"languages": ["fr"]},
        }
        ContentRight.objects.update(**edits[change])
    elif change == "window":
        episode.window_ends_at = timezone.now()
        episode.save(update_fields=["window_ends_at"])
    elif change == "unpublish":
        episode.publication_status = PublicationStatus.DRAFT
        episode.save(update_fields=["publication_status"])
    elif change == "media":
        episode.media_assets.update(state="failed")
    elif change == "policy":
        AccessPolicy.objects.create(series=episode.series, rewarded_ad_enabled=False)
    elif change == "free":
        AccessPolicy.objects.create(series=episode.series, free_episode_order_max=10)
    elif change == "unit-config":
        # A different publisher cannot take over an existing intent, even with the same suffix.
        settings.REWARDED_ADS_TEST_UNIT_ID = "ca-app-pub-1111111111111111/5224354917"
    elif change == "disabled":
        settings.REWARDED_ADS_MODE = "disabled"
    elif change == "production":
        settings.DEBUG = False
    else:
        request_account_deletion(
            VerifiedToken(uid=profile.firebase_uid, auth_time=int(timezone.now().timestamp()))
        )
        assert not RewardIntent.objects.exists()
    assert client.get(f"{CALLBACK}?{query}").status_code == 400
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
def test_transaction_cannot_move_to_another_intent(
    client: Client, reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey
) -> None:
    _, episode = reward_setup
    first = create_intent(client, episode).json()
    other_episode = make_episode(
        episode.series, order=7, publication_status=PublicationStatus.PUBLISHED
    )
    second = create_intent(client, other_episode).json()
    txid = str(uuid4())
    assert (
        client.get(
            f"{CALLBACK}?{signed_query(ephemeral_signer, first, transaction_id=txid)}"
        ).status_code
        == 200
    )
    assert (
        client.get(
            f"{CALLBACK}?{signed_query(ephemeral_signer, second, transaction_id=txid)}"
        ).status_code
        == 400
    )
    assert client.get(f"{CALLBACK}?{signed_query(ephemeral_signer, first)}").status_code == 400
    assert EpisodeEntitlement.objects.count() == 1

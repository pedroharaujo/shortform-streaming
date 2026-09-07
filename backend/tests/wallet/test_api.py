from __future__ import annotations

from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import EpisodeAccessMode, PublicationStatus
from apps.entitlements.models import EpisodeEntitlement
from apps.entitlements.policy import resolve_episode_policy
from tests.catalog.builders import make_episode, make_published_title, make_right


def headers(uid: str = "synthetic-coin-owner") -> dict[str, Any]:
    return {"HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}{uid}"}


@pytest.mark.django_db
def test_wallet_requires_authenticated_owner(client: Client) -> None:
    assert client.get("/v1/wallet").status_code == 401
    assert client.get("/v1/wallet", **headers()).json() == {
        "balance": 0,
        "spending_available": False,
    }
    assert client.get("/v1/wallet", **headers())["Cache-Control"] == "no-store"


@pytest.fixture
def coin_setup(settings: Any) -> Any:
    from apps.wallet.models import CoinLedgerEntry, Wallet

    settings.DEBUG = True
    settings.COIN_SPENDING_MODE = "test"
    profile = get_or_create_profile("synthetic-coin-owner")
    wallet = Wallet.objects.create(user_profile=profile)
    CoinLedgerEntry.objects.create(wallet=wallet, reference=uuid4(), kind="purchase", amount=10)
    series, _ = make_published_title(title="Synthetic coins")
    episode = make_episode(series, order=6, publication_status=PublicationStatus.PUBLISHED)
    episode.access_mode = EpisodeAccessMode.COIN
    episode.coin_price = 4
    episode.save(update_fields=["access_mode", "coin_price"])
    return profile, wallet, episode


def unlock_payload(episode: Any) -> dict[str, Any]:
    return {
        "episode_id": episode.public_id,
        "request_id": str(uuid4()),
        "expected_policy_version": resolve_episode_policy(episode).version,
        "expected_coin_price": episode.coin_price,
    }


def unlock(client: Client, payload: dict[str, Any], uid: str = "synthetic-coin-owner") -> Any:
    return client.post("/v1/coins/unlock", payload, content_type="application/json", **headers(uid))


@pytest.mark.django_db
def test_unlock_is_atomic_idempotent_and_owner_scoped(client: Client, coin_setup: Any) -> None:
    from apps.wallet.models import CoinLedgerEntry, CoinUnlock

    profile, wallet, episode = coin_setup
    payload = unlock_payload(episode)
    assert (
        client.get(f"/v1/offers/{episode.public_id}", **headers()).json()["methods"][0]["type"]
        == "coin"
    )
    first = unlock(client, payload)
    assert first.status_code == 200
    assert first.json() == {
        "episode_id": episode.public_id,
        "request_id": payload["request_id"],
        "charged_coins": 4,
        "balance": 6,
    }
    assert first["Cache-Control"] == "no-store"
    assert unlock(client, payload).json() == first.json()
    assert CoinUnlock.objects.filter(wallet=wallet).count() == 1
    assert list(
        CoinLedgerEntry.objects.filter(wallet=wallet, kind="unlock").values_list(
            "amount", flat=True
        )
    ) == [-4]
    assert EpisodeEntitlement.objects.get(user_profile=profile, episode=episode).source == "coin"
    assert (
        client.get(f"/v1/offers/{episode.public_id}", **headers()).json()["decision"] == "granted"
    )
    assert client.get("/v1/wallet", **headers("synthetic-other-owner")).json()["balance"] == 0
    assert unlock(client, payload, "synthetic-other-owner").status_code == 409
    assert client.get("/v1/wallet", **headers()).json()["balance"] == 6


@pytest.mark.django_db
@pytest.mark.parametrize("source", ["staff", "rewarded_ad", "coin"])
def test_existing_entitlement_never_charges(client: Client, coin_setup: Any, source: str) -> None:
    from apps.wallet.models import CoinUnlock

    profile, _, episode = coin_setup
    EpisodeEntitlement.objects.create(user_profile=profile, episode=episode, source=source)
    response = unlock(client, unlock_payload(episode))
    assert response.status_code == 200
    assert response.json()["charged_coins"] == 0
    assert response.json()["balance"] == 10
    assert CoinUnlock.objects.get().ledger_entry_id is None


@pytest.mark.django_db
@pytest.mark.parametrize("change", ["price", "version", "method", "funds", "disabled", "release"])
def test_invalid_offer_leaves_no_financial_mutation(
    client: Client, coin_setup: Any, settings: Any, change: str
) -> None:
    from apps.wallet.models import CoinLedgerEntry, CoinUnlock

    _, _, episode = coin_setup
    payload = unlock_payload(episode)
    if change == "price":
        payload["expected_coin_price"] = 3
    elif change == "version":
        payload["expected_policy_version"] = "0" * 64
    elif change == "method":
        episode.access_mode = EpisodeAccessMode.REWARDED_AD
        episode.coin_price = None
        episode.save()
    elif change == "funds":
        episode.coin_price = 11
        episode.save()
        payload = unlock_payload(episode)
    elif change == "disabled":
        settings.COIN_SPENDING_MODE = "disabled"
    else:
        settings.DEBUG = False
    assert unlock(client, payload).status_code == 409
    assert CoinLedgerEntry.objects.count() == 1
    assert not CoinUnlock.objects.exists()
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("change", ["takedown", "coin_right", "expiry", "drm"])
def test_current_rights_apply_even_to_replays(client: Client, coin_setup: Any, change: str) -> None:
    from datetime import timedelta

    from django.utils import timezone

    from apps.wallet.models import CoinLedgerEntry

    _, _, episode = coin_setup
    episode.series.self_owned = False
    episode.series.save()
    right = make_right(episode.series)
    payload = unlock_payload(episode)
    assert unlock(client, payload).status_code == 200
    if change == "takedown":
        right.takedown = True
    elif change == "coin_right":
        right.coin_access_permission = False
    elif change == "expiry":
        right.ends_at = timezone.now() - timedelta(seconds=1)
    else:
        right.drm_required = True
    right.save()
    assert unlock(client, payload).status_code == 404
    assert CoinLedgerEntry.objects.count() == 2


@pytest.mark.django_db
def test_idempotency_binds_episode_policy_and_price(client: Client, coin_setup: Any) -> None:
    _, _, episode = coin_setup
    payload = unlock_payload(episode)
    assert unlock(client, payload).status_code == 200
    for field, value in (
        ("expected_coin_price", 5),
        ("expected_policy_version", "0" * 64),
        ("episode_id", "epi_unrelated"),
    ):
        assert unlock(client, {**payload, field: value}).status_code == 409


@pytest.mark.django_db
def test_failed_entitlement_insert_rolls_back_debit(client: Client, coin_setup: Any) -> None:
    from apps.wallet.models import CoinLedgerEntry, CoinUnlock

    _, _, episode = coin_setup
    with patch("apps.wallet.services.EpisodeEntitlement.objects.create", side_effect=RuntimeError):
        assert unlock(client, unlock_payload(episode)).status_code == 500
    assert CoinLedgerEntry.objects.count() == 1
    assert not CoinUnlock.objects.exists()
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
def test_new_request_for_owned_or_now_free_episode_never_charges(
    client: Client, coin_setup: Any
) -> None:
    _, _, episode = coin_setup
    assert unlock(client, unlock_payload(episode)).json()["charged_coins"] == 4
    assert unlock(client, unlock_payload(episode)).json()["charged_coins"] == 0
    EpisodeEntitlement.objects.all().delete()
    old_offer = unlock_payload(episode)
    episode.access_mode = EpisodeAccessMode.FREE
    episode.coin_price = None
    episode.save()
    assert unlock(client, old_offer).json()["charged_coins"] == 0
    assert client.get("/v1/wallet", **headers()).json()["balance"] == 6


@pytest.mark.django_db
def test_replay_cannot_recreate_removed_entitlement(client: Client, coin_setup: Any) -> None:
    from apps.wallet.models import CoinLedgerEntry

    _, _, episode = coin_setup
    payload = unlock_payload(episode)
    assert unlock(client, payload).status_code == 200
    EpisodeEntitlement.objects.all().delete()
    assert unlock(client, payload).status_code == 409
    assert not EpisodeEntitlement.objects.exists()
    assert CoinLedgerEntry.objects.count() == 2


@pytest.mark.django_db
def test_expiry_at_final_authorization_never_debits(client: Client, coin_setup: Any) -> None:
    from apps.entitlements.policy import Ineligible
    from apps.wallet.models import CoinLedgerEntry, CoinUnlock

    _, _, episode = coin_setup
    with patch("apps.wallet.services.evaluate_authorize_access", return_value=Ineligible()):
        assert unlock(client, unlock_payload(episode)).status_code == 404
    assert CoinLedgerEntry.objects.count() == 1
    assert not CoinUnlock.objects.exists()
    assert not EpisodeEntitlement.objects.exists()


@pytest.mark.django_db
def test_deletion_detaches_history_and_cannot_restore_coins(
    client: Client, coin_setup: Any
) -> None:
    from apps.accounts.lifecycle import request_account_deletion
    from apps.accounts.verification import VerifiedToken
    from apps.wallet.models import CoinLedgerEntry, CoinUnlock

    profile, wallet, episode = coin_setup
    assert unlock(client, unlock_payload(episode)).status_code == 200
    from django.utils import timezone

    request_account_deletion(
        VerifiedToken(uid=profile.firebase_uid, auth_time=int(timezone.now().timestamp()))
    )
    wallet.refresh_from_db()
    assert wallet.user_profile_id is None
    assert CoinLedgerEntry.objects.count() == 2
    assert CoinUnlock.objects.count() == 1
    assert not EpisodeEntitlement.objects.exists()
    assert client.get("/v1/wallet", **headers()).status_code == 401
    assert client.get("/v1/wallet", **headers("synthetic-replacement")).json()["balance"] == 0


@pytest.mark.django_db
def test_untrusted_financial_fields_and_missing_offer_are_rejected(
    client: Client, coin_setup: Any
) -> None:
    _, _, episode = coin_setup
    for extra in ({"balance": 100}, {"user_profile": "other"}, {"credit": 500}):
        assert unlock(client, {**unlock_payload(episode), **extra}).status_code == 400
    assert (
        unlock(client, {"episode_id": episode.public_id, "request_id": str(uuid4())}).status_code
        == 400
    )

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import EpisodeAccessMode, PublicationStatus
from apps.wallet.models import CoinLedgerEntry, Wallet
from tests.catalog.builders import make_episode, make_published_title


def headers(uid: str = "activity-owner") -> dict[str, Any]:
    return {"HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}{uid}"}


@pytest.mark.django_db
def test_activity_requires_the_account_owner(client: Client) -> None:
    assert client.get("/v1/wallet/activity").status_code == 401
    empty = client.get("/v1/wallet/activity", **headers())
    assert empty.status_code == 200
    assert empty["Cache-Control"] == "no-store"
    assert empty.json() == {"entries": [], "has_more": False}


@pytest.mark.django_db
def test_activity_shows_purchase_and_unlock_without_another_owners_lines(
    client: Client, settings: Any
) -> None:
    settings.DEBUG = True
    settings.COIN_SPENDING_MODE = "test"
    owner = get_or_create_profile("activity-owner")
    other = get_or_create_profile("activity-other")
    wallet = Wallet.objects.create(user_profile=owner)
    other_wallet = Wallet.objects.create(user_profile=other)
    purchase = CoinLedgerEntry.objects.create(
        wallet=wallet, reference=uuid4(), kind="purchase", amount=10
    )
    CoinLedgerEntry.objects.create(
        wallet=other_wallet, reference=uuid4(), kind="purchase", amount=99
    )
    series, _first = make_published_title(title="Activity Harbor")
    episode = make_episode(series, order=6, publication_status=PublicationStatus.PUBLISHED)
    episode.access_mode = EpisodeAccessMode.COIN
    episode.coin_price = 4
    episode.save(update_fields=["access_mode", "coin_price"])

    from apps.entitlements.policy import resolve_episode_policy

    unlock = client.post(
        "/v1/coins/unlock",
        {
            "episode_id": episode.public_id,
            "request_id": str(uuid4()),
            "expected_policy_version": resolve_episode_policy(episode).version,
            "expected_coin_price": 4,
        },
        content_type="application/json",
        **headers(),
    )
    assert unlock.status_code == 200

    response = client.get("/v1/wallet/activity", **headers())
    body = response.json()
    assert body["has_more"] is False
    assert [entry["kind"] for entry in body["entries"]] == ["unlock", "purchase"]
    assert body["entries"][0]["amount"] == -4
    assert body["entries"][0]["balance_after"] == 6
    assert body["entries"][0]["episode_id"] == episode.public_id
    assert body["entries"][0]["episode_title"] == episode.title
    assert body["entries"][1]["id"] == str(purchase.reference)
    assert body["entries"][1]["amount"] == 10
    assert body["entries"][1]["balance_after"] == 10
    assert body["entries"][1]["episode_id"] is None
    assert "99" not in response.content.decode()
    assert str(wallet.pk) not in response.content.decode()

    episode.series.takedown = True
    episode.series.save(update_fields=["takedown"])
    hidden = client.get("/v1/wallet/activity", **headers())
    assert hidden.json()["entries"][0]["episode_id"] is None
    assert hidden.json()["entries"][0]["episode_title"] is None
    assert hidden.json()["entries"][0]["amount"] == -4

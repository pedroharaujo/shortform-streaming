from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from typing import Any
from uuid import UUID, uuid4

import pytest
from django.db import (
    IntegrityError,
    OperationalError,
    close_old_connections,
    connection,
    connections,
    transaction,
)
from django.test import Client

from apps.wallet.models import CoinLedgerEntry, CoinUnlock
from tests.wallet.test_api import coin_setup, headers, unlock, unlock_payload
from tests.wallet.test_races import backend_pid, wait_blocked

__all__ = ["coin_setup"]
pytestmark = pytest.mark.django_db(transaction=True)


def resolve(client: Client, payload: dict[str, Any], uid: str = "synthetic-coin-owner") -> Any:
    return client.post(
        "/v1/coins/unlock/resolve", payload, content_type="application/json", **headers(uid)
    )


def test_saved_before_send_resolution_cancels_old_request_and_allows_fresh_confirmation(
    client: Client, coin_setup: Any
) -> None:
    _, wallet, episode = coin_setup
    original = unlock_payload(episode)
    episode.coin_price = 7
    episode.save()
    cancelled = resolve(client, original)
    assert cancelled.status_code == 200
    assert cancelled.json() == {
        "status": "cancelled",
        "episode_id": episode.public_id,
        "request_id": original["request_id"],
        "charged_coins": 0,
        "balance": 10,
    }
    assert cancelled["Cache-Control"] == "no-store"
    assert resolve(client, original).json() == cancelled.json()
    assert unlock(client, original).status_code == 409
    assert not CoinUnlock.objects.exists()
    assert wallet.entries.count() == 1
    assert unlock(client, unlock_payload(episode)).json()["balance"] == 3


def test_lost_committed_response_resolves_history_without_overriding_current_rights(
    client: Client, coin_setup: Any
) -> None:
    _, wallet, episode = coin_setup
    original = unlock_payload(episode)
    assert unlock(client, original).status_code == 200
    episode.series.takedown = True
    episode.series.save()
    resolved = resolve(client, original)
    assert resolved.status_code == 200
    assert resolved.json() == {
        "status": "completed",
        "episode_id": episode.public_id,
        "request_id": original["request_id"],
        "charged_coins": 4,
        "balance": 6,
    }
    assert client.get(f"/v1/offers/{episode.public_id}", **headers()).status_code == 404
    assert wallet.entries.filter(kind="unlock").count() == 1


@pytest.mark.parametrize("completed", [False, True])
def test_resolution_is_bound_to_original_owner_and_terms(
    client: Client, coin_setup: Any, completed: bool
) -> None:
    _, wallet, episode = coin_setup
    original = unlock_payload(episode)
    first = unlock(client, original) if completed else resolve(client, original)
    assert first.status_code == 200
    for field, value in (
        ("episode_id", "ep_other"),
        ("expected_coin_price", 9),
        ("expected_policy_version", "0" * 64),
    ):
        assert resolve(client, {**original, field: value}).status_code == 409
    assert (
        client.post(
            "/v1/coins/unlock/resolve", original, content_type="application/json"
        ).status_code
        == 401
    )
    other = resolve(client, original, "synthetic-other-owner")
    assert other.status_code == 200
    assert other.json()["status"] == "cancelled"
    assert other.json()["balance"] == 0
    assert wallet.entries.filter(kind="unlock").count() == (1 if completed else 0)


def test_resolving_and_unlocking_concurrently_have_one_terminal_result(coin_setup: Any) -> None:
    from apps.wallet.models import CoinUnlockCancellation

    _, wallet, episode = coin_setup
    original = unlock_payload(episode)
    barrier = Barrier(2)

    def worker(resolving: bool) -> tuple[int, dict[str, Any]]:
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            result = resolve(Client(), original) if resolving else unlock(Client(), original)
            return result.status_code, result.json()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        sending = pool.submit(worker, False)
        resolving = pool.submit(worker, True)
        sent_status, _ = sending.result(timeout=15)
        status, result = resolving.result(timeout=15)
    assert status == 200
    if result["status"] == "completed":
        assert sent_status == 200
        assert not CoinUnlockCancellation.objects.exists()
        assert wallet.entries.filter(kind="unlock").count() == 1
    else:
        assert sent_status == 409
        assert CoinUnlockCancellation.objects.count() == 1
        assert wallet.entries.count() == 1
    assert CoinUnlock.objects.count() + CoinUnlockCancellation.objects.count() == 1
    assert CoinLedgerEntry.objects.filter(wallet=wallet, kind="unlock").count() <= 1


def test_resolution_keeps_disabled_spending_fail_closed(
    client: Client, coin_setup: Any, settings: Any
) -> None:
    from apps.wallet.models import CoinUnlockCancellation

    _, _, episode = coin_setup
    settings.COIN_SPENDING_MODE = "disabled"
    assert resolve(client, unlock_payload(episode)).status_code == 409
    assert not CoinUnlockCancellation.objects.exists()


@pytest.mark.parametrize("isolation", ["READ COMMITTED", "REPEATABLE READ"])
def test_delayed_legacy_writer_cannot_charge_after_cancellation(
    coin_setup: Any, isolation: str
) -> None:
    from apps.entitlements.models import EpisodeEntitlement

    profile, wallet, episode = coin_setup
    original = unlock_payload(episode)
    started = Event()
    pids: list[int] = []

    def old_writer() -> str:
        close_old_connections()
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(f"SET TRANSACTION ISOLATION LEVEL {isolation}")
                # Establish the legacy transaction's snapshot before cancellation commits.
                assert CoinUnlock.objects.filter(wallet=wallet).count() == 0
                pids.append(backend_pid())
                started.set()
                debit = CoinLedgerEntry.objects.create(
                    wallet=wallet, reference=uuid4(), kind="unlock", amount=-4
                )
                EpisodeEntitlement.objects.create(
                    user_profile=profile, episode=episode, source="coin"
                )
                CoinUnlock.objects.create(
                    wallet=wallet,
                    request_id=UUID(original["request_id"]),
                    episode_public_id=episode.public_id,
                    policy_version=original["expected_policy_version"],
                    expected_coin_price=4,
                    charged_coins=4,
                    ledger_entry=debit,
                )
        except (IntegrityError, OperationalError) as error:
            assert "cancelled" in str(error) or "could not serialize" in str(error)
            return "blocked"
        finally:
            connections.close_all()
        return "unsafe completion"

    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            assert resolve(Client(), original).json()["status"] == "cancelled"
            holder = backend_pid()
            future = pool.submit(old_writer)
            assert started.wait(10)
            wait_blocked(pids[0], holder)
        assert future.result(timeout=15) == "blocked"
    assert wallet.entries.count() == 1
    assert not CoinUnlock.objects.exists()
    assert not EpisodeEntitlement.objects.exists()


def test_cancelled_history_is_immutable_and_survives_account_deletion(
    client: Client, coin_setup: Any
) -> None:
    from apps.wallet.models import CoinUnlockCancellation

    profile, wallet, episode = coin_setup
    original = unlock_payload(episode)
    assert resolve(client, original).status_code == 200
    row = CoinUnlockCancellation.objects.get(wallet=wallet)
    for operation in ("update", "delete"):
        with pytest.raises(IntegrityError, match="immutable"), transaction.atomic():
            query = CoinUnlockCancellation.objects.filter(pk=row.pk)
            if operation == "update":
                query.update(expected_coin_price=2)
            else:
                query.delete()
    profile.delete()
    wallet.refresh_from_db()
    assert wallet.user_profile_id is None
    assert CoinUnlockCancellation.objects.filter(pk=row.pk).exists()
    with pytest.raises(IntegrityError, match="detached"), transaction.atomic():
        CoinUnlockCancellation.objects.create(
            wallet=wallet,
            request_id=uuid4(),
            episode_public_id=episode.public_id,
            policy_version="0" * 64,
            expected_coin_price=4,
        )


def test_a_completed_request_cannot_be_cancelled_by_an_old_writer(
    client: Client, coin_setup: Any
) -> None:
    from apps.wallet.models import CoinUnlockCancellation

    _, wallet, episode = coin_setup
    original = unlock_payload(episode)
    assert unlock(client, original).status_code == 200
    with pytest.raises(IntegrityError, match="completed"), transaction.atomic():
        CoinUnlockCancellation.objects.create(
            wallet=wallet,
            request_id=UUID(original["request_id"]),
            episode_public_id=episode.public_id,
            policy_version=original["expected_policy_version"],
            expected_coin_price=4,
        )
    assert wallet.entries.filter(kind="unlock").count() == 1

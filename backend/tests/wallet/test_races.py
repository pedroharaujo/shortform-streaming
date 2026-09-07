from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from time import monotonic, sleep
from typing import Any
from uuid import UUID

import pytest
from django.db import close_old_connections, connection, connections, transaction
from django.test import Client
from django.utils import timezone

from apps.accounts.lifecycle import request_account_deletion
from apps.accounts.verification import VerifiedToken
from apps.catalog.locking import lock_series_for_access
from apps.catalog.models import EpisodeAccessMode, PublicationStatus
from apps.entitlements.models import EpisodeEntitlement
from apps.wallet.models import CoinLedgerEntry, CoinUnlock, CoinUnlockCancellation, Wallet
from tests.catalog.builders import make_episode, make_right
from tests.wallet.test_api import coin_setup, headers, unlock, unlock_payload

__all__ = ["coin_setup"]
pytestmark = pytest.mark.django_db(transaction=True)


def parallel_unlock(payload: dict[str, Any], barrier: Barrier) -> int:
    close_old_connections()
    try:
        barrier.wait(timeout=10)
        return int(unlock(Client(), payload).status_code)
    finally:
        connections.close_all()


@pytest.mark.parametrize("same_request", [True, False])
def test_competing_unlocks_cannot_double_spend(coin_setup: Any, same_request: bool) -> None:
    _, wallet, episode = coin_setup
    episode.coin_price = 7
    episode.save()
    one = unlock_payload(episode)
    if same_request:
        two = one
    else:
        other = make_episode(
            episode.series, order=7, publication_status=PublicationStatus.PUBLISHED
        )
        other.access_mode = EpisodeAccessMode.COIN
        other.coin_price = 7
        other.save()
        two = unlock_payload(other)
    barrier = Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(parallel_unlock, payload, barrier) for payload in (one, two)]
        assert sorted(f.result(timeout=15) for f in futures) == (
            [200, 200] if same_request else [200, 409]
        )
    assert CoinLedgerEntry.objects.filter(wallet=wallet, kind="unlock").count() == 1
    assert CoinUnlock.objects.count() == 1
    assert EpisodeEntitlement.objects.count() == 1
    assert Client().get("/v1/wallet", **headers()).json()["balance"] == 3


def backend_pid() -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_backend_pid()")
        return int(cursor.fetchone()[0])


def wait_blocked(waiter: int, holder: int) -> None:
    end = monotonic() + 10
    while monotonic() < end:
        with connection.cursor() as cursor:
            cursor.execute("SELECT %s = ANY(pg_blocking_pids(%s))", [holder, waiter])
            if cursor.fetchone()[0]:
                return
        sleep(0.01)
    raise AssertionError("Expected a real PostgreSQL lock wait")


def tracked_unlock(
    payload: dict[str, Any], started: Event, pids: list[int], resolving: bool = False
) -> int:
    close_old_connections()
    try:
        pids.append(backend_pid())
        started.set()
        response = (
            Client().post(
                "/v1/coins/unlock/resolve",
                payload,
                content_type="application/json",
                **headers(),
            )
            if resolving
            else unlock(Client(), payload)
        )
        return int(response.status_code)
    finally:
        connections.close_all()


@pytest.mark.parametrize("change", ["price", "takedown"])
def test_editorial_writer_wins_before_debit(coin_setup: Any, change: str) -> None:
    _, _, episode = coin_setup
    payload = unlock_payload(episode)
    started = Event()
    pids: list[int] = []
    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            series = lock_series_for_access(episode.series_id)
            holder = backend_pid()
            future = pool.submit(tracked_unlock, payload, started, pids)
            assert started.wait(10)
            wait_blocked(pids[0], holder)
            if change == "price":
                episode.coin_price = 9
                episode.save()
            else:
                series.takedown = True
                series.save()
        assert future.result(timeout=15) == (409 if change == "price" else 404)
    assert not CoinUnlock.objects.exists()
    assert CoinLedgerEntry.objects.count() == 1


def test_rights_expiring_during_wallet_wait_prevent_debit(
    coin_setup: Any, monkeypatch: Any
) -> None:
    from apps.wallet.services import unlock_episode

    profile, wallet, episode = coin_setup
    episode.series.self_owned = False
    episode.series.save()
    now = timezone.now()
    right = make_right(episode.series, ends_at=now + timedelta(minutes=1))
    assert right.ends_at is not None
    times = [now]
    monkeypatch.setattr("apps.catalog.eligibility.timezone.now", lambda: times[0])
    payload = unlock_payload(episode)
    started = Event()
    pids: list[int] = []

    def worker() -> int:
        from rest_framework.exceptions import NotFound

        close_old_connections()
        try:
            pids.append(backend_pid())
            started.set()
            try:
                unlock_episode(
                    profile,
                    episode.public_id,
                    UUID(payload["request_id"]),
                    expected_policy_version=payload["expected_policy_version"],
                    expected_coin_price=4,
                )
            except NotFound:
                return 404
            return 200
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            Wallet.objects.select_for_update().get(pk=wallet.pk)
            holder = backend_pid()
            future = pool.submit(worker)
            assert started.wait(10)
            wait_blocked(pids[0], holder)
            times[0] = right.ends_at + timedelta(seconds=1)
        assert future.result(timeout=15) == 404
    assert not CoinUnlock.objects.exists()


@pytest.mark.parametrize("resolving", [False, True])
def test_deletion_wins_before_wallet_creation_unlock_or_resolution(
    coin_setup: Any, resolving: bool
) -> None:
    profile, wallet, episode = coin_setup
    started = Event()
    pids: list[int] = []
    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            request_account_deletion(
                VerifiedToken(uid=profile.firebase_uid, auth_time=int(timezone.now().timestamp()))
            )
            holder = backend_pid()
            future = pool.submit(tracked_unlock, unlock_payload(episode), started, pids, resolving)
            assert started.wait(10)
            wait_blocked(pids[0], holder)
        assert future.result(timeout=15) == 401
    wallet.refresh_from_db()
    assert wallet.user_profile_id is None
    assert not CoinUnlock.objects.exists()
    assert not CoinUnlockCancellation.objects.exists()
    assert CoinLedgerEntry.objects.count() == 1

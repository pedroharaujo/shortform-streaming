from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from typing import Any
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from django.db import close_old_connections, connections
from django.test import Client
from django.utils import timezone

from apps.accounts.lifecycle import request_account_deletion
from apps.accounts.models import UserProfile
from apps.accounts.verification import VerifiedToken
from apps.advertising.models import RewardIntent
from apps.entitlements.models import EpisodeEntitlement
from tests.advertising.test_callbacks import CALLBACK, signed_query
from tests.advertising.test_rewards_api import create_intent


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_transaction", [True, False])
def test_simultaneous_callbacks_have_one_grant(
    reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey, same_transaction: bool
) -> None:
    _, episode = reward_setup
    data = create_intent(Client(), episode).json()
    first = signed_query(ephemeral_signer, data)
    second = first if same_transaction else signed_query(ephemeral_signer, data)
    barrier = Barrier(2)

    def send(query: str) -> int:
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return Client().get(f"{CALLBACK}?{query}").status_code
        finally:
            connections["default"].close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(send, [first, second]))
    assert sorted(outcomes) == ([200, 200] if same_transaction else [200, 400])
    assert EpisodeEntitlement.objects.count() == 1
    assert RewardIntent.objects.exclude(granted_at=None).count() == 1


@pytest.mark.django_db(transaction=True)
def test_grant_racing_deletion_leaves_no_user_data(
    reward_setup: Any, ephemeral_signer: ec.EllipticCurvePrivateKey
) -> None:
    profile, episode = reward_setup
    data = create_intent(Client(), episode).json()
    query = signed_query(ephemeral_signer, data)
    ready = Event()
    release = Event()

    def grant() -> int:
        close_old_connections()
        database = connections["default"]
        original_commit = database.commit

        def paused_commit() -> None:
            ready.set()
            assert release.wait(timeout=10)
            original_commit()

        try:
            with patch.object(database, "commit", side_effect=paused_commit):
                return Client().get(f"{CALLBACK}?{query}").status_code
        finally:
            database.close()

    deletion_started = Event()

    def delete() -> None:
        close_old_connections()
        try:
            deletion_started.set()
            request_account_deletion(
                VerifiedToken(uid=profile.firebase_uid, auth_time=int(timezone.now().timestamp()))
            )
        finally:
            connections["default"].close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        granting = pool.submit(grant)
        try:
            assert ready.wait(timeout=10)
            deleting = pool.submit(delete)
            assert deletion_started.wait(timeout=10)
        finally:
            release.set()
        assert granting.result(timeout=10) == 200
        deleting.result(timeout=10)
    assert not UserProfile.objects.filter(pk=profile.pk).exists()
    assert not RewardIntent.objects.exists()
    assert not EpisodeEntitlement.objects.exists()
    assert Client().get(f"{CALLBACK}?{query}").status_code == 400

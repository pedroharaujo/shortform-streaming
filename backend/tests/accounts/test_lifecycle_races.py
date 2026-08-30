from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event
from time import monotonic
from unittest.mock import patch

import pytest
from django.db import close_old_connections, connection, connections
from django.utils import timezone

from apps.accounts.lifecycle import process_account_deletion, request_account_deletion
from apps.accounts.models import AccountDeletion, UserProfile
from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import VerifiedToken


@pytest.mark.django_db(transaction=True)
def test_deletion_cannot_miss_an_uncommitted_first_profile() -> None:
    uid = "synthetic-first-profile-race"
    ready_to_commit = Event()
    release_commit = Event()
    worker_pids: Queue[int] = Queue()

    def authenticate() -> None:
        close_old_connections()
        database = connections["default"]
        try:
            with database.cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                worker_pids.put(int(cursor.fetchone()[0]))
            original_commit = database.commit

            def paused_commit() -> None:
                # Pause after all provisioning checks, not just after INSERT:
                # a second tombstone lookup alone cannot prevent this race.
                ready_to_commit.set()
                assert release_commit.wait(10), "First-profile transaction was not released"
                original_commit()

            with patch.object(database, "commit", side_effect=paused_commit):
                get_or_create_profile(uid)
        finally:
            close_old_connections()

    def delete() -> AccountDeletion:
        close_old_connections()
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                worker_pids.put(int(cursor.fetchone()[0]))
            receipt = request_account_deletion(
                VerifiedToken(uid=uid, auth_time=int(timezone.now().timestamp()))
            )
            return process_account_deletion(receipt.public_id)
        finally:
            close_old_connections()

    assert not UserProfile.objects.filter(firebase_uid=uid).exists()
    with patch("apps.accounts.lifecycle.delete_firebase_user") as provider:
        with ThreadPoolExecutor(max_workers=2) as pool:
            authentication = pool.submit(authenticate)
            try:
                assert ready_to_commit.wait(10), "First-profile creation never reached commit"
                authentication_pid = worker_pids.get(timeout=10)
                deletion = pool.submit(delete)
                deletion_pid = worker_pids.get(timeout=10)
                deadline = monotonic() + 10
                with connection.cursor() as cursor:
                    while not deletion.done():
                        cursor.execute("SELECT pg_blocking_pids(%s)", [deletion_pid])
                        if authentication_pid in cursor.fetchone()[0]:
                            break
                        assert monotonic() < deadline, "Deletion neither waited nor completed"
            finally:
                release_commit.set()
            authentication.result(timeout=10)
            receipt = deletion.result(timeout=10)

    assert receipt.status == "completed"
    assert AccountDeletion.objects.count() == 1
    assert not UserProfile.objects.filter(firebase_uid=uid).exists()
    provider.assert_called_once_with(uid)


@pytest.mark.django_db
def test_previous_revision_can_insert_profile_after_preferences_migration() -> None:
    # The previous application revision supplies only these four columns while
    # migration runs before traffic switches. Python defaults cannot help it.
    now = timezone.now()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO accounts_userprofile (public_id, firebase_uid, created_at, updated_at)
            VALUES (%s, %s, %s, %s)
            """,
            ["usr_synthetic_previous_revision", "synthetic-previous-revision", now, now],
        )

    profile = UserProfile.objects.get(firebase_uid="synthetic-previous-revision")
    assert profile.locale == "en"
    assert profile.country == ""
    assert profile.analytics_consent is False
    assert profile.ads_consent is False
    assert profile.consent_updated_at is None

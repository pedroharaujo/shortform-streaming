from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from io import StringIO
from queue import Queue
from threading import Event
from time import monotonic, sleep
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection, connections, transaction

from apps.accounts.models import UserProfile
from apps.progress.models import WatchProgress, upsert_watch_progress
from tests.catalog.builders import make_published_title

DEVICE_A = "11111111-2222-4333-8444-555555555555"
DEVICE_B = "66666666-2222-4333-8444-555555555555"
NOW = datetime(2026, 9, 20, 12, tzinfo=UTC)
CUTOFF = datetime(2025, 9, 20, 12, tzinfo=UTC)


def run_cleanup(*args: str, now: datetime = NOW) -> str:
    output = StringIO()
    with patch("django.utils.timezone.now", return_value=now):
        call_command("expire_guest_progress", *args, stdout=output)
    return output.getvalue()


@pytest.mark.django_db
def test_preview_then_bounded_apply_expires_only_old_guest_progress() -> None:
    _, episode = make_published_title(title="Retention fixture")
    profile = UserProfile.objects.create(firebase_uid="retention-test-profile")
    old = WatchProgress.objects.create(device_id=DEVICE_A, episode=episode)
    boundary = WatchProgress.objects.create(device_id=DEVICE_B, episode=episode)
    account = WatchProgress.objects.create(user_profile=profile, episode=episode)
    WatchProgress.objects.filter(pk__in=[old.pk, account.pk]).update(
        updated_at=CUTOFF - timedelta(seconds=1)
    )
    WatchProgress.objects.filter(pk=boundary.pk).update(updated_at=CUTOFF)
    _, newer_episode = make_published_title(title="Recent fixture")
    newer = WatchProgress.objects.create(device_id=DEVICE_A, episode=newer_episode)
    WatchProgress.objects.filter(pk=newer.pk).update(
        created_at=CUTOFF - timedelta(days=100), updated_at=CUTOFF + timedelta(seconds=1)
    )

    preview = run_cleanup("--limit", "1")
    assert "Preview: 1" in preview
    assert WatchProgress.objects.count() == 4
    result = run_cleanup("--apply", "--limit", "1")
    assert "Deleted: 1" in result
    assert not WatchProgress.objects.filter(pk=old.pk).exists()
    assert WatchProgress.objects.filter(pk=boundary.pk).exists()
    assert "Deleted: 1" in run_cleanup("--apply")
    assert "Deleted: 0" in run_cleanup("--apply")
    assert set(WatchProgress.objects.values_list("pk", flat=True)) == {account.pk, newer.pk}
    for private_value in (DEVICE_A, DEVICE_B, profile.firebase_uid, episode.public_id):
        assert private_value not in preview + result


@pytest.mark.django_db(transaction=True)
def test_progress_write_waiting_for_cleanup_creates_fresh_resume_row() -> None:
    _, episode = make_published_title(title="Cleanup first fixture")
    old = WatchProgress.objects.create(device_id=DEVICE_A, episode=episode)
    WatchProgress.objects.filter(pk=old.pk).update(updated_at=CUTOFF - timedelta(days=1))
    writer_pid: Queue[int] = Queue()

    def writer() -> None:
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                writer_pid.put(int(cursor.fetchone()[0]))
            upsert_watch_progress(
                episode=episode,
                user_profile=None,
                device_id=DEVICE_A,
                position_seconds=11,
                completed=False,
            )
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            assert "Deleted: 1" in run_cleanup("--apply")
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                cleanup_pid = int(cursor.fetchone()[0])
            future = pool.submit(writer)
            pid = writer_pid.get(timeout=10)
            deadline = monotonic() + 10
            with connection.cursor() as cursor:
                while True:
                    cursor.execute("SELECT pg_blocking_pids(%s)", [pid])
                    if cleanup_pid in cursor.fetchone()[0]:
                        break
                    assert not future.done(), "Writer did not wait for cleanup"
                    assert monotonic() < deadline, "Writer did not reach the locked row"
                    sleep(0.01)
        future.result(timeout=10)
    fresh = WatchProgress.objects.get(device_id=DEVICE_A, episode=episode)
    assert fresh.pk != old.pk
    assert fresh.position_seconds == 11
    assert fresh.updated_at > CUTOFF


@pytest.mark.django_db
def test_calendar_cutoff_handles_leap_day_without_using_365_days() -> None:
    _, episode = make_published_title(title="Leap year fixture")
    expired = WatchProgress.objects.create(device_id=DEVICE_A, episode=episode)
    newer = WatchProgress.objects.create(device_id=DEVICE_B, episode=episode)
    leap_now = datetime(2024, 2, 29, 12, tzinfo=UTC)
    WatchProgress.objects.filter(pk=expired.pk).update(
        updated_at=datetime(2023, 2, 28, 12, tzinfo=UTC)
    )
    WatchProgress.objects.filter(pk=newer.pk).update(
        updated_at=datetime(2023, 2, 28, 12, 0, 1, tzinfo=UTC)
    )
    assert "Deleted: 1" in run_cleanup("--apply", now=leap_now)
    assert list(WatchProgress.objects.values_list("pk", flat=True)) == [newer.pk]


@pytest.mark.parametrize("limit", ["0", "-1", "1001"])
def test_invalid_batch_limit_fails_before_database_access(limit: str) -> None:
    with pytest.raises(CommandError, match="between 1 and 1000"):
        run_cleanup("--apply", "--limit", limit)


@pytest.mark.django_db(transaction=True)
def test_cleanup_skips_guest_progress_being_updated_and_preserves_new_position() -> None:
    _, episode = make_published_title(title="Concurrent retention fixture")
    row = WatchProgress.objects.create(device_id=DEVICE_A, episode=episode)
    WatchProgress.objects.filter(pk=row.pk).update(updated_at=CUTOFF - timedelta(days=1))
    updated = Event()
    release = Event()

    def writer() -> None:
        try:
            with transaction.atomic():
                upsert_watch_progress(
                    episode=episode,
                    user_profile=None,
                    device_id=DEVICE_A,
                    position_seconds=11,
                    completed=False,
                )
                updated.set()
                assert release.wait(10)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(writer)
        try:
            assert updated.wait(10)
            assert "Deleted: 0" in run_cleanup("--apply")
        finally:
            release.set()
        future.result(timeout=10)
    row.refresh_from_db()
    assert row.position_seconds == 11
    assert row.updated_at > CUTOFF
    assert "Deleted: 0" in run_cleanup("--apply")

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import IntegrityError, connections, transaction

from apps.accounts.models import UserProfile
from apps.progress.models import WatchProgress, upsert_watch_progress
from tests.catalog.builders import make_published_title

DEVICE_A = "11111111-2222-4333-8444-555555555555"
DEVICE_B = "66666666-2222-4333-8444-555555555555"


@pytest.mark.django_db
def test_xor_check_rejects_both_or_neither_subject() -> None:
    profile = UserProfile.objects.create(firebase_uid="uid-xor")
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            WatchProgress.objects.create(
                user_profile=profile,
                device_id=DEVICE_A,
                episode=episode,
                position_seconds=1,
            )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            WatchProgress.objects.create(
                user_profile=None,
                device_id=None,
                episode=episode,
                position_seconds=1,
            )
    WatchProgress.objects.create(
        user_profile=profile,
        device_id=None,
        episode=episode,
        position_seconds=1,
    )
    WatchProgress.objects.create(
        user_profile=None,
        device_id=DEVICE_A,
        episode=episode,
        position_seconds=2,
    )
    assert WatchProgress.objects.filter(episode=episode).count() == 2


@pytest.mark.django_db
def test_partial_unique_constraints() -> None:
    profile = UserProfile.objects.create(firebase_uid="uid-unique")
    other = UserProfile.objects.create(firebase_uid="uid-other")
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    WatchProgress.objects.create(user_profile=profile, episode=episode, position_seconds=1)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            WatchProgress.objects.create(user_profile=profile, episode=episode, position_seconds=2)
    WatchProgress.objects.create(user_profile=other, episode=episode, position_seconds=3)
    WatchProgress.objects.create(device_id=DEVICE_A, episode=episode, position_seconds=4)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            WatchProgress.objects.create(device_id=DEVICE_A, episode=episode, position_seconds=5)
    WatchProgress.objects.create(device_id=DEVICE_B, episode=episode, position_seconds=6)
    assert WatchProgress.objects.filter(episode=episode).count() == 4


@pytest.mark.django_db(transaction=True)
def test_concurrent_upsert_keeps_one_row() -> None:
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    episode_id = episode.pk
    results: list[str] = []

    def write() -> None:
        try:
            upsert_watch_progress(
                episode=episode.__class__.objects.get(pk=episode_id),
                user_profile=None,
                device_id=DEVICE_A,
                position_seconds=11,
                completed=False,
            )
            results.append("ok")
        except IntegrityError:
            results.append("integrity")
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(write), pool.submit(write)]
        for future in futures:
            future.result()

    assert "ok" in results
    assert WatchProgress.objects.filter(device_id=DEVICE_A, episode_id=episode_id).count() == 1

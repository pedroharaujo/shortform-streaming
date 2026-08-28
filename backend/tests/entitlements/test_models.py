from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import IntegrityError, connections, transaction

from apps.accounts.models import UserProfile
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from tests.catalog.builders import make_published_title
from tests.entitlements.builders import grant_staff_entitlement


@pytest.mark.django_db
def test_unique_profile_episode_rejects_second_source() -> None:
    profile = UserProfile.objects.create(firebase_uid="uid-unique")
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    grant_staff_entitlement(profile, episode)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            EpisodeEntitlement.objects.create(
                user_profile=profile,
                episode=episode,
                source=EntitlementSource.REWARDED_AD,
            )
    assert EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_insert_of_same_pair_keeps_one_row() -> None:
    profile = UserProfile.objects.create(firebase_uid="uid-concurrent")
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    profile_id = profile.pk
    episode_id = episode.pk
    results: list[str] = []

    def insert() -> None:
        try:
            EpisodeEntitlement.objects.create(
                user_profile_id=profile_id,
                episode_id=episode_id,
                source=EntitlementSource.STAFF,
            )
            results.append("ok")
        except IntegrityError:
            results.append("integrity")
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(insert), pool.submit(insert)]
        for future in futures:
            future.result()

    assert "ok" in results
    assert (
        EpisodeEntitlement.objects.filter(user_profile_id=profile_id, episode_id=episode_id).count()
        == 1
    )

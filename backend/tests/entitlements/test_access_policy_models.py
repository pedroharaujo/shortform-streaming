from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.entitlements.models import AccessPolicy
from tests.catalog.builders import make_published_title
from tests.entitlements.builders import make_series_access_policy


@pytest.mark.django_db
def test_missing_row_is_allowed_and_unique_series_level() -> None:
    series, _episode = make_published_title(title="Policy Series", territory="FR")
    make_series_access_policy(series, free_episode_order_max=5)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            AccessPolicy.objects.create(series=series, episode=None, free_episode_order_max=3)


@pytest.mark.django_db
def test_unique_episode_override() -> None:
    series, episode = make_published_title(title="Override Series", territory="FR")
    AccessPolicy.objects.create(series=series, episode=episode, force_free=True)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            AccessPolicy.objects.create(series=series, episode=episode, force_lock=True)


@pytest.mark.django_db
def test_clean_rejects_coins_subscription_and_force_both() -> None:
    series, episode = make_published_title(title="Invalid Combos", territory="FR")
    coins = AccessPolicy(series=series, coin_unlock_enabled=True)
    with pytest.raises(ValidationError) as coins_exc:
        coins.full_clean()
    assert "coin_unlock_enabled" in coins_exc.value.message_dict

    subs = AccessPolicy(series=series, subscription_unlock_enabled=True)
    with pytest.raises(ValidationError) as subs_exc:
        subs.full_clean()
    assert "subscription_unlock_enabled" in subs_exc.value.message_dict

    both = AccessPolicy(series=series, episode=episode, force_free=True, force_lock=True)
    with pytest.raises(ValidationError):
        both.full_clean()

    series_force = AccessPolicy(series=series, episode=None, force_free=True)
    with pytest.raises(ValidationError):
        series_force.full_clean()


@pytest.mark.django_db
def test_series_level_force_flags_rejected_by_database() -> None:
    series, _episode = make_published_title(title="Series Force Db", territory="FR")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            AccessPolicy.objects.create(series=series, episode=None, force_free=True)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            AccessPolicy.objects.create(series=series, episode=None, force_lock=True)


@pytest.mark.django_db
def test_clean_rejects_episode_series_mismatch() -> None:
    series_a, episode_a = make_published_title(title="Series A", territory="FR")
    series_b, _episode_b = make_published_title(title="Series B", territory="FR")
    mismatched = AccessPolicy(series=series_b, episode=episode_a)
    with pytest.raises(ValidationError) as exc:
        mismatched.full_clean()
    assert "episode" in exc.value.message_dict


@pytest.mark.django_db
def test_save_writes_revision_snapshot() -> None:
    series, _episode = make_published_title(title="Revision Series", territory="FR")
    policy = AccessPolicy.objects.create(series=series, free_episode_order_max=4)
    policy.free_episode_order_max = 2
    policy.save()
    assert policy.revisions.count() == 2
    latest = policy.revisions.order_by("-changed_at", "-id").first()
    assert latest is not None
    assert latest.free_episode_order_max == 2
    assert latest.coin_unlock_enabled is False

from __future__ import annotations

from apps.accounts.models import UserProfile
from apps.catalog.models import Episode, Series
from apps.entitlements.models import AccessPolicy, EntitlementSource, EpisodeEntitlement


def grant_staff_entitlement(profile: UserProfile, episode: Episode) -> EpisodeEntitlement:
    """Test/staff grant. Does not mint playback URLs."""
    return EpisodeEntitlement.objects.create(
        user_profile=profile,
        episode=episode,
        source=EntitlementSource.STAFF,
    )


def make_series_access_policy(
    series: Series,
    *,
    free_episode_order_max: int = 5,
    rewarded_ad_enabled: bool = True,
) -> AccessPolicy:
    return AccessPolicy.objects.create(
        series=series,
        episode=None,
        free_episode_order_max=free_episode_order_max,
        rewarded_ad_enabled=rewarded_ad_enabled,
    )


def make_episode_access_policy(
    episode: Episode,
    *,
    force_free: bool = False,
    force_lock: bool = False,
) -> AccessPolicy:
    """Episode override using model defaults for series-wide fields (max 5, ads on)."""
    return AccessPolicy.objects.create(
        series=episode.series,
        episode=episode,
        force_free=force_free,
        force_lock=force_lock,
    )

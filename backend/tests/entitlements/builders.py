from __future__ import annotations

from apps.accounts.models import UserProfile
from apps.catalog.models import Episode
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement


def grant_staff_entitlement(profile: UserProfile, episode: Episode) -> EpisodeEntitlement:
    """Test/staff grant. Does not mint playback URLs."""
    return EpisodeEntitlement.objects.create(
        user_profile=profile,
        episode=episode,
        source=EntitlementSource.STAFF,
    )

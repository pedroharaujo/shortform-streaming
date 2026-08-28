from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from django.db.models import Q

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import CatalogRequestContext, episode_is_eligible
from apps.catalog.models import Episode
from apps.entitlements.models import AccessPolicy, EpisodeEntitlement

# D-006: first five episodes per season by Episode.order. Not Remote Config.
DEFAULT_FREE_EPISODE_ORDER_MAX = 5
DEFAULT_REWARDED_AD_ENABLED = True
FREE_EPISODE_ORDER_MAX = DEFAULT_FREE_EPISODE_ORDER_MAX


class LockReason(StrEnum):
    LOGIN_REQUIRED = "login_required"
    ENTITLEMENT_REQUIRED = "entitlement_required"


class GrantSource(StrEnum):
    ENTITLEMENT = "entitlement"
    FREE = "free"


@dataclass(frozen=True, slots=True)
class Ineligible:
    """Catalog-ineligible: authorize must 404 and must not mint."""


@dataclass(frozen=True, slots=True)
class Grant:
    """Catalog-eligible and entitled or inside the D-006 free window. View may mint."""

    source: GrantSource


@dataclass(frozen=True, slots=True)
class Lock:
    """Catalog-eligible but not playable. Return lock_reasons and never mint."""

    lock_reasons: tuple[LockReason, ...]


@dataclass(frozen=True, slots=True)
class ResolvedAccessPolicy:
    free_episode_order_max: int
    rewarded_ad_enabled: bool
    force_free: bool
    force_lock: bool


AuthorizeAccess = Ineligible | Grant | Lock


def resolve_access_policy(episode: Episode) -> ResolvedAccessPolicy:
    """Load at most the series-level row and the episode override.

    Empty table → D-006 defaults (order 1–5 free, rewarded ads on).
    Episode override, when present, replaces the series-level row.
    """
    rows = AccessPolicy.objects.filter(
        Q(series_id=episode.series_id, episode_id__isnull=True) | Q(episode_id=episode.pk)
    )
    series_row: AccessPolicy | None = None
    override: AccessPolicy | None = None
    for row in rows:
        if row.episode_id == episode.pk:
            override = row
        elif row.episode_id is None:
            series_row = row
    chosen = override or series_row
    if chosen is None:
        return ResolvedAccessPolicy(
            free_episode_order_max=DEFAULT_FREE_EPISODE_ORDER_MAX,
            rewarded_ad_enabled=DEFAULT_REWARDED_AD_ENABLED,
            force_free=False,
            force_lock=False,
        )
    return ResolvedAccessPolicy(
        free_episode_order_max=chosen.free_episode_order_max,
        rewarded_ad_enabled=chosen.rewarded_ad_enabled,
        force_free=chosen.force_free,
        force_lock=chosen.force_lock,
    )


def episode_is_free(episode: Episode, policy: ResolvedAccessPolicy) -> bool:
    if policy.force_free:
        return True
    if policy.force_lock:
        return False
    return 1 <= episode.order <= policy.free_episode_order_max


def evaluate_authorize_access(
    episode: Episode,
    context: CatalogRequestContext,
    profile: UserProfile | None,
    *,
    now: datetime | None = None,
) -> AuthorizeAccess:
    """Precedence: ineligible → entitlement → free policy → lock.

    Never mints a playback URL. The view mints only after Grant. Ads-off does
    not grant past the free window. Request body is not read.
    """
    if not episode_is_eligible(episode, context, now=now):
        return Ineligible()
    if (
        profile is not None
        and EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode).exists()
    ):
        return Grant(GrantSource.ENTITLEMENT)
    policy = resolve_access_policy(episode)
    if episode_is_free(episode, policy):
        return Grant(GrantSource.FREE)
    if profile is None:
        return Lock(lock_reasons=(LockReason.LOGIN_REQUIRED,))
    return Lock(lock_reasons=(LockReason.ENTITLEMENT_REQUIRED,))

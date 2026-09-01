from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from django.db.models import Q

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import CatalogRequestContext, episode_is_eligible
from apps.catalog.models import Episode
from apps.entitlements.models import AccessPolicy, EntitlementSource, EpisodeEntitlement

# D-006: first five episodes per season by Episode.order. Not Remote Config.
DEFAULT_FREE_EPISODE_ORDER_MAX = 5
DEFAULT_REWARDED_AD_ENABLED = True
FREE_EPISODE_ORDER_MAX = DEFAULT_FREE_EPISODE_ORDER_MAX


class LockReason(StrEnum):
    LOGIN_REQUIRED = "login_required"
    ENTITLEMENT_REQUIRED = "entitlement_required"


class GrantSource(StrEnum):
    FREE = "free"
    REWARDED_AD = "rewarded_ad"
    STAFF = "staff"


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
    Episode override contributes only force_free and force_lock.
    free_episode_order_max and rewarded_ad_enabled always come from the
    series-level row, else DEFAULT_FREE_EPISODE_ORDER_MAX /
    DEFAULT_REWARDED_AD_ENABLED.
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
    if series_row is None:
        free_episode_order_max = DEFAULT_FREE_EPISODE_ORDER_MAX
        rewarded_ad_enabled = DEFAULT_REWARDED_AD_ENABLED
    else:
        free_episode_order_max = series_row.free_episode_order_max
        rewarded_ad_enabled = series_row.rewarded_ad_enabled
    return ResolvedAccessPolicy(
        free_episode_order_max=free_episode_order_max,
        rewarded_ad_enabled=rewarded_ad_enabled,
        force_free=override.force_free if override is not None else False,
        force_lock=override.force_lock if override is not None else False,
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
    if profile is not None:
        entitlement_source = (
            EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode)
            .values_list("source", flat=True)
            .first()
        )
        if entitlement_source == EntitlementSource.REWARDED_AD:
            return Grant(GrantSource.REWARDED_AD)
        if entitlement_source is not None:
            return Grant(GrantSource.STAFF)
    policy = resolve_access_policy(episode)
    if episode_is_free(episode, policy):
        return Grant(GrantSource.FREE)
    if profile is None:
        return Lock(lock_reasons=(LockReason.LOGIN_REQUIRED,))
    return Lock(lock_reasons=(LockReason.ENTITLEMENT_REQUIRED,))


class OfferMethodType(StrEnum):
    ENTITLEMENT = "entitlement"
    FREE = "free"
    REWARDED_AD = "rewarded_ad"


@dataclass(frozen=True, slots=True)
class OfferMethod:
    type: OfferMethodType
    title: str
    description: str


@dataclass(frozen=True, slots=True)
class OffersGranted:
    methods: tuple[OfferMethod, ...]


@dataclass(frozen=True, slots=True)
class OffersLocked:
    lock_reasons: tuple[LockReason, ...]
    methods: tuple[OfferMethod, ...]


_OFFER_COPY: dict[OfferMethodType, tuple[str, str]] = {
    OfferMethodType.ENTITLEMENT: (
        "Unlocked",
        "This episode is already unlocked on your account.",
    ),
    OfferMethodType.FREE: ("Free episode", "Included in the free preview."),
    OfferMethodType.REWARDED_AD: (
        "Watch an ad to unlock",
        "Watch one rewarded ad to unlock this episode permanently.",
    ),
}


def _offer_method(kind: OfferMethodType) -> OfferMethod:
    title, description = _OFFER_COPY[kind]
    return OfferMethod(type=kind, title=title, description=description)


def evaluate_episode_offers(
    episode: Episode,
    context: CatalogRequestContext,
    profile: UserProfile | None,
    *,
    now: datetime | None = None,
) -> Ineligible | OffersGranted | OffersLocked:
    """Same authorize precedence; never mints. Anonymous locks omit rewarded-ad (D-005)."""
    decision = evaluate_authorize_access(episode, context, profile, now=now)
    if isinstance(decision, Ineligible):
        return Ineligible()
    if isinstance(decision, Grant):
        kind = (
            OfferMethodType.FREE
            if decision.source == GrantSource.FREE
            else OfferMethodType.ENTITLEMENT
        )
        return OffersGranted(methods=(_offer_method(kind),))
    methods: tuple[OfferMethod, ...] = ()
    if profile is not None and resolve_access_policy(episode).rewarded_ad_enabled:
        methods = (_offer_method(OfferMethodType.REWARDED_AD),)
    return OffersLocked(lock_reasons=decision.lock_reasons, methods=methods)

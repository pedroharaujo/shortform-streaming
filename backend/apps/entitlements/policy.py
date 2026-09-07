from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from enum import StrEnum

from django.conf import settings

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import episode_is_eligible
from apps.catalog.models import Episode, EpisodeAccessMode
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from apps.wallet.capabilities import coin_spending_enabled

DEFAULT_FREE_EPISODE_COUNT = 5


class LockReason(StrEnum):
    LOGIN_REQUIRED = "login_required"
    ENTITLEMENT_REQUIRED = "entitlement_required"


class GrantSource(StrEnum):
    FREE = "free"
    REWARDED_AD = "rewarded_ad"
    STAFF = "staff"
    COIN = "coin"


@dataclass(frozen=True, slots=True)
class Ineligible:
    """Unavailable catalog item: callers return 404 and never mint playback."""


@dataclass(frozen=True, slots=True)
class Grant:
    source: GrantSource


@dataclass(frozen=True, slots=True)
class Lock:
    lock_reasons: tuple[LockReason, ...]


AuthorizeAccess = Ineligible | Grant | Lock


@dataclass(frozen=True, slots=True)
class ResolvedEpisodePolicy:
    effective_mode: str
    coin_price: int | None
    ad_available: bool
    version: str


def resolve_episode_policy(episode: Episode) -> ResolvedEpisodePolicy:
    """Resolve editorial inputs into an immutable, opaque policy snapshot."""
    configured_mode = episode.access_mode
    effective_mode: str
    if configured_mode == EpisodeAccessMode.INHERIT:
        effective_mode = (
            EpisodeAccessMode.FREE
            if 1 <= episode.order <= episode.series.free_episode_count
            else EpisodeAccessMode.REWARDED_AD
        )
    else:
        effective_mode = str(configured_mode)

    provider_mode = settings.REWARDED_ADS_MODE
    ad_available = (
        effective_mode in (EpisodeAccessMode.REWARDED_AD, EpisodeAccessMode.BOTH)
        and episode.series.rewarded_ads_enabled
        and provider_mode in {"test", "production"}
    )
    inputs = {
        "episode_id": episode.pk,
        "episode_public_id": episode.public_id,
        "series_id": episode.series_id,
        "series_public_id": episode.series.public_id,
        "access_mode": configured_mode,
        "coin_price": episode.coin_price,
        "episode_order": episode.order,
        "free_episode_count": episode.series.free_episode_count,
        "rewarded_ads_enabled": episode.series.rewarded_ads_enabled,
        "rewarded_ads_mode": provider_mode,
    }
    version = hashlib.sha256(
        json.dumps(inputs, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return ResolvedEpisodePolicy(
        effective_mode=effective_mode,
        coin_price=episode.coin_price,
        ad_available=ad_available,
        version=version,
    )


def episode_is_free(episode: Episode) -> bool:
    return resolve_episode_policy(episode).effective_mode == EpisodeAccessMode.FREE


def evaluate_authorize_access(
    episode: Episode,
    profile: UserProfile | None,
) -> AuthorizeAccess:
    """Apply availability, permanent entitlement, free window, then account lock."""
    if not episode_is_eligible(episode):
        return Ineligible()
    if profile is not None:
        source = (
            EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode)
            .values_list("source", flat=True)
            .first()
        )
        if source == EntitlementSource.REWARDED_AD:
            return Grant(GrantSource.REWARDED_AD)
        if source == EntitlementSource.STAFF:
            return Grant(GrantSource.STAFF)
        if source == EntitlementSource.COIN:
            return Grant(GrantSource.COIN)
    if episode_is_free(episode):
        return Grant(GrantSource.FREE)
    if profile is None:
        return Lock((LockReason.LOGIN_REQUIRED,))
    return Lock((LockReason.ENTITLEMENT_REQUIRED,))


class OfferMethodType(StrEnum):
    ENTITLEMENT = "entitlement"
    FREE = "free"
    REWARDED_AD = "rewarded_ad"
    COIN = "coin"


@dataclass(frozen=True, slots=True)
class OfferMethod:
    type: OfferMethodType
    title: str
    description: str


@dataclass(frozen=True, slots=True)
class OffersGranted:
    methods: tuple[OfferMethod, ...]
    policy_version: str
    coin_price: int | None


@dataclass(frozen=True, slots=True)
class OffersLocked:
    lock_reasons: tuple[LockReason, ...]
    methods: tuple[OfferMethod, ...]
    policy_version: str
    coin_price: int | None


_OFFER_COPY: dict[OfferMethodType, tuple[str, str]] = {
    OfferMethodType.COIN: ("Unlock with coins", "Use your coin balance to unlock this episode."),
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
    profile: UserProfile | None,
) -> Ineligible | OffersGranted | OffersLocked:
    """Return the one currently useful access method; never mint playback."""
    policy = resolve_episode_policy(episode)
    decision = evaluate_authorize_access(episode, profile)
    if isinstance(decision, Ineligible):
        return decision
    if isinstance(decision, Grant):
        kind = (
            OfferMethodType.FREE
            if decision.source == GrantSource.FREE
            else OfferMethodType.ENTITLEMENT
        )
        return OffersGranted((_offer_method(kind),), policy.version, policy.coin_price)
    methods: tuple[OfferMethod, ...] = ()
    if profile is not None and policy.ad_available:
        methods = (_offer_method(OfferMethodType.REWARDED_AD),)
    if (
        profile is not None
        and coin_spending_enabled()
        and policy.effective_mode in {EpisodeAccessMode.COIN, EpisodeAccessMode.BOTH}
        and policy.coin_price is not None
    ):
        methods += (_offer_method(OfferMethodType.COIN),)
    return OffersLocked(decision.lock_reasons, methods, policy.version, policy.coin_price)

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import episode_is_eligible
from apps.catalog.models import Episode
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement

DEFAULT_FREE_EPISODE_COUNT = 5


class LockReason(StrEnum):
    LOGIN_REQUIRED = "login_required"
    ENTITLEMENT_REQUIRED = "entitlement_required"


class GrantSource(StrEnum):
    FREE = "free"
    REWARDED_AD = "rewarded_ad"
    STAFF = "staff"


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


def episode_is_free(episode: Episode) -> bool:
    return 1 <= episode.order <= episode.series.free_episode_count


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
        if source is not None:
            return Grant(GrantSource.STAFF)
    if episode_is_free(episode):
        return Grant(GrantSource.FREE)
    if profile is None:
        return Lock((LockReason.LOGIN_REQUIRED,))
    return Lock((LockReason.ENTITLEMENT_REQUIRED,))


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
    profile: UserProfile | None,
) -> Ineligible | OffersGranted | OffersLocked:
    """Return the one currently useful access method; never mint playback."""
    decision = evaluate_authorize_access(episode, profile)
    if isinstance(decision, Ineligible):
        return decision
    if isinstance(decision, Grant):
        kind = (
            OfferMethodType.FREE
            if decision.source == GrantSource.FREE
            else OfferMethodType.ENTITLEMENT
        )
        return OffersGranted((_offer_method(kind),))
    methods: tuple[OfferMethod, ...] = ()
    if profile is not None and episode.series.rewarded_ads_enabled:
        methods = (_offer_method(OfferMethodType.REWARDED_AD),)
    return OffersLocked(decision.lock_reasons, methods)

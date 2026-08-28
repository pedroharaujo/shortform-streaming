from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import CatalogRequestContext, episode_is_eligible
from apps.catalog.models import Episode
from apps.entitlements.models import EpisodeEntitlement

# D-006: first five episodes per season by Episode.order. Not Remote Config.
FREE_EPISODE_ORDER_MAX = 5


class LockReason(StrEnum):
    LOGIN_REQUIRED = "login_required"
    ENTITLEMENT_REQUIRED = "entitlement_required"


@dataclass(frozen=True, slots=True)
class Ineligible:
    """Catalog-ineligible: authorize must 404 and must not mint."""


@dataclass(frozen=True, slots=True)
class Grant:
    """Catalog-eligible and entitled or inside the D-006 free window. View may mint."""


@dataclass(frozen=True, slots=True)
class Lock:
    """Catalog-eligible but not playable. Return lock_reasons and never mint."""

    lock_reasons: tuple[LockReason, ...]


AuthorizeAccess = Ineligible | Grant | Lock


def evaluate_authorize_access(
    episode: Episode,
    context: CatalogRequestContext,
    profile: UserProfile | None,
    *,
    now: datetime | None = None,
) -> AuthorizeAccess:
    """Precedence: ineligible → entitlement → D-006 free window (order 1–5) → locked.

    Never mints a playback URL. The view mints only after Grant.
    """
    if not episode_is_eligible(episode, context, now=now):
        return Ineligible()
    if (
        profile is not None
        and EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode).exists()
    ):
        return Grant()
    if 1 <= episode.order <= FREE_EPISODE_ORDER_MAX:
        return Grant()
    if profile is None:
        return Lock(lock_reasons=(LockReason.LOGIN_REQUIRED,))
    return Lock(lock_reasons=(LockReason.ENTITLEMENT_REQUIRED,))

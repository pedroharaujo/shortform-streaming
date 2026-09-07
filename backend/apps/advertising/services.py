from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from enum import StrEnum
from uuid import UUID

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound

from apps.accounts.authentication import FirebaseAuthenticationFailed
from apps.accounts.models import AccountDeletion, UserProfile, deletion_fingerprint
from apps.accounts.profiles import lock_account_identity
from apps.advertising.models import RewardIntent
from apps.advertising.verification import InvalidCallback, VerifiedReward
from apps.catalog.eligibility import episode_is_eligible
from apps.catalog.locking import lock_episode_for_access
from apps.catalog.models import Episode
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from apps.entitlements.policy import (
    OffersLocked,
    evaluate_episode_offers,
    resolve_episode_policy,
)

REWARD_DESCRIPTION = "Watch one rewarded ad to unlock this episode permanently."


class RewardGrantSource(StrEnum):
    ADMOB_SSV = "admob_ssv"


class RewardUnavailable(APIException):
    status_code = 409
    default_code = "reward_unavailable"
    default_detail = "The reward is unavailable."
    envelope_message = default_detail


def current_profile(profile: UserProfile) -> UserProfile:
    lock_account_identity(profile.firebase_uid)
    fresh = UserProfile.objects.select_for_update(of=("self",)).filter(pk=profile.pk).first()
    if (
        fresh is None
        or AccountDeletion.objects.filter(
            uid_fingerprint=deletion_fingerprint(profile.firebase_uid)
        ).exists()
    ):
        raise FirebaseAuthenticationFailed()
    return fresh


def offer_available(episode: Episode, profile: UserProfile) -> bool:
    if settings.REWARDED_ADS_MODE not in {"test", "production"} or not profile.ads_consent:
        return False
    decision = evaluate_episode_offers(episode, profile)
    return isinstance(decision, OffersLocked) and any(
        method.type == "rewarded_ad" for method in decision.methods
    )


def create_reward_intent(
    profile: UserProfile,
    episode_id: str,
    request_id: UUID,
    *,
    expected_policy_version: str | None = None,
) -> tuple[RewardIntent, bool]:
    with transaction.atomic():
        profile = current_profile(profile)
        existing = RewardIntent.objects.filter(user_profile=profile, request_id=request_id).first()
        if existing is not None:
            episode = lock_episode_for_access(existing.episode_id)
            if episode is None or episode.public_id != episode_id:
                raise RewardUnavailable()
            existing = (
                RewardIntent.objects.select_for_update(of=("self",)).filter(pk=existing.pk).first()
            )
            if existing is None:
                raise RewardUnavailable()
            existing.episode = episode
            existing.user_profile = profile
            return existing, False
        episode_pk = (
            Episode.objects.filter(public_id=episode_id).values_list("pk", flat=True).first()
        )
        episode = lock_episode_for_access(episode_pk) if episode_pk is not None else None
        if episode is None or not episode_is_eligible(episode):
            raise NotFound("Resource not found.")
        if not offer_available(episode, profile):
            raise RewardUnavailable()
        policy = resolve_episode_policy(episode)
        if expected_policy_version is not None and expected_policy_version != policy.version:
            raise RewardUnavailable()
        return RewardIntent.objects.create(
            user_profile=profile,
            episode=episode,
            request_id=request_id,
            ad_unit_id=settings.REWARDED_ADS_UNIT_ID,
            policy_version=policy.version,
            expires_at=timezone.now() + timedelta(minutes=15),
        ), True


def reward_status(intent: RewardIntent) -> str:
    with transaction.atomic():
        initial_profile = UserProfile.objects.filter(pk=intent.user_profile_id).first()
        if initial_profile is None:
            return "unavailable"
        profile = current_profile(initial_profile)
        episode = lock_episode_for_access(intent.episode_id)
        fresh = RewardIntent.objects.select_for_update(of=("self",)).filter(pk=intent.pk).first()
        if episode is None or fresh is None:
            return "unavailable"
        if fresh.granted_at is not None:
            return "granted"
        if fresh.expires_at <= timezone.now():
            return "expired"
        if (
            not fresh.policy_version
            or fresh.policy_version != resolve_episode_policy(episode).version
            or fresh.ad_unit_id != settings.REWARDED_ADS_UNIT_ID
            or not offer_available(episode, profile)
        ):
            return "unavailable"
        return "pending"


def grant_verified_reward(callback: VerifiedReward) -> None:
    if settings.REWARDED_ADS_MODE not in {"test", "production"}:
        raise InvalidCallback()
    with transaction.atomic():
        # Serialize a transaction ID even if two callbacks target different users.
        key = int.from_bytes(
            hashlib.sha256(f"admob:{callback.transaction_id}".encode()).digest()[:8], signed=True
        )
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [key])
        initial = (
            RewardIntent.objects.select_related("user_profile")
            .filter(custom_data=callback.custom_data)
            .first()
        )
        if initial is None:
            raise InvalidCallback()
        try:
            profile = current_profile(initial.user_profile)
        except FirebaseAuthenticationFailed:
            raise InvalidCallback() from None
        episode = lock_episode_for_access(initial.episode_id)
        intent = RewardIntent.objects.select_for_update(of=("self",)).filter(pk=initial.pk).first()
        if (
            episode is None
            or intent is None
            or not secrets.compare_digest(intent.ssv_user_id, callback.user_id)
        ):
            raise InvalidCallback()
        if (
            callback.ad_unit != intent.ad_unit_id.rsplit("/", 1)[-1]
            or intent.ad_unit_id != settings.REWARDED_ADS_UNIT_ID
        ):
            raise InvalidCallback()
        if intent.granted_at is not None:
            if (
                intent.provider_transaction_id == callback.transaction_id
                and intent.provider_timestamp == callback.timestamp
            ):
                return
            raise InvalidCallback()
        now = timezone.now()
        if not intent.created_at - timedelta(seconds=1) <= callback.timestamp < intent.expires_at:
            raise InvalidCallback()
        if now >= intent.expires_at or callback.timestamp > now + timedelta(seconds=60):
            raise InvalidCallback()
        if RewardIntent.objects.filter(provider_transaction_id=callback.transaction_id).exists():
            raise InvalidCallback()
        if (
            not intent.policy_version
            or intent.policy_version != resolve_episode_policy(episode).version
            or not offer_available(episode, profile)
        ):
            raise InvalidCallback()
        entitlement, _ = EpisodeEntitlement.objects.get_or_create(
            user_profile=profile,
            episode=episode,
            defaults={"source": EntitlementSource.REWARDED_AD},
        )
        if entitlement.source not in {EntitlementSource.REWARDED_AD, EntitlementSource.STAFF}:
            # Preserve unrecognized evidence without claiming playable reward access.
            raise InvalidCallback()
        intent.granted_at = now
        intent.provider_transaction_id = callback.transaction_id
        intent.provider_timestamp = callback.timestamp
        intent.save(update_fields=["granted_at", "provider_transaction_id", "provider_timestamp"])

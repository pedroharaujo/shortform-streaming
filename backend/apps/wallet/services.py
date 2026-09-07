from __future__ import annotations

from uuid import UUID, uuid4

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import APIException, NotFound

from apps.accounts.models import UserProfile
from apps.accounts.profiles import lock_current_profile
from apps.catalog.eligibility import episode_is_eligible
from apps.catalog.locking import lock_episode_for_access
from apps.catalog.models import Episode, EpisodeAccessMode
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from apps.entitlements.policy import (
    Grant,
    Ineligible,
    evaluate_authorize_access,
    resolve_episode_policy,
)
from apps.wallet.capabilities import coin_spending_enabled
from apps.wallet.models import CoinLedgerEntry, CoinUnlock, CoinUnlockCancellation, Wallet


class CoinUnavailable(APIException):
    status_code = 409
    default_code = "coin_unavailable"
    default_detail = "Coin unlock is unavailable. Refresh the offer and your balance."
    envelope_message = default_detail


def wallet_balance(wallet: Wallet) -> int:
    return int(wallet.entries.aggregate(total=Sum("amount"))["total"] or 0)


def read_wallet(profile: UserProfile) -> int:
    with transaction.atomic():
        profile = lock_current_profile(profile)
        wallet = Wallet.objects.select_for_update().filter(user_profile=profile).first()
        return wallet_balance(wallet) if wallet is not None else 0


def unlock_episode(
    profile: UserProfile,
    episode_id: str,
    request_id: UUID,
    *,
    expected_policy_version: str,
    expected_coin_price: int,
) -> tuple[CoinUnlock, int]:
    with transaction.atomic():
        profile = lock_current_profile(profile)
        if not coin_spending_enabled():
            raise CoinUnavailable()

        if CoinUnlockCancellation.objects.filter(
            wallet__user_profile=profile, request_id=request_id
        ).exists():
            raise CoinUnavailable()

        # Look up the key while the account lock prevents competing owner commands.
        # Lock catalog before wallet to match rewards and editorial access writers.
        existing = CoinUnlock.objects.filter(
            wallet__user_profile=profile, request_id=request_id
        ).first()
        if existing is not None and (
            existing.episode_public_id != episode_id
            or existing.policy_version != expected_policy_version
            or existing.expected_coin_price != expected_coin_price
        ):
            raise CoinUnavailable()
        episode_pk = (
            Episode.objects.filter(public_id=episode_id).values_list("pk", flat=True).first()
        )
        episode = lock_episode_for_access(episode_pk) if episode_pk is not None else None
        if episode is None or not episode_is_eligible(episode):
            raise NotFound("Resource not found.")
        wallet, _ = Wallet.objects.select_for_update().get_or_create(user_profile=profile)
        # The wallet may have been held by another accounting writer. Time-based
        # rights can expire while waiting even though catalog rows stayed locked.
        decision = evaluate_authorize_access(episode, profile)
        if isinstance(decision, Ineligible):
            raise NotFound("Resource not found.")
        if existing is not None:
            # A receipt is not playable media: authorization still checks current
            # entitlement/rights. Never silently recreate a removed entitlement.
            if not isinstance(decision, Grant):
                raise CoinUnavailable()
            return existing, wallet_balance(wallet)

        policy = resolve_episode_policy(episode)
        ledger_entry = None
        charged = 0
        if not isinstance(decision, Grant):
            if (
                policy.effective_mode not in {EpisodeAccessMode.COIN, EpisodeAccessMode.BOTH}
                or policy.coin_price is None
                or policy.coin_price != expected_coin_price
                or policy.version != expected_policy_version
            ):
                raise CoinUnavailable()
            if wallet_balance(wallet) < policy.coin_price:
                raise CoinUnavailable()
            charged = policy.coin_price
            ledger_entry = CoinLedgerEntry.objects.create(
                wallet=wallet, reference=uuid4(), kind="unlock", amount=-charged
            )
            EpisodeEntitlement.objects.create(
                user_profile=profile, episode=episode, source=EntitlementSource.COIN
            )
        receipt = CoinUnlock.objects.create(
            wallet=wallet,
            request_id=request_id,
            episode_public_id=episode_id,
            policy_version=expected_policy_version,
            expected_coin_price=expected_coin_price,
            charged_coins=charged,
            ledger_entry=ledger_entry,
        )
        return receipt, wallet_balance(wallet)


def resolve_unlock(
    profile: UserProfile,
    episode_id: str,
    request_id: UUID,
    *,
    expected_policy_version: str,
    expected_coin_price: int,
) -> tuple[CoinUnlock | CoinUnlockCancellation, int]:
    """Return committed history or durably prevent this exact request from committing.

    Current catalog eligibility is deliberately not part of historical resolution.
    A completed receipt never implies current playback access.
    """
    with transaction.atomic():
        profile = lock_current_profile(profile)
        if not coin_spending_enabled():
            raise CoinUnavailable()
        wallet, _ = Wallet.objects.select_for_update().get_or_create(user_profile=profile)
        existing: CoinUnlock | CoinUnlockCancellation | None = CoinUnlock.objects.filter(
            wallet=wallet, request_id=request_id
        ).first()
        if existing is None:
            existing = CoinUnlockCancellation.objects.filter(
                wallet=wallet, request_id=request_id
            ).first()
        if existing is not None:
            if (
                existing.episode_public_id != episode_id
                or existing.policy_version != expected_policy_version
                or existing.expected_coin_price != expected_coin_price
            ):
                raise CoinUnavailable()
            return existing, wallet_balance(wallet)
        cancelled = CoinUnlockCancellation.objects.create(
            wallet=wallet,
            request_id=request_id,
            episode_public_id=episode_id,
            policy_version=expected_policy_version,
            expected_coin_price=expected_coin_price,
        )
        return cancelled, wallet_balance(wallet)

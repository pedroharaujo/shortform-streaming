from __future__ import annotations

from typing import TypedDict
from uuid import UUID

from django.utils import timezone

from apps.accounts.models import UserProfile
from apps.catalog.eligibility import episode_is_eligible
from apps.catalog.models import Episode
from apps.wallet.models import MAX_ENTRY_COINS, CoinLedgerEntry, Wallet

MAX_ACTIVITY_ENTRIES = 20


class WalletActivityEntry(TypedDict):
    id: UUID
    kind: str
    amount: int
    balance_after: int
    created_at: object
    episode_id: str | None
    episode_title: str | None


def list_wallet_activity(profile: UserProfile) -> tuple[list[WalletActivityEntry], bool]:
    """Newest ledger lines for this account, with a running balance after each line.

    The response never includes the wallet id, profile id, or provider data.
    An unlock names its episode only while that episode is still catalog-eligible.
    """
    wallet = Wallet.objects.filter(user_profile=profile).first()
    if wallet is None:
        return [], False
    rows = list(
        CoinLedgerEntry.objects.filter(wallet=wallet)
        .select_related("unlock_receipt")
        .order_by("created_at", "id")
    )
    running = 0
    annotated: list[tuple[CoinLedgerEntry, int]] = []
    for row in rows:
        running += int(row.amount)
        if running < 0 or running > 9007199254740991 or abs(int(row.amount)) > MAX_ENTRY_COINS:
            raise ValueError("Ledger activity is outside the public balance range.")
        annotated.append((row, running))
    page = annotated[-MAX_ACTIVITY_ENTRIES:]
    has_more = len(annotated) > MAX_ACTIVITY_ENTRIES
    eligible_titles = _eligible_titles(page)
    entries = [_entry(row, balance_after, eligible_titles) for row, balance_after in reversed(page)]
    return entries, has_more


def _eligible_titles(page: list[tuple[CoinLedgerEntry, int]]) -> dict[str, str]:
    public_ids = [
        row.unlock_receipt.episode_public_id
        for row, _balance in page
        if getattr(row, "unlock_receipt", None) is not None
    ]
    if not public_ids:
        return {}
    titles: dict[str, str] = {}
    now = timezone.now()
    episodes = Episode.objects.select_related("series", "season").filter(public_id__in=public_ids)
    for episode in episodes:
        if episode_is_eligible(episode, now=now):
            titles[episode.public_id] = episode.title
    return titles


def _entry(
    row: CoinLedgerEntry, balance_after: int, eligible_titles: dict[str, str]
) -> WalletActivityEntry:
    episode_id = None
    episode_title = None
    receipt = getattr(row, "unlock_receipt", None)
    if receipt is not None and receipt.episode_public_id in eligible_titles:
        episode_id = receipt.episode_public_id
        episode_title = eligible_titles[receipt.episode_public_id]
    return {
        "id": row.reference,
        "kind": row.kind,
        "amount": int(row.amount),
        "balance_after": balance_after,
        "created_at": row.created_at,
        "episode_id": episode_id,
        "episode_title": episode_title,
    }

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from django.db import DatabaseError, IntegrityError, close_old_connections, connection, transaction
from django.db.models import Sum
from django.db.models.deletion import ProtectedError

from apps.accounts.models import UserProfile
from apps.wallet.models import CoinLedgerEntry, CoinUnlock, Wallet

pytestmark = pytest.mark.django_db


@pytest.fixture
def wallet() -> Wallet:
    return Wallet.objects.create(
        user_profile=UserProfile.objects.create(firebase_uid=f"synthetic-wallet-{uuid4().hex}")
    )


def credit(wallet: Wallet, amount: int = 10) -> CoinLedgerEntry:
    return CoinLedgerEntry.objects.create(
        wallet=wallet, reference=uuid4(), kind="purchase", amount=amount
    )


def receipt(wallet: Wallet, entry: CoinLedgerEntry | None = None) -> CoinUnlock:
    return CoinUnlock.objects.create(
        wallet=wallet,
        request_id=uuid4(),
        episode_public_id="ep_synthetic_wallet",
        policy_version="synthetic-policy-v1",
        expected_coin_price=4,
        charged_coins=4 if entry else 0,
        ledger_entry=entry,
    )


def test_wallet_uses_opaque_identity_and_ledger_requires_unique_explicit_reference(
    wallet: Wallet,
) -> None:
    assert isinstance(wallet.pk, UUID)
    entry = credit(wallet)
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinLedgerEntry.objects.create(wallet=wallet, kind="purchase", amount=10)
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinLedgerEntry.objects.create(
            wallet=wallet, reference=entry.reference, kind="purchase", amount=10
        )


@pytest.mark.parametrize("operation", ["update", "delete"])
def test_ledger_and_receipts_reject_queryset_mutation(wallet: Wallet, operation: str) -> None:
    entry = credit(wallet)
    unlock = receipt(wallet)
    with pytest.raises(IntegrityError, match="immutable"), transaction.atomic():
        if operation == "update":
            CoinLedgerEntry.objects.filter(pk=entry.pk).update(amount=99)
        else:
            CoinLedgerEntry.objects.filter(pk=entry.pk).delete()
    with pytest.raises(IntegrityError, match="immutable"), transaction.atomic():
        if operation == "update":
            CoinUnlock.objects.filter(pk=unlock.pk).update(episode_public_id="ep_other")
        else:
            CoinUnlock.objects.filter(pk=unlock.pk).delete()


@pytest.mark.parametrize(
    ("kind", "amount"),
    [
        ("purchase", 0),
        ("purchase", -1),
        ("unlock", 1),
        ("correction", 0),
        ("unknown", 1),
        ("purchase", 2147483648),
        ("correction", -2147483648),
    ],
)
def test_ledger_rejects_invalid_kind_sign_or_entry_size(
    wallet: Wallet, kind: str, amount: int
) -> None:
    credit(wallet)
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinLedgerEntry.objects.create(wallet=wallet, reference=uuid4(), kind=kind, amount=amount)


def test_balance_can_reach_zero_but_never_become_negative(wallet: Wallet) -> None:
    credit(wallet, 4)
    CoinLedgerEntry.objects.create(wallet=wallet, reference=uuid4(), kind="unlock", amount=-4)
    with pytest.raises(IntegrityError, match="balance"), transaction.atomic():
        CoinLedgerEntry.objects.create(
            wallet=wallet, reference=uuid4(), kind="correction", amount=-1
        )
    assert wallet.entries.aggregate(total=Sum("amount"))["total"] == 0


def test_account_deletion_retains_accounting_and_detaches_wallet(wallet: Wallet) -> None:
    entry = credit(wallet)
    unlock = receipt(wallet)
    profile = wallet.user_profile
    assert profile is not None
    profile.delete()
    wallet.refresh_from_db()
    assert wallet.user_profile_id is None
    assert CoinLedgerEntry.objects.filter(pk=entry.pk, wallet=wallet).exists()
    assert CoinUnlock.objects.filter(pk=unlock.pk, wallet=wallet).exists()
    with pytest.raises(ProtectedError):
        wallet.delete()
    with pytest.raises(IntegrityError, match="detached"), transaction.atomic():
        credit(wallet)
    with pytest.raises(IntegrityError, match="detached"), transaction.atomic():
        receipt(wallet)


def test_wallet_cannot_transfer_or_reattach_accounting(wallet: Wallet) -> None:
    other = UserProfile.objects.create(firebase_uid="synthetic-wallet-other")
    with pytest.raises(IntegrityError, match="identity"), transaction.atomic():
        Wallet.objects.filter(pk=wallet.pk).update(user_profile=other)
    Wallet.objects.filter(pk=wallet.pk).update(user_profile=None)
    with pytest.raises(IntegrityError, match="identity"), transaction.atomic():
        Wallet.objects.filter(pk=wallet.pk).update(user_profile=other)


def test_receipt_request_is_unique_per_wallet(wallet: Wallet) -> None:
    unlock = receipt(wallet)
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinUnlock.objects.create(
            wallet=wallet,
            request_id=unlock.request_id,
            episode_public_id=unlock.episode_public_id,
            policy_version=unlock.policy_version,
            expected_coin_price=4,
        )
    other = Wallet.objects.create(
        user_profile=UserProfile.objects.create(firebase_uid="synthetic-other-receipt")
    )
    CoinUnlock.objects.create(
        wallet=other,
        request_id=unlock.request_id,
        episode_public_id=unlock.episode_public_id,
        policy_version=unlock.policy_version,
        expected_coin_price=4,
    )


@pytest.mark.parametrize("mismatch", ["missing", "zero", "wallet", "kind", "amount", "price"])
def test_receipt_requires_matching_debit(wallet: Wallet, mismatch: str) -> None:
    credit(wallet)
    debit_wallet = wallet
    if mismatch == "wallet":
        debit_wallet = Wallet.objects.create(
            user_profile=UserProfile.objects.create(firebase_uid="synthetic-wrong-wallet")
        )
        credit(debit_wallet)
    entry = CoinLedgerEntry.objects.create(
        wallet=debit_wallet,
        reference=uuid4(),
        kind="correction" if mismatch == "kind" else "unlock",
        amount=-3 if mismatch == "amount" else -4,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinUnlock.objects.create(
            wallet=wallet,
            request_id=uuid4(),
            episode_public_id="ep_synthetic_receipt",
            policy_version="synthetic-v1",
            expected_coin_price=5 if mismatch == "price" else 4,
            charged_coins=0 if mismatch == "zero" else 4,
            ledger_entry=None if mismatch == "missing" else entry,
        )


def test_receipt_accepts_matching_debit_once(wallet: Wallet) -> None:
    credit(wallet)
    entry = CoinLedgerEntry.objects.create(
        wallet=wallet, reference=uuid4(), kind="unlock", amount=-4
    )
    receipt(wallet, entry)
    with pytest.raises(IntegrityError), transaction.atomic():
        receipt(wallet, entry)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("isolation", ["READ COMMITTED", "REPEATABLE READ"])
def test_direct_concurrent_debits_cannot_overspend(isolation: str) -> None:
    wallet = Wallet.objects.create(
        user_profile=UserProfile.objects.create(firebase_uid="synthetic-concurrent-ledger")
    )
    credit(wallet, 10)
    barrier = Barrier(2)

    def spend() -> str:
        close_old_connections()
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(f"SET TRANSACTION ISOLATION LEVEL {isolation}")
                assert wallet.entries.aggregate(total=Sum("amount"))["total"] == 10
                barrier.wait(timeout=10)
                CoinLedgerEntry.objects.create(
                    wallet_id=wallet.pk, reference=uuid4(), kind="unlock", amount=-7
                )
            return "committed"
        except DatabaseError as exc:
            sqlstate = getattr(exc.__cause__, "sqlstate", None)
            assert sqlstate in {"23514", "40001"}
            return "rejected"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(spend) for _ in range(2)]
        assert sorted(future.result(timeout=20) for future in futures) == ["committed", "rejected"]
    assert wallet.entries.aggregate(total=Sum("amount"))["total"] == 3

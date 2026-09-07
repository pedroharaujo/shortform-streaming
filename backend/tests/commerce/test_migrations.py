from __future__ import annotations

from uuid import uuid4

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_commerce_expansion_preserves_existing_wallet_history() -> None:
    executor = MigrationExecutor(connection)
    current = executor.loader.graph.leaf_nodes()
    previous = [target for target in current if target[0] != "commerce"]
    executor.migrate([("commerce", None)])
    try:
        apps = executor.loader.project_state(previous).apps
        profile = apps.get_model("accounts", "UserProfile").objects.create(
            public_id="usr_synthetic_commerce_migration",
            firebase_uid="synthetic-commerce-migration",
        )
        wallet = apps.get_model("wallet", "Wallet").objects.create(user_profile=profile)
        entry = apps.get_model("wallet", "CoinLedgerEntry").objects.create(
            wallet=wallet, reference=uuid4(), kind="purchase", amount=7
        )
        before = list(apps.get_model("wallet", "CoinLedgerEntry").objects.values())
        executor = MigrationExecutor(connection)
        executor.migrate(current)
        expanded = executor.loader.project_state(current).apps
        assert list(expanded.get_model("wallet", "CoinLedgerEntry").objects.values()) == before
        assert not expanded.get_model("commerce", "PurchaseDecision").objects.exists()
        # Old account writer still detaches wallets after commerce is installed.
        expanded.get_model("commerce", "PurchaseIdentity").objects.create(wallet_id=wallet.pk)
        profile.delete()
        wallet.refresh_from_db()
        assert wallet.user_profile_id is None
        assert expanded.get_model("wallet", "CoinLedgerEntry").objects.filter(pk=entry.pk).exists()
    finally:
        MigrationExecutor(connection).migrate(current)

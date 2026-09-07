from __future__ import annotations

from uuid import uuid4

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_wallet_expansion_preserves_existing_accounts_and_entitlements() -> None:
    executor = MigrationExecutor(connection)
    current_targets = executor.loader.graph.leaf_nodes()
    # Commerce depends on wallet; legacy state must omit both additive apps.
    legacy_targets = [
        target for target in current_targets if target[0] not in {"wallet", "commerce"}
    ]
    executor.migrate([("wallet", None)])
    try:
        legacy = executor.loader.project_state(legacy_targets).apps
        profile_model = legacy.get_model("accounts", "UserProfile")
        profile = profile_model.objects.create(
            public_id="usr_synthetic_wallet_migration",
            firebase_uid="synthetic-wallet-migration",
        )
        series = legacy.get_model("catalog", "Series").objects.create(
            public_id="ser_synthetic_wallet_migration", title="Synthetic migration"
        )
        season = legacy.get_model("catalog", "Season").objects.create(series=series, number=1)
        episode = legacy.get_model("catalog", "Episode").objects.create(
            public_id="ep_synthetic_wallet_migration",
            series=series,
            season=season,
            order=1,
            title="Synthetic migration episode",
        )
        entitlement = legacy.get_model("entitlements", "EpisodeEntitlement").objects.create(
            user_profile=profile, episode=episode, source="staff"
        )

        executor = MigrationExecutor(connection)
        executor.migrate(current_targets)
        expanded = executor.loader.project_state(current_targets).apps
        new_profile = expanded.get_model("accounts", "UserProfile").objects.get(pk=profile.pk)
        assert new_profile.public_id == profile.public_id
        assert new_profile.firebase_uid == profile.firebase_uid
        assert (
            expanded.get_model("entitlements", "EpisodeEntitlement")
            .objects.get(pk=entitlement.pk)
            .source
            == "staff"
        )
        assert expanded.get_model("wallet", "Wallet").objects.count() == 0
        # Existing account writers need no new fields during the expansion.
        old_writer_profile = profile_model.objects.create(
            public_id="usr_synthetic_wallet_old_writer",
            firebase_uid="synthetic-wallet-old-writer",
        )
        assert (
            expanded.get_model("accounts", "UserProfile")
            .objects.filter(pk=old_writer_profile.pk)
            .exists()
        )
        wallet = expanded.get_model("wallet", "Wallet").objects.create(user_profile=new_profile)
        entry = expanded.get_model("wallet", "CoinLedgerEntry").objects.create(
            wallet=wallet, reference=uuid4(), kind="purchase", amount=10
        )
        debit = expanded.get_model("wallet", "CoinLedgerEntry").objects.create(
            wallet=wallet, reference=uuid4(), kind="unlock", amount=-4
        )
        receipt = expanded.get_model("wallet", "CoinUnlock").objects.create(
            wallet=wallet,
            request_id=uuid4(),
            episode_public_id=episode.public_id,
            policy_version="synthetic-migration-v1",
            expected_coin_price=4,
            charged_coins=4,
            ledger_entry=debit,
        )
        # During a rolling deployment an old process can delete an account
        # after a new process has created its wallet. Its ORM does not know
        # the wallet relation, so database-level detachment must also work.
        profile.delete()
        wallet.refresh_from_db()
        assert wallet.user_profile_id is None
        assert expanded.get_model("wallet", "CoinLedgerEntry").objects.filter(pk=entry.pk).exists()
        assert expanded.get_model("wallet", "CoinLedgerEntry").objects.filter(pk=debit.pk).exists()
        assert expanded.get_model("wallet", "CoinUnlock").objects.filter(pk=receipt.pk).exists()
        assert (
            not expanded.get_model("entitlements", "EpisodeEntitlement")
            .objects.filter(pk=entitlement.pk)
            .exists()
        )
    finally:
        MigrationExecutor(connection).migrate(current_targets)

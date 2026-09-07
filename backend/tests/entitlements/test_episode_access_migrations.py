from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

LEGACY_TARGETS = [
    ("catalog", "0004_launch_context_rights"),
    ("advertising", "0002_fixed_mvp_market"),
    ("entitlements", "0003_accesspolicy_series_level_no_force_flags"),
]


@pytest.mark.django_db(transaction=True)
def test_episode_access_expansion_preserves_legacy_policy_and_reward_evidence() -> None:
    executor = MigrationExecutor(connection)
    current_targets = executor.loader.graph.leaf_nodes()
    executor.migrate(LEGACY_TARGETS)
    try:
        legacy = executor.loader.project_state(LEGACY_TARGETS).apps
        series = legacy.get_model("catalog", "Series").objects.create(
            public_id="ser_synthetic_editorial_migration",
            title="Synthetic editorial migration",
            synopsis="Synthetic metadata only.",
            free_episode_count=2,
            rewarded_ads_enabled=False,
        )
        season = legacy.get_model("catalog", "Season").objects.create(series=series, number=1)
        episodes = [
            legacy.get_model("catalog", "Episode").objects.create(
                public_id=f"ep_synthetic_editorial_{order}",
                series=series,
                season=season,
                order=order,
                title=f"Synthetic episode {order}",
                synopsis="Retained episode metadata.",
            )
            for order in (2, 3)
        ]
        dormant = legacy.get_model("entitlements", "AccessPolicy").objects.create(
            series=series, episode=episodes[1], force_free=True
        )
        revision = legacy.get_model("entitlements", "AccessPolicyRevision").objects.create(
            policy=dormant,
            series=series,
            episode=episodes[1],
            free_episode_order_max=5,
            rewarded_ad_enabled=True,
            force_free=True,
            force_lock=False,
            coin_unlock_enabled=False,
            subscription_unlock_enabled=False,
        )
        profile = legacy.get_model("accounts", "UserProfile").objects.create(
            public_id="usr_synthetic_editorial_migration",
            firebase_uid="synthetic-editorial-migration",
        )
        entitlement = legacy.get_model("entitlements", "EpisodeEntitlement").objects.create(
            user_profile=profile, episode=episodes[1], source="rewarded_ad"
        )
        instant = timezone.now()
        intents = []
        for granted in (False, True):
            intents.append(
                legacy.get_model("advertising", "RewardIntent").objects.create(
                    user_profile=profile,
                    episode=episodes[1],
                    request_id=uuid4(),
                    custom_data=f"synthetic-migration-{uuid4().hex}",
                    ssv_user_id="synthetic-migration-account-binding",
                    ad_unit_id="synthetic-migration-ad-unit",
                    expires_at=instant + timedelta(minutes=15),
                    granted_at=instant if granted else None,
                    provider_transaction_id="synthetic-migration-verified" if granted else None,
                    provider_timestamp=instant if granted else None,
                )
            )

        executor = MigrationExecutor(connection)
        executor.migrate(current_targets)
        expanded = executor.loader.project_state(current_targets).apps
        # During migrations-before-code deployment, an old process omits the new
        # columns. Database defaults must support its writes after expansion too.
        old_writer_episode = legacy.get_model("catalog", "Episode").objects.create(
            public_id="ep_synthetic_old_writer",
            series=series,
            season=season,
            order=4,
            title="Written by the old schema",
        )
        old_writer_intent = legacy.get_model("advertising", "RewardIntent").objects.create(
            user_profile=profile,
            episode=old_writer_episode,
            request_id=uuid4(),
            custom_data=f"synthetic-old-writer-{uuid4().hex}",
            ssv_user_id="synthetic-old-writer-binding",
            ad_unit_id="synthetic-old-writer-unit",
            expires_at=instant + timedelta(minutes=15),
        )
        assert (
            expanded.get_model("catalog", "Episode")
            .objects.get(pk=old_writer_episode.pk)
            .access_mode
            == "inherit"
        )
        assert (
            expanded.get_model("advertising", "RewardIntent")
            .objects.get(pk=old_writer_intent.pk)
            .policy_version
            == ""
        )
        for old in episodes:
            episode = expanded.get_model("catalog", "Episode").objects.get(pk=old.pk)
            assert episode.public_id == old.public_id
            assert episode.title == old.title
            assert episode.access_mode == "inherit"
            assert episode.coin_price is None
        migrated_series = expanded.get_model("catalog", "Series").objects.get(pk=series.pk)
        assert migrated_series.free_episode_count == 2
        assert migrated_series.rewarded_ads_enabled is False
        assert (
            expanded.get_model("entitlements", "AccessPolicy").objects.get(pk=dormant.pk).force_free
        )
        assert (
            expanded.get_model("entitlements", "AccessPolicyRevision")
            .objects.get(pk=revision.pk)
            .force_free
        )
        assert (
            expanded.get_model("entitlements", "EpisodeEntitlement")
            .objects.get(pk=entitlement.pk)
            .source
            == "rewarded_ad"
        )
        for old in intents:
            intent = expanded.get_model("advertising", "RewardIntent").objects.get(pk=old.pk)
            assert intent.policy_version == ""
            assert intent.request_id == old.request_id
            assert intent.granted_at == old.granted_at
            assert intent.provider_transaction_id == old.provider_transaction_id
            assert intent.provider_timestamp == old.provider_timestamp

        from apps.catalog.models import Episode
        from apps.entitlements.policy import episode_is_free, resolve_episode_policy

        free, locked = [Episode.objects.select_related("series").get(pk=row.pk) for row in episodes]
        assert episode_is_free(free)
        assert not episode_is_free(locked)  # Dormant force_free must not revive.
        assert not resolve_episode_policy(locked).ad_available
    finally:
        MigrationExecutor(connection).migrate(current_targets)

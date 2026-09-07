from __future__ import annotations

from datetime import UTC, datetime

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

LEGACY_CATALOG = ("catalog", "0003_restore_licensed_series_support")


@pytest.mark.django_db(transaction=True)
def test_expansion_preserves_legacy_identity_text_and_unapproved_rights() -> None:
    executor = MigrationExecutor(connection)
    current_targets = executor.loader.graph.leaf_nodes()
    assert LEGACY_CATALOG not in current_targets
    executor.migrate([LEGACY_CATALOG])
    try:
        legacy = executor.loader.project_state([LEGACY_CATALOG]).apps
        series = legacy.get_model("catalog", "Series").objects.create(
            public_id="ser_synthetic_migration",
            title="Current canonical English",
            synopsis="Current canonical synopsis",
            self_owned=False,
            promotional_use_approved=False,
        )
        season = legacy.get_model("catalog", "Season").objects.create(series=series, number=1)
        episode = legacy.get_model("catalog", "Episode").objects.create(
            public_id="ep_synthetic_migration",
            series=series,
            season=season,
            order=1,
            title="Current canonical episode",
            synopsis="Current episode synopsis",
        )
        legacy.get_model("catalog", "SeriesTranslation").objects.create(
            series=series, language="en", title="Old translated title", synopsis="Old synopsis"
        )
        legacy.get_model("catalog", "EpisodeTranslation").objects.create(
            episode=episode,
            language="de",
            title="Retained translated episode",
            synopsis="Retained translated synopsis",
        )
        right = legacy.get_model("catalog", "ContentRight").objects.create(
            series=series,
            licensor="Synthetic migration licensor",
            contract_reference="synthetic-migration-reference",
            territory_allowlist=["FR"],
            territory_denylist=[],
            platforms=["android"],
            languages=["en"],
            starts_at=datetime(2026, 1, 1, tzinfo=UTC),
            promotional_clip_permission=True,
        )

        executor = MigrationExecutor(connection)
        executor.migrate(current_targets)
        expanded = executor.loader.project_state(current_targets).apps
        migrated_series = expanded.get_model("catalog", "Series").objects.get(pk=series.pk)
        migrated_episode = expanded.get_model("catalog", "Episode").objects.get(pk=episode.pk)
        migrated_right = expanded.get_model("catalog", "ContentRight").objects.get(pk=right.pk)

        assert migrated_series.public_id == "ser_synthetic_migration"
        assert migrated_episode.public_id == "ep_synthetic_migration"
        assert migrated_series.title == "Current canonical English"
        assert migrated_episode.title == "Current canonical episode"
        assert migrated_series.distribution_territories == ["FR"]
        assert migrated_series.distribution_platforms == ["android"]
        assert migrated_series.distribution_storefronts == ["google_play"]
        assert migrated_series.distribution_languages == ["en"]
        assert migrated_series.translations.get(language="en").title == "Old translated title"
        assert (
            migrated_episode.translations.get(language="de").title == "Retained translated episode"
        )
        assert migrated_right.promotional_clip_permission is True
        assert migrated_right.territory_allowlist == ["FR"]
        assert migrated_right.languages == ["en"]
        for permission in (
            "free_access_permission",
            "rewarded_ad_permission",
            "coin_access_permission",
            "paid_promotion_permission",
        ):
            assert getattr(migrated_right, permission) is False
        for grant in ("storefronts", "original_languages", "subtitle_languages", "dub_languages"):
            assert getattr(migrated_right, grant) == []
    finally:
        MigrationExecutor(connection).migrate(current_targets)

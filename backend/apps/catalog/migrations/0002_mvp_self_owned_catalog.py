from __future__ import annotations

from typing import Any

from django.db import migrations, models


def copy_mvp_catalog_data(apps: Any, schema_editor: object) -> None:
    del schema_editor
    Series = apps.get_model("catalog", "Series")
    Episode = apps.get_model("catalog", "Episode")
    AccessPolicy = apps.get_model("entitlements", "AccessPolicy")

    for series in Series.objects.all().iterator():
        english = series.translations.filter(language="en").first()
        if english is not None:
            series.title = english.title
            series.synopsis = english.synopsis
        right = series.rights.order_by("id").first()
        if right is not None:
            series.provenance_reference = right.contract_reference
            series.takedown = right.takedown
            series.promotional_use_approved = right.promotional_clip_permission
        policy = AccessPolicy.objects.filter(series_id=series.pk, episode_id__isnull=True).first()
        if policy is not None:
            series.free_episode_count = policy.free_episode_order_max
            series.rewarded_ads_enabled = policy.rewarded_ad_enabled
        # Ownership cannot be inferred from a former license record. Existing
        # rows stay fail-closed until staff explicitly confirms self_owned.
        series.save(
            update_fields=[
                "title",
                "synopsis",
                "provenance_reference",
                "takedown",
                "promotional_use_approved",
                "free_episode_count",
                "rewarded_ads_enabled",
            ]
        )

    for episode in Episode.objects.all().iterator():
        english = episode.translations.filter(language="en").first()
        if english is None:
            continue
        episode.title = english.title
        episode.synopsis = english.synopsis
        episode.save(update_fields=["title", "synopsis"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
        ("entitlements", "0003_accesspolicy_series_level_no_force_flags"),
    ]

    operations = [
        migrations.AddField(
            model_name="episode",
            name="synopsis",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="episode",
            name="title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="series",
            name="free_episode_count",
            field=models.PositiveIntegerField(
                default=5,
                help_text="Episodes 1 through this order are free in each season.",
            ),
        ),
        migrations.AddField(
            model_name="series",
            name="promotional_use_approved",
            field=models.BooleanField(
                default=False,
                help_text="Confirms promotional use for the self-owned launch material.",
            ),
        ),
        migrations.AddField(
            model_name="series",
            name="provenance_reference",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Opaque reference to the private ownership/component-provenance record.",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="series",
            name="rewarded_ads_enabled",
            field=models.BooleanField(
                default=True,
                help_text="Server-side kill switch for rewarded-ad offers on this series.",
            ),
        ),
        migrations.AddField(
            model_name="series",
            name="self_owned",
            field=models.BooleanField(
                default=False,
                help_text="Must be confirmed before publication. Licensed content is outside MVP.",
            ),
        ),
        migrations.AddField(
            model_name="series",
            name="synopsis",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="series",
            name="takedown",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="series",
            name="title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.RunPython(copy_mvp_catalog_data, migrations.RunPython.noop),
    ]

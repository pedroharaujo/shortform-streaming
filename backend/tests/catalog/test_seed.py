from __future__ import annotations

import pytest
from django.core.management import call_command

from apps.catalog.models import Episode, EpisodeAccessMode, PublicationStatus, Season, Series
from apps.playback.models import MediaAsset, MediaAssetState


@pytest.mark.django_db
def test_seed_creates_exactly_one_idempotent_self_owned_series() -> None:
    call_command("seed_catalog")
    call_command("seed_catalog")

    series = Series.objects.get()
    assert series.title == "Harbor Lights"
    assert series.self_owned is True
    assert series.promotional_use_approved is True
    assert series.publication_status == PublicationStatus.PUBLISHED
    assert Episode.objects.count() == 6
    assert Episode.objects.filter(publication_status=PublicationStatus.PUBLISHED).count() == 6
    assert MediaAsset.objects.filter(provider_name="fake", state=MediaAssetState.READY).count() == 6


@pytest.mark.django_db
def test_repeated_seed_preserves_operator_edits_and_all_existing_media() -> None:
    call_command("seed_catalog")
    series = Series.objects.get()
    Series.objects.filter(pk=series.pk).update(
        title="Operator-edited generated series",
        publication_status=PublicationStatus.DRAFT,
        takedown=True,
        self_owned=False,
        promotional_use_approved=False,
        distribution_territories=["IE"],
        free_episode_count=1,
        rewarded_ads_enabled=False,
    )
    Episode.objects.filter(series=series).update(
        title="Operator-edited generated episode",
        publication_status=PublicationStatus.DRAFT,
        access_mode=EpisodeAccessMode.COIN,
        coin_price=7,
    )
    # Generated provider references stand in for operator-managed uploads. None
    # may be replaced, duplicated or made ready by a subsequent bootstrap.
    states = (
        MediaAssetState.READY,
        MediaAssetState.PROCESSING,
        MediaAssetState.PENDING_UPLOAD,
        MediaAssetState.BLOCKED,
        MediaAssetState.REMOVED,
        MediaAssetState.FAILED,
    )
    for asset, state in zip(MediaAsset.objects.order_by("episode__order"), states, strict=True):
        MediaAsset.objects.filter(pk=asset.pk).update(
            provider_name="bunny",
            provider_asset_id=f"generated-operator-asset-{asset.pk}",
            state=state,
            checksum="a" * 64,
            duration_seconds=42,
        )
    before = [
        list(model.objects.order_by("pk").values())
        for model in (Series, Season, Episode, MediaAsset)
    ]

    call_command("seed_catalog")

    after = [
        list(model.objects.order_by("pk").values())
        for model in (Series, Season, Episode, MediaAsset)
    ]
    assert after == before

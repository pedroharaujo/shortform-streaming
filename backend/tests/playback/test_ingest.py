from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.db.models import ProtectedError

from apps.catalog.models import Episode, PublicationStatus
from apps.playback.exceptions import VideoProviderError
from apps.playback.ingest import ingest_master, reconcile, sha256_hex, takedown_asset
from apps.playback.models import MediaAsset, MediaAssetState
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import make_episode, make_right, make_series

HMAC_KEY = "synthetic-hmac-for-tests"
SYNTHETIC_MASTER = b"synthetic-vertical-master-bytes"
SYNTHETIC_VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSynthetic caption.\n"


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    provider = FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)
    with patch("apps.playback.ingest.get_video_provider", return_value=provider):
        yield provider
    reset_provider_cache()


def _draft_episode() -> Episode:
    series = make_series(title="Ingest Title")
    make_right(series)
    return make_episode(series, publication_status=PublicationStatus.DRAFT)


@pytest.mark.django_db
def test_happy_path_upload_processing_reconcile_ready(fake_provider: FakeVideoProvider) -> None:
    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    assert asset.state == MediaAssetState.PROCESSING
    assert asset.checksum == sha256_hex(SYNTHETIC_MASTER)
    assert fake_provider.has_asset(asset.provider_asset_id)

    ready = reconcile(asset)
    assert ready.state == MediaAssetState.READY
    assert ready.has_captions
    assert ready.thumbnail_count >= 1
    assert ready.renditions
    assert ready.diagnostic_message == ""


@pytest.mark.django_db
def test_checksum_mismatch_rejected(fake_provider: FakeVideoProvider) -> None:
    del fake_provider
    episode = _draft_episode()
    with pytest.raises(ValidationError) as exc_info:
        ingest_master(
            episode=episode,
            video_bytes=SYNTHETIC_MASTER,
            captions_bytes=SYNTHETIC_VTT,
            expected_checksum="0" * 64,
        )
    assert "expected_checksum" in exc_info.value.message_dict
    assert MediaAsset.objects.count() == 0


@pytest.mark.django_db
def test_failed_job_retry_and_duplicate_reconcile(fake_provider: FakeVideoProvider) -> None:
    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    fake_provider.fail_job(asset.provider_asset_id)
    failed = reconcile(asset)
    assert failed.state == MediaAssetState.FAILED
    assert "failed" in failed.diagnostic_message.lower()
    assert "AccessKey" not in failed.diagnostic_message
    assert "https://" not in failed.diagnostic_message

    first = reconcile(failed)
    second = reconcile(first)
    assert first.pk == second.pk
    assert second.state == MediaAssetState.FAILED

    fake_provider.complete_processing(failed.provider_asset_id)
    ready = reconcile(failed)
    assert ready.state == MediaAssetState.READY
    again = reconcile(ready)
    assert again.state == MediaAssetState.READY
    assert again.pk == ready.pk


@pytest.mark.django_db
def test_second_master_for_same_episode_is_rejected(fake_provider: FakeVideoProvider) -> None:
    episode = _draft_episode()
    first = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    with pytest.raises(ValidationError) as exc_info:
        ingest_master(
            episode=episode,
            video_bytes=SYNTHETIC_MASTER + b"-other",
            captions_bytes=SYNTHETIC_VTT,
        )
    assert "episode" in exc_info.value.message_dict
    assert "Takedown" in str(exc_info.value)
    assert MediaAsset.objects.filter(episode=episode).count() == 1
    first.refresh_from_db()
    assert first.state == MediaAssetState.PROCESSING


@pytest.mark.django_db
def test_takedown_deletes_provider_asset_and_blocks_replay(
    fake_provider: FakeVideoProvider,
) -> None:
    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    ready = reconcile(asset)
    provider_id = ready.provider_asset_id
    removed = takedown_asset(ready)
    assert removed.state == MediaAssetState.REMOVED
    assert not fake_provider.has_asset(provider_id)
    again = takedown_asset(removed)
    assert again.state == MediaAssetState.REMOVED
    episode.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError):
        episode.full_clean()


@pytest.mark.django_db
def test_provider_takedown_failure_does_not_mark_removed(
    fake_provider: FakeVideoProvider,
) -> None:
    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    ready = reconcile(asset)
    with patch.object(
        fake_provider, "takedown", side_effect=VideoProviderError("Bunny Stream request failed")
    ):
        with pytest.raises(VideoProviderError):
            takedown_asset(ready)
    ready.refresh_from_db()
    assert ready.state == MediaAssetState.READY
    assert "takedown" in ready.diagnostic_message.lower()


@pytest.mark.django_db(transaction=True)
def test_episode_delete_expires_or_is_blocked_when_takedown_cannot_complete(
    fake_provider: FakeVideoProvider,
) -> None:
    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    provider_id = asset.provider_asset_id
    assert fake_provider.has_asset(provider_id)
    episode.delete()
    assert not fake_provider.has_asset(provider_id)
    assert not MediaAsset.objects.filter(pk=asset.pk).exists()

    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    episode_pk = episode.pk
    asset_pk = asset.pk
    with patch.object(
        fake_provider, "takedown", side_effect=VideoProviderError("Bunny Stream request failed")
    ):
        with pytest.raises(ProtectedError):
            episode.delete()
    assert Episode.objects.filter(pk=episode_pk).exists()
    assert MediaAsset.objects.filter(pk=asset_pk).exists()
    assert fake_provider.has_asset(asset.provider_asset_id)

    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    assert asset.provider_asset_id.strip()
    episode_pk = episode.pk
    asset_pk = asset.pk
    with patch("apps.playback.ingest.get_video_provider", return_value=None):
        with pytest.raises(ProtectedError):
            episode.delete()
    assert Episode.objects.filter(pk=episode_pk).exists()
    assert MediaAsset.objects.filter(pk=asset_pk).exists()
    assert fake_provider.has_asset(asset.provider_asset_id)

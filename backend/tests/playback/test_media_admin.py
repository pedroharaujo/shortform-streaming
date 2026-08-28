from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.urls import reverse

from apps.catalog.models import Episode, PublicationStatus
from apps.playback.ingest import ingest_master
from apps.playback.models import MediaAsset, MediaAssetState
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import make_episode, make_right, make_series

HMAC_KEY = "synthetic-hmac-for-tests"
SYNTHETIC_MASTER = b"synthetic-vertical-master-bytes"
SYNTHETIC_VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSynthetic caption.\n"
SECRET_DIAGNOSTIC = (
    "AccessKey=supersecret-api-key https://video.example.test/play.m3u8?token=usable-signed-token"
)


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    provider = FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)
    with patch("apps.playback.ingest.get_video_provider", return_value=provider):
        yield provider
    reset_provider_cache()


def _draft_episode() -> Episode:
    series = make_series(title="Admin Ingest")
    make_right(series)
    return make_episode(series, publication_status=PublicationStatus.DRAFT)


@pytest.mark.django_db
def test_anonymous_admin_mediaasset_is_denied(client: Client) -> None:
    series = make_series(title="Secret Draft Title")
    make_right(series)
    root = client.get("/admin/playback/mediaasset/")
    assert root.status_code in {301, 302}
    assert "login" in root.headers.get("Location", "")
    assert b"Secret Draft Title" not in root.content
    add = client.get("/admin/playback/mediaasset/add/")
    assert add.status_code in {301, 302}


@pytest.mark.django_db
def test_staff_upload_retry_and_takedown(
    admin_client: Client, fake_provider: FakeVideoProvider
) -> None:
    episode = _draft_episode()
    add_url = reverse("admin:playback_mediaasset_add")
    response = admin_client.post(
        add_url,
        {
            "episode": str(episode.pk),
            "captions_language": "en",
            "master_file": SimpleUploadedFile(
                "master.bin", SYNTHETIC_MASTER, content_type="application/octet-stream"
            ),
            "captions_file": SimpleUploadedFile(
                "captions.vtt", SYNTHETIC_VTT, content_type="text/vtt"
            ),
            "_save": "Save",
        },
    )
    assert response.status_code in {302, 200}
    asset = MediaAsset.objects.get(episode=episode)
    assert asset.state == MediaAssetState.PROCESSING

    changelist = reverse("admin:playback_mediaasset_changelist")
    retry_ok = admin_client.post(
        changelist,
        {
            "action": "retry_selected",
            "_selected_action": [str(asset.pk)],
            "index": "0",
        },
    )
    assert retry_ok.status_code in {302, 200}
    asset.refresh_from_db()
    assert asset.state == MediaAssetState.READY

    takedown = admin_client.post(
        changelist,
        {
            "action": "takedown_selected",
            "_selected_action": [str(asset.pk)],
            "index": "0",
        },
    )
    assert takedown.status_code in {302, 200}
    asset.refresh_from_db()
    assert asset.state == MediaAssetState.REMOVED
    assert not fake_provider.has_asset(asset.provider_asset_id)


@pytest.mark.django_db
def test_admin_diagnostics_are_redacted(
    admin_client: Client, fake_provider: FakeVideoProvider
) -> None:
    del fake_provider
    episode = _draft_episode()
    asset = ingest_master(
        episode=episode,
        video_bytes=SYNTHETIC_MASTER,
        captions_bytes=SYNTHETIC_VTT,
    )
    asset.mark_failed(SECRET_DIAGNOSTIC)
    assert "supersecret" not in asset.diagnostic_message
    assert "usable-signed-token" not in asset.diagnostic_message
    assert "https://" not in asset.diagnostic_message
    change = admin_client.get(reverse("admin:playback_mediaasset_change", args=[asset.pk]))
    assert change.status_code == 200
    body = change.content.decode()
    assert "supersecret" not in body
    assert "usable-signed-token" not in body
    assert "AccessKey=supersecret" not in body
    assert asset.diagnostic_message in body

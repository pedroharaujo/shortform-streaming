from __future__ import annotations

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import Client
from django.urls import reverse

from apps.catalog.models import Episode, PublicationStatus
from apps.playback.ingest import (
    begin_staff_upload,
    complete_staff_upload,
    ingest_master,
    reconcile,
    sha256_hex,
)
from apps.playback.models import MediaAsset, MediaAssetState
from apps.playback.objectstore import FakeObjectStore, staff_master_object_key
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import make_episode, make_right, make_series

SYNTHETIC_MASTER = b"synthetic-vertical-master-bytes"
SYNTHETIC_VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSynthetic caption.\n"


def _draft_episode() -> Episode:
    return make_episode(
        make_series(title="Admission checked ingest"),
        publication_status=PublicationStatus.DRAFT,
    )


@pytest.mark.django_db
def test_signed_upload_denies_before_object_store_access() -> None:
    episode = _draft_episode()
    with (
        patch("apps.playback.ingest.series_is_admitted", return_value=False),
        patch("apps.playback.ingest.get_object_store") as get_store,
        pytest.raises(ValidationError, match="not available for media upload"),
    ):
        begin_staff_upload(
            episode=episode,
            expected_checksum=sha256_hex(SYNTHETIC_MASTER),
        )
    get_store.assert_not_called()
    assert not MediaAsset.objects.exists()


@pytest.mark.django_db
def test_completion_rechecks_revoked_rights_before_object_store_access() -> None:
    series = make_series(
        title="Licensed upload revoked after start",
        self_owned=False,
        promotional_use_approved=False,
        provenance_reference="",
    )
    right = make_right(series)
    episode = make_episode(series, publication_status=PublicationStatus.DRAFT)
    store = FakeObjectStore()
    with patch("apps.playback.ingest.get_object_store", return_value=store):
        asset, _put_url, _expires = begin_staff_upload(
            episode=episode,
            expected_checksum=sha256_hex(SYNTHETIC_MASTER),
        )
    store.put_bytes(staff_master_object_key(int(asset.pk)), SYNTHETIC_MASTER)
    right.coin_access_permission = False
    right.save(update_fields=["coin_access_permission", "updated_at"])

    with (
        patch("apps.playback.ingest.get_object_store") as get_store,
        patch("apps.playback.ingest.get_video_provider") as get_provider,
        pytest.raises(ValidationError, match="not available for media upload"),
    ):
        complete_staff_upload(asset, captions_bytes=SYNTHETIC_VTT)
    get_store.assert_not_called()
    get_provider.assert_not_called()
    asset.refresh_from_db()
    assert asset.state == MediaAssetState.PENDING_UPLOAD


@pytest.mark.django_db
def test_provider_retry_denies_before_provider_access() -> None:
    episode = _draft_episode()
    asset = MediaAsset.objects.create(
        episode=episode,
        checksum=sha256_hex(SYNTHETIC_MASTER),
        provider_name="fake",
        provider_asset_id="synthetic-provider-id",
        state=MediaAssetState.FAILED,
        captions_language="en",
        has_captions=True,
    )
    with (
        patch("apps.playback.ingest.series_is_admitted", return_value=False) as admitted,
        patch("apps.playback.ingest.get_video_provider") as get_provider,
        pytest.raises(ValidationError, match="not available for media upload"),
    ):
        reconcile(asset)
    get_provider.assert_not_called()
    assert admitted.call_args.kwargs["captions_language"] == "en"
    asset.refresh_from_db()
    assert asset.state == MediaAssetState.FAILED


@pytest.mark.django_db
def test_split_grants_cannot_authorize_actual_caption_sidecar() -> None:
    series = make_series(
        title="Licensed split caption rights",
        self_owned=False,
        promotional_use_approved=False,
        provenance_reference="",
    )
    general_right = make_right(series, contract_reference="synthetic-general-right")
    general_right.subtitle_languages = []
    general_right.save(update_fields=["subtitle_languages", "updated_at"])
    caption_right = make_right(series, contract_reference="synthetic-caption-right")
    caption_right.languages = ["en", "fr"]
    caption_right.subtitle_languages = ["fr"]
    caption_right.coin_access_permission = False
    caption_right.save(
        update_fields=[
            "languages",
            "subtitle_languages",
            "coin_access_permission",
            "updated_at",
        ]
    )
    episode = make_episode(series, publication_status=PublicationStatus.DRAFT)

    with (
        patch("apps.playback.ingest.get_video_provider") as get_provider,
        pytest.raises(ValidationError, match="not available for media upload"),
    ):
        ingest_master(
            episode=episode,
            video_bytes=SYNTHETIC_MASTER,
            captions_bytes=SYNTHETIC_VTT,
            captions_language="fr",
        )
    get_provider.assert_not_called()
    assert not MediaAsset.objects.exists()


@pytest.mark.django_db
def test_failed_direct_upload_retry_uses_new_caption_language() -> None:
    episode = _draft_episode()
    MediaAsset.objects.create(
        episode=episode,
        checksum=sha256_hex(SYNTHETIC_MASTER),
        provider_name="fake",
        state=MediaAssetState.FAILED,
        captions_language="en",
    )
    provider = FakeVideoProvider(hmac_key="synthetic-hmac", ttl_seconds=600)
    with (
        patch(
            "apps.playback.ingest.series_is_admitted",
            side_effect=lambda _series, **kwargs: kwargs.get("captions_language") == "fr",
        ),
        patch("apps.playback.ingest.get_video_provider", return_value=provider),
    ):
        retried = ingest_master(
            episode=episode,
            video_bytes=SYNTHETIC_MASTER,
            captions_bytes=SYNTHETIC_VTT,
            captions_language="fr",
        )

    assert retried.state == MediaAssetState.PROCESSING
    assert retried.captions_language == "fr"


@pytest.mark.django_db
def test_custom_upload_views_require_mediaasset_model_permissions(client: Client) -> None:
    episode = _draft_episode()
    asset = MediaAsset.objects.create(
        episode=episode,
        checksum=sha256_hex(SYNTHETIC_MASTER),
        provider_name="fake",
        state=MediaAssetState.PENDING_UPLOAD,
        captions_language="en",
    )
    user = get_user_model().objects.create(username="staff-without-media-perms", is_staff=True)
    user.set_unusable_password()
    user.save()
    client.force_login(user)

    signed = client.get(reverse("admin:playback_mediaasset_signed_upload"))
    complete = client.get(reverse("admin:playback_mediaasset_complete_upload", args=[asset.pk]))

    assert signed.status_code == 403
    assert complete.status_code == 403

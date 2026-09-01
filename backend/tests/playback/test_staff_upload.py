from __future__ import annotations

import html
import json
import re
from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import Client
from django.urls import reverse

from apps.catalog.models import Episode, PublicationStatus
from apps.playback.ingest import (
    begin_staff_upload,
    complete_staff_upload,
    sha256_hex,
)
from apps.playback.models import MediaAsset, MediaAssetState
from apps.playback.objectstore import (
    FakeObjectStore,
    GCSObjectStore,
    ObjectNotFoundError,
    get_object_store,
    reset_object_store_cache,
    staff_master_object_key,
)
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_series,
)

HMAC_KEY = "synthetic-hmac-for-tests"
SYNTHETIC_MASTER = b"synthetic-vertical-master-bytes"
SYNTHETIC_VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSynthetic caption.\n"
AUTHORIZE = "/v1/playback/{episode_id}/authorize"


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    reset_object_store_cache()
    provider = FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)
    with patch("apps.playback.ingest.get_video_provider", return_value=provider):
        yield provider
    reset_provider_cache()
    reset_object_store_cache()


def _draft_episode() -> Episode:
    series = make_series(title="Staff Upload Title")
    make_right(series)
    return make_episode(series, publication_status=PublicationStatus.DRAFT)


def _extract_put_url(response: Any) -> str:
    match = re.search(
        r'id="id_signed_put_url"[^>]*>([^<]+)',
        response.content.decode(),
    )
    assert match is not None
    return html.unescape(match.group(1).strip())


def _put_path(url: str) -> str:
    parsed = urlparse(url)
    if parsed.query:
        return f"{parsed.path}?{parsed.query}"
    return parsed.path


def _assert_no_stored_write_url(asset: MediaAsset, put_url: str) -> None:
    asset.refresh_from_db()
    parsed = urlparse(put_url)
    signature = parse_qs(parsed.query).get("sig", [""])[0]
    assert put_url not in asset.diagnostic_message
    assert "https://" not in asset.diagnostic_message
    assert "sig=" not in asset.diagnostic_message
    assert signature
    assert signature not in asset.diagnostic_message
    assert signature not in asset.provider_asset_id
    assert signature not in asset.provider_name
    assert put_url not in asset.provider_asset_id


@pytest.mark.django_db
def test_staff_only_mint_does_not_persist_signed_url(
    client: Client, admin_client: Client, fake_provider: FakeVideoProvider
) -> None:
    del fake_provider
    episode = _draft_episode()
    mint_url = reverse("admin:playback_mediaasset_signed_upload")
    anonymous = client.get(mint_url)
    assert anonymous.status_code in {301, 302, 403}

    viewer = get_user_model().objects.create(
        username="viewer",
        is_staff=False,
        is_superuser=False,
    )
    viewer.set_unusable_password()
    viewer.save()
    client.force_login(viewer)
    non_staff = client.get(mint_url)
    assert non_staff.status_code in {301, 302, 403}
    non_staff_post = client.post(
        mint_url,
        {
            "episode": str(episode.pk),
            "expected_checksum": sha256_hex(SYNTHETIC_MASTER),
            "captions_language": "en",
        },
    )
    assert non_staff_post.status_code in {301, 302, 403}
    assert MediaAsset.objects.count() == 0

    minted = admin_client.post(
        mint_url,
        {
            "episode": str(episode.pk),
            "expected_checksum": sha256_hex(SYNTHETIC_MASTER),
            "captions_language": "en",
        },
    )
    assert minted.status_code == 200
    put_url = _extract_put_url(minted)
    assert put_url.startswith("https://")
    asset = MediaAsset.objects.get(episode=episode)
    assert asset.state == MediaAssetState.PENDING_UPLOAD
    assert asset.diagnostic_message == ""
    _assert_no_stored_write_url(asset, put_url)
    changelist = admin_client.get(reverse("admin:playback_mediaasset_changelist"))
    assert changelist.status_code == 200
    assert b"Signed upload" in changelist.content


@pytest.mark.django_db
def test_expired_signed_put_does_not_overwrite(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    del fake_provider
    episode = _draft_episode()
    asset, put_url, _expires = begin_staff_upload(
        episode=episode,
        expected_checksum=sha256_hex(SYNTHETIC_MASTER),
    )
    stored = client.put(
        _put_path(put_url),
        data=SYNTHETIC_MASTER,
        content_type="application/octet-stream",
    )
    assert stored.status_code in {200, 204}
    store = get_object_store()
    assert isinstance(store, FakeObjectStore)
    object_key = staff_master_object_key(int(asset.pk))
    assert store.get_bytes(object_key) == SYNTHETIC_MASTER
    expired_url, _expired_at = store.mint_put_url(object_key, ttl_seconds=-1)
    rejected = client.put(
        _put_path(expired_url),
        data=b"other-master-bytes-xx",
        content_type="application/octet-stream",
    )
    assert rejected.status_code == 403
    assert store.get_bytes(object_key) == SYNTHETIC_MASTER


@pytest.mark.django_db
def test_checksum_mismatch_does_not_submit(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    episode = _draft_episode()
    asset, put_url, _expires = begin_staff_upload(
        episode=episode,
        expected_checksum=sha256_hex(SYNTHETIC_MASTER),
    )
    mismatch_bytes = SYNTHETIC_MASTER + b"-other"
    stored = client.put(
        _put_path(put_url),
        data=mismatch_bytes,
        content_type="application/octet-stream",
    )
    assert stored.status_code in {200, 204}
    with patch.object(fake_provider, "submit_master", wraps=fake_provider.submit_master) as submit:
        with pytest.raises(ValidationError) as exc_info:
            complete_staff_upload(asset)
        submit.assert_not_called()
    assert "expected_checksum" in exc_info.value.message_dict
    asset.refresh_from_db()
    assert asset.state == MediaAssetState.PENDING_UPLOAD
    assert asset.provider_asset_id == ""


@pytest.mark.django_db
def test_matching_put_and_complete_submits_to_provider(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    episode = _draft_episode()
    asset, put_url, _expires = begin_staff_upload(
        episode=episode,
        expected_checksum=sha256_hex(SYNTHETIC_MASTER),
    )
    stored = client.put(
        _put_path(put_url),
        data=SYNTHETIC_MASTER,
        content_type="application/octet-stream",
    )
    assert stored.status_code in {200, 204}
    completed = complete_staff_upload(asset, captions_bytes=SYNTHETIC_VTT)
    assert completed.state == MediaAssetState.PROCESSING
    assert completed.checksum == sha256_hex(SYNTHETIC_MASTER)
    assert fake_provider.has_asset(completed.provider_asset_id)
    completed.refresh_from_db()
    assert "https://" not in completed.diagnostic_message


@pytest.mark.django_db
def test_second_complete_does_not_resubmit(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    episode = _draft_episode()
    asset, put_url, _expires = begin_staff_upload(
        episode=episode,
        expected_checksum=sha256_hex(SYNTHETIC_MASTER),
    )
    stored = client.put(
        _put_path(put_url),
        data=SYNTHETIC_MASTER,
        content_type="application/octet-stream",
    )
    assert stored.status_code in {200, 204}
    first = complete_staff_upload(asset, captions_bytes=SYNTHETIC_VTT)
    assert first.state == MediaAssetState.PROCESSING
    provider_id = first.provider_asset_id
    with patch.object(fake_provider, "submit_master", wraps=fake_provider.submit_master) as submit:
        second = complete_staff_upload(asset, captions_bytes=SYNTHETIC_VTT)
        submit.assert_not_called()
    assert second.pk == first.pk
    assert second.state == MediaAssetState.PROCESSING
    assert second.provider_asset_id == provider_id
    assert fake_provider.has_asset(provider_id)


@pytest.mark.django_db
def test_wrong_signature_put_does_not_store_bytes(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    del fake_provider
    episode = _draft_episode()
    asset, put_url, _expires = begin_staff_upload(
        episode=episode,
        expected_checksum=sha256_hex(SYNTHETIC_MASTER),
    )
    parsed = urlparse(put_url)
    query = parse_qs(parsed.query)
    signature = query["sig"][0]
    flipped = signature.translate(str.maketrans("0123456789abcdef", "1032547698badcfe"))
    assert len(flipped) == len(signature)
    assert flipped != signature
    rejected = client.put(
        f"{parsed.path}?exp={query['exp'][0]}&sig={flipped}",
        data=SYNTHETIC_MASTER,
        content_type="application/octet-stream",
    )
    assert rejected.status_code == 403
    store = get_object_store()
    assert isinstance(store, FakeObjectStore)
    with pytest.raises(ObjectNotFoundError):
        store.get_bytes(staff_master_object_key(int(asset.pk)))


@pytest.mark.django_db
def test_unsigned_put_and_get_are_not_public_reads(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    del fake_provider
    episode = _draft_episode()
    asset, put_url, _expires = begin_staff_upload(
        episode=episode,
        expected_checksum=sha256_hex(SYNTHETIC_MASTER),
    )
    parsed = urlparse(put_url)
    unsigned = client.put(
        parsed.path,
        data=SYNTHETIC_MASTER,
        content_type="application/octet-stream",
    )
    assert unsigned.status_code == 403
    get_response = client.get(parsed.path)
    assert get_response.status_code in {403, 405}
    store = get_object_store()
    assert isinstance(store, FakeObjectStore)
    with pytest.raises(ObjectNotFoundError):
        store.get_bytes(staff_master_object_key(int(asset.pk)))


@pytest.mark.django_db
def test_authorize_grant_has_no_upload_write_url_fields(
    client: Client, fake_provider: FakeVideoProvider
) -> None:
    series, episode = make_published_title(title="Authorize Grant", territory="FR")
    asset = episode.media_assets.get()
    fake_provider.seed_ready_asset(asset.provider_asset_id)
    with (
        patch("apps.catalog.eligibility.timezone.now", return_value=DEFAULT_NOW),
        patch("apps.playback.views.get_video_provider", return_value=fake_provider),
        patch("apps.playback.providers.fake.timezone.now", return_value=DEFAULT_NOW),
    ):
        response = client.post(
            AUTHORIZE.format(episode_id=episode.public_id),
            HTTP_X_TERRITORY="FR",
            HTTP_X_PLATFORM="ios",
            HTTP_X_LANGUAGE="en",
        )
    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"decision", "access_method", "playback_url", "expires_at"}
    assert payload["decision"] == "granted"
    assert payload["access_method"] == "free"
    dumped = json.dumps(payload)
    assert "upload_url" not in payload
    assert "put_url" not in payload
    assert "signed_put_url" not in payload
    assert "write_url" not in dumped
    assert "/internal/staff-masters/" not in dumped
    assert "X-Goog-Signature" not in dumped


def test_gcs_adapter_mints_v4_put_url() -> None:
    store = GCSObjectStore(bucket_name="private-staff-masters")
    generated = (
        "https://storage.example.test/private-staff-masters/staff-masters/1"
        "?X-Goog-Signature=placeholder"
    )
    mock_blob = MagicMock()
    mock_blob.generate_signed_url.return_value = generated
    mock_bucket = MagicMock()
    mock_bucket.blob.return_value = mock_blob
    with patch.object(store, "_bucket", return_value=mock_bucket):
        url, _expires_at = store.mint_put_url("staff-masters/1", ttl_seconds=600)
    assert url == generated
    mock_blob.generate_signed_url.assert_called_once()
    kwargs = mock_blob.generate_signed_url.call_args.kwargs
    assert kwargs["version"] == "v4"
    assert kwargs["method"] == "PUT"
    mock_blob.make_public.assert_not_called()

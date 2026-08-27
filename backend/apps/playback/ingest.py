from __future__ import annotations

import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q

from apps.catalog.models import Episode
from apps.playback.exceptions import VideoAssetNotFoundError, VideoProviderError
from apps.playback.models import (
    IN_FLIGHT_STATES,
    MediaAsset,
    MediaAssetState,
)
from apps.playback.providers.factory import get_video_provider
from apps.playback.providers.types import VideoAssetMetadata
from apps.playback.redact import sanitize_diagnostic

WEBVTT_PREFIX = "WEBVTT"
MIN_MASTER_BYTES = 8
ACTIVE_EXISTS_MESSAGE = (
    "This episode already has in-flight or ready media. "
    "Takedown the current asset before uploading a new master."
)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def current_provider_name() -> str:
    return str(getattr(settings, "VIDEO_PROVIDER", "")).strip().lower() or "unset"


def captions_are_valid(captions_bytes: bytes | None) -> bool:
    if captions_bytes is None or not captions_bytes.strip():
        return False
    try:
        text = captions_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return text.lstrip().startswith(WEBVTT_PREFIX)


def ready_requirements_met(metadata: VideoAssetMetadata, *, require_captions: bool) -> bool:
    if metadata.status != "ready":
        return False
    if metadata.thumbnail_count < 1:
        return False
    if not metadata.renditions:
        return False
    if require_captions and not metadata.has_captions:
        return False
    return True


def find_active_for_episode(episode: Episode) -> MediaAsset | None:
    return (
        MediaAsset.objects.filter(episode=episode, state__in=IN_FLIGHT_STATES)
        .order_by("-id")
        .first()
    )


def expire_provider_asset(asset: MediaAsset) -> None:
    """Delete/expire the provider object. Does not change Django state.

    A live provider is required when provider_asset_id is set. Unset/disabled
    providers fail closed so CASCADE cannot forget the remote object.
    """
    if not asset.provider_asset_id.strip():
        return
    provider = get_video_provider()
    if provider is None:
        raise VideoProviderError("Video provider is unset or disabled.")
    try:
        provider.takedown(asset.provider_asset_id)
    except VideoAssetNotFoundError:
        return


def ingest_master(
    *,
    episode: Episode,
    video_bytes: bytes,
    captions_bytes: bytes | None = None,
    captions_language: str = "en",
    expected_checksum: str | None = None,
    title: str | None = None,
) -> MediaAsset:
    """Staff/local upload: checksum, dedup, submit, leave the asset processing or failed.

    Bytes are hashed and sent to VideoProvider via a temporary file. Django does not
    persist or serve the master.
    """
    if len(video_bytes) < MIN_MASTER_BYTES:
        raise ValidationError({"master_file": "Upload is empty or corrupt."})
    checksum = sha256_hex(video_bytes)
    expected = (expected_checksum or "").strip().lower()
    if expected and expected != checksum:
        raise ValidationError({"expected_checksum": "Checksum mismatch."})
    if captions_bytes is not None and not captions_are_valid(captions_bytes):
        raise ValidationError({"captions_file": "Captions must be a UTF-8 WebVTT file."})

    existing = find_active_for_episode(episode)
    if existing is not None:
        if existing.checksum == checksum:
            if existing.state == MediaAssetState.PROCESSING:
                return reconcile(existing)
            return existing
        raise ValidationError({"episode": ACTIVE_EXISTS_MESSAGE})

    failed_sibling = (
        MediaAsset.objects.filter(
            episode=episode,
            checksum=checksum,
            state=MediaAssetState.FAILED,
        )
        .order_by("-id")
        .first()
    )
    if failed_sibling is not None:
        expire_provider_asset(failed_sibling)
        failed_sibling.provider_asset_id = ""
        failed_sibling.save(update_fields=["provider_asset_id", "updated_at"])
        return _submit_to_provider(
            failed_sibling,
            video_bytes=video_bytes,
            captions_bytes=captions_bytes,
            title=title or episode.english_title or episode.public_id,
        )

    asset = MediaAsset(
        episode=episode,
        checksum=checksum,
        provider_name=current_provider_name(),
        state=MediaAssetState.PENDING_UPLOAD,
        captions_language=captions_language.strip().lower() or "en",
        has_captions=captions_bytes is not None,
        diagnostic_message="",
    )
    asset.full_clean()
    try:
        asset.save()
    except IntegrityError as error:
        raise ValidationError({"episode": ACTIVE_EXISTS_MESSAGE}) from error
    asset.transition_to(MediaAssetState.UPLOADED)
    asset.save(update_fields=["state", "updated_at"])
    return _submit_to_provider(
        asset,
        video_bytes=video_bytes,
        captions_bytes=captions_bytes,
        title=title or episode.english_title or episode.public_id,
    )


def _submit_to_provider(
    asset: MediaAsset,
    *,
    video_bytes: bytes,
    captions_bytes: bytes | None,
    title: str,
) -> MediaAsset:
    provider = get_video_provider()
    if provider is None:
        asset.mark_failed("Video provider is unset or disabled.")
        return asset
    try:
        with TemporaryDirectory(prefix="media-ingest-") as raw_directory:
            directory = Path(raw_directory)
            video_path = directory / "master.bin"
            video_path.write_bytes(video_bytes)
            captions_path: Path | None = None
            if captions_bytes is not None:
                captions_path = directory / "captions.vtt"
                captions_path.write_bytes(captions_bytes)
            provider_id = provider.submit_master(
                title=title,
                video_path=video_path,
                captions_path=captions_path,
                captions_language=asset.captions_language,
            )
    except (VideoProviderError, OSError, ValueError) as error:
        del error
        asset.mark_failed("Provider submit failed.")
        return asset

    asset.provider_name = current_provider_name()
    asset.provider_asset_id = str(provider_id)
    asset.has_captions = captions_bytes is not None
    if asset.state != MediaAssetState.PROCESSING:
        asset.transition_to(MediaAssetState.PROCESSING)
    asset.diagnostic_message = ""
    asset.save()
    return asset


def reconcile(asset: MediaAsset) -> MediaAsset:
    """Idempotent status pull. Used by admin retry and tests. Never stores secrets."""
    with transaction.atomic():
        locked = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        if locked.state in {
            MediaAssetState.READY,
            MediaAssetState.REMOVED,
            MediaAssetState.BLOCKED,
        }:
            return locked
        if locked.state in {MediaAssetState.PENDING_UPLOAD, MediaAssetState.UPLOADED}:
            if locked.provider_asset_id.strip():
                return _poll_and_apply_safe(locked)
            locked.mark_failed("Upload is incomplete. Re-upload the master.")
            return locked
        if locked.state == MediaAssetState.FAILED:
            other_active = (
                MediaAsset.objects.filter(episode_id=locked.episode_id, state__in=IN_FLIGHT_STATES)
                .exclude(pk=locked.pk)
                .exists()
            )
            if other_active:
                locked.mark_failed(ACTIVE_EXISTS_MESSAGE)
                return locked
            locked.transition_to(MediaAssetState.PROCESSING)
            locked.diagnostic_message = ""
            locked.save(update_fields=["state", "diagnostic_message", "updated_at"])
        return _poll_and_apply_safe(locked)


def _poll_and_apply_safe(asset: MediaAsset) -> MediaAsset:
    try:
        return _poll_and_apply(asset)
    except IntegrityError:
        asset.mark_failed("Could not update media asset.")
        return asset


def _poll_and_apply(asset: MediaAsset) -> MediaAsset:
    if not asset.provider_asset_id.strip():
        asset.mark_failed("Provider asset id is missing.")
        return asset
    provider = get_video_provider()
    if provider is None:
        asset.mark_failed("Video provider is unset or disabled.")
        return asset
    try:
        metadata = provider.get_asset(asset.provider_asset_id)
    except VideoAssetNotFoundError:
        asset.mark_failed("Provider asset was not found.")
        return asset
    except VideoProviderError:
        asset.mark_failed("Provider status check failed.")
        return asset

    asset.duration_seconds = metadata.duration_seconds
    asset.renditions = list(metadata.renditions)
    asset.thumbnail_count = metadata.thumbnail_count
    asset.has_captions = metadata.has_captions
    if metadata.status == "failed":
        asset.mark_failed("Provider encoding failed.")
        return asset
    if metadata.status == "ready":
        if not ready_requirements_met(metadata, require_captions=True):
            asset.mark_failed("Captions or thumbnail missing.")
            return asset
        asset.diagnostic_message = ""
        asset.transition_to(MediaAssetState.READY)
        try:
            asset.save()
        except IntegrityError:
            asset.mark_failed("Another ready asset already exists for this episode.")
        return asset
    asset.diagnostic_message = ""
    asset.save()
    return asset


def takedown_asset(asset: MediaAsset) -> MediaAsset:
    """Expire/delete the provider asset and mark removed. Idempotent. Fail closed.

    If the provider delete fails, the row is not marked removed so staff can retry.
    """
    failure: str | None = None
    with transaction.atomic():
        locked = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        if locked.provider_asset_id.strip():
            provider = get_video_provider()
            if provider is None:
                failure = "Video provider is unset or disabled."
            else:
                try:
                    provider.takedown(locked.provider_asset_id)
                except VideoAssetNotFoundError:
                    pass
                except VideoProviderError:
                    failure = "Provider takedown failed."
        if failure is not None:
            locked.diagnostic_message = sanitize_diagnostic(failure)
            locked.save(update_fields=["diagnostic_message", "updated_at"])
        else:
            if locked.state != MediaAssetState.REMOVED:
                locked.transition_to(MediaAssetState.REMOVED)
            locked.save()
            return locked
    raise VideoProviderError(failure or "Provider takedown failed.")


def ready_asset_for_episode(episode: Episode) -> MediaAsset | None:
    return (
        MediaAsset.objects.filter(episode=episode, state=MediaAssetState.READY)
        .exclude(Q(provider_asset_id=""))
        .order_by("-id")
        .first()
    )

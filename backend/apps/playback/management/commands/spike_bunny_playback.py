from __future__ import annotations

import time
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.playback.media import generate_vertical_test_media
from apps.playback.providers.factory import get_video_provider
from apps.playback.redact import redact_playback_url

# ASCII-only: Windows cp1252 consoles cannot encode Unicode arrows.
SPIKE_SUCCESS_FOOTER = (
    "This command does not attach a catalog MediaAsset. Upload a vertical "
    "master through Django Admin (Playback -> Media assets) and retry "
    "reconcile until ready. PLAYBACK_SPIKE_ASSETS is obsolete. Never commit "
    "credentials or paste signed URLs."
)


class Command(BaseCommand):
    help = (
        "Generate 9:16 test media, upload via VideoProvider, and print redacted "
        "status. Requires VIDEO_PROVIDER=bunny and non-production credentials. "
        "Never prints signed URLs."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--timeout-seconds",
            type=int,
            default=180,
            help="How long to poll Bunny until the asset is ready.",
        )
        parser.add_argument(
            "--poll-interval-seconds",
            type=int,
            default=5,
        )

    def handle(self, *args: Any, **options: Any) -> None:
        del args
        provider_name = str(getattr(settings, "VIDEO_PROVIDER", "")).strip().lower()
        if provider_name != "bunny":
            raise CommandError(
                "spike_bunny_playback requires VIDEO_PROVIDER=bunny and non-production "
                "Bunny Stream credentials. A missing credential is not a Bunny failure."
            )
        provider = get_video_provider()
        if provider is None:
            raise CommandError(
                "Bunny Stream provider is not configured. Set BUNNY_STREAM_LIBRARY_ID, "
                "BUNNY_STREAM_API_KEY, BUNNY_STREAM_CDN_HOSTNAME, and "
                "BUNNY_STREAM_TOKEN_KEY. Missing credentials are not a Bunny failure."
            )

        timeout_seconds = int(options["timeout_seconds"])
        poll_interval = int(options["poll_interval_seconds"])
        with TemporaryDirectory(prefix="playback-spike-") as raw_directory:
            directory = Path(raw_directory)
            video_path, captions_path = generate_vertical_test_media(directory)
            asset_id = provider.submit_master(
                title="P2-T05 generated 9:16 spike",
                video_path=video_path,
                captions_path=captions_path,
                captions_language="en",
            )

        deadline = time.monotonic() + timeout_seconds
        metadata = provider.get_asset(asset_id)
        while metadata.status == "processing" and time.monotonic() < deadline:
            time.sleep(poll_interval)
            metadata = provider.get_asset(asset_id)

        if metadata.status != "ready":
            raise CommandError(
                f"Asset did not become ready (status={metadata.status}, "
                f"renditions={','.join(metadata.renditions) or 'none'})."
            )

        access = provider.issue_playback_access(asset_id)
        orientation = "portrait" if metadata.is_portrait else "not-portrait"
        self.stdout.write("Bunny Stream spike (redacted; do not commit this output's URLs):")
        self.stdout.write(f"  asset_id: {asset_id}")
        self.stdout.write(f"  status: {metadata.status}")
        self.stdout.write(f"  renditions: {', '.join(metadata.renditions) or 'none'}")
        self.stdout.write(f"  duration_seconds: {metadata.duration_seconds}")
        self.stdout.write(f"  thumbnails: {metadata.thumbnail_count}")
        self.stdout.write(f"  captions: {'yes' if metadata.has_captions else 'no'}")
        self.stdout.write(f"  size: {metadata.width}x{metadata.height} ({orientation})")
        self.stdout.write(f"  audio: {'yes' if metadata.has_audio else 'no'}")
        self.stdout.write(f"  playback_url: {redact_playback_url(access.playback_url)}")
        self.stdout.write(f"  expires_at: {access.expires_at.isoformat()}")
        self.stdout.write(SPIKE_SUCCESS_FOOTER)

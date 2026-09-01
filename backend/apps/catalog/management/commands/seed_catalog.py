from __future__ import annotations

import hashlib
import uuid
from typing import Any

from django.core.management.base import BaseCommand

from apps.catalog.models import Episode, PublicationStatus, Season, Series
from apps.playback.models import MediaAsset, MediaAssetState

_SEED_NAMESPACE = uuid.UUID("8f2c1b6a-4d3e-4a71-9c0b-6f1e2a3b4c5d")


def _stable_id(prefix: str, name: str) -> str:
    return f"{prefix}_{uuid.uuid5(_SEED_NAMESPACE, name).hex}"


class Command(BaseCommand):
    help = "Create the one synthetic self-owned English MVP series. Idempotent."

    def handle(self, *args: Any, **options: Any) -> None:
        del args, options
        series, _ = Series.objects.update_or_create(
            public_id=_stable_id("ser", "harbor_lights"),
            defaults={
                "title": "Harbor Lights",
                "synopsis": "Synthetic self-owned English microdrama for MVP testing.",
                "publication_status": PublicationStatus.DRAFT,
                "editorial_rank": 0,
                "artwork_url": "",
                "age_rating": "16+",
                "content_warnings": "Synthetic fixture.",
                "attribution": "Generated metadata for MVP testing.",
                "self_owned": True,
                "provenance_reference": "synthetic-self-owned-harbor-lights",
                "promotional_use_approved": True,
                "takedown": False,
                "free_episode_count": 5,
                "rewarded_ads_enabled": True,
            },
        )
        season, _ = Season.objects.update_or_create(series=series, number=1, defaults={})
        episodes: list[Episode] = []
        for order in range(1, 7):
            episode, _ = Episode.objects.update_or_create(
                public_id=_stable_id("ep", f"harbor_lights-e{order}"),
                defaults={
                    "series": series,
                    "season": season,
                    "order": order,
                    "title": f"Harbor Lights · Episode {order}",
                    "synopsis": "Synthetic episode synopsis.",
                    "duration_seconds": 90,
                    "publication_status": PublicationStatus.DRAFT,
                },
            )
            asset = MediaAsset.objects.filter(episode=episode, state=MediaAssetState.READY).first()
            if asset is None:
                asset = MediaAsset(
                    episode=episode,
                )
            asset.checksum = hashlib.sha256(
                f"synthetic-seed:harbor_lights-e{order}".encode()
            ).hexdigest()
            asset.provider_name = "fake"
            asset.provider_asset_id = _stable_id("asset", f"harbor_lights-e{order}")
            asset.state = MediaAssetState.READY
            asset.has_captions = True
            asset.thumbnail_count = 1
            asset.duration_seconds = 90.0
            asset.renditions = ["360p", "540p", "720p"]
            asset.full_clean()
            asset.save()
            episodes.append(episode)
        for episode in episodes:
            episode.publication_status = PublicationStatus.PUBLISHED
            episode.full_clean()
            episode.save(update_fields=["publication_status", "updated_at"])
        series.publication_status = PublicationStatus.PUBLISHED
        series.full_clean()
        series.save(update_fields=["publication_status", "updated_at"])
        self.stdout.write(self.style.SUCCESS("Seeded the synthetic self-owned MVP series."))

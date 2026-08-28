from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.catalog.models import (
    REQUIRED_CATALOG_LANGUAGE,
    ContentRight,
    Episode,
    EpisodeTranslation,
    PublicationStatus,
    Season,
    Series,
    SeriesTranslation,
)
from apps.playback.models import MediaAsset, MediaAssetState

# Stable opaque ids so the command is idempotent. Tests must not depend on this
# command; they build their own rows.
_SEED_NAMESPACE = uuid.UUID("8f2c1b6a-4d3e-4a71-9c0b-6f1e2a3b4c5d")


def _stable_id(prefix: str, name: str) -> str:
    return f"{prefix}_{uuid.uuid5(_SEED_NAMESPACE, name).hex}"


class Command(BaseCommand):
    help = (
        "Create synthetic FR-only and DE-only published English series plus a draft "
        "that must not appear in the public catalog. Idempotent. Generated metadata only."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        now = timezone.now()
        self._upsert_published_series(
            name="harbor_lights",
            title="Harbor Lights",
            synopsis="Synthetic FR-only English microdrama for local catalog tests.",
            territory="FR",
            editorial_rank=0,
            now=now,
        )
        self._upsert_published_series(
            name="alpine_shadows",
            title="Alpine Shadows",
            synopsis="Synthetic DE-only English microdrama for local catalog tests.",
            territory="DE",
            editorial_rank=1,
            now=now,
        )
        self._upsert_draft_series(now=now)
        self.stdout.write(self.style.SUCCESS("Seeded synthetic catalog titles for FR and DE."))

    def _upsert_published_series(
        self,
        *,
        name: str,
        title: str,
        synopsis: str,
        territory: str,
        editorial_rank: int,
        now: datetime,
    ) -> None:
        series, _created = Series.objects.update_or_create(
            public_id=_stable_id("ser", name),
            defaults={
                "publication_status": PublicationStatus.DRAFT,
                "editorial_rank": editorial_rank,
                "original_language": REQUIRED_CATALOG_LANGUAGE,
                "artwork_url": "",
                "age_rating": "16+",
                "content_warnings": "Synthetic fixture. Not licensed media.",
                "attribution": "Generated metadata for P2-T03.",
            },
        )
        SeriesTranslation.objects.update_or_create(
            series=series,
            language=REQUIRED_CATALOG_LANGUAGE,
            defaults={"title": title, "synopsis": synopsis},
        )
        season, _ = Season.objects.update_or_create(series=series, number=1, defaults={})
        episode_count = 6 if name == "harbor_lights" else 1
        published_episodes: list[Episode] = []
        for order in range(1, episode_count + 1):
            episode, _ = Episode.objects.update_or_create(
                public_id=_stable_id("ep", f"{name}-e{order}"),
                defaults={
                    "series": series,
                    "season": season,
                    "order": order,
                    "duration_seconds": 90,
                    "publication_status": PublicationStatus.DRAFT,
                    "window_starts_at": None,
                    "window_ends_at": None,
                },
            )
            EpisodeTranslation.objects.update_or_create(
                episode=episode,
                language=REQUIRED_CATALOG_LANGUAGE,
                defaults={
                    "title": f"{title} · Episode {order}",
                    "synopsis": "Synthetic episode synopsis.",
                },
            )
            checksum = hashlib.sha256(f"synthetic-seed:{name}-e{order}".encode()).hexdigest()
            ready_asset = MediaAsset.objects.filter(
                episode=episode, state=MediaAssetState.READY
            ).first()
            if ready_asset is None:
                ready_asset = MediaAsset(episode=episode, checksum=checksum)
            ready_asset.checksum = checksum
            ready_asset.provider_name = "fake"
            ready_asset.provider_asset_id = _stable_id("asset", f"{name}-e{order}")
            ready_asset.state = MediaAssetState.READY
            ready_asset.captions_language = REQUIRED_CATALOG_LANGUAGE
            ready_asset.has_captions = True
            ready_asset.thumbnail_count = 1
            ready_asset.duration_seconds = 90.0
            ready_asset.renditions = ["360p", "540p", "720p"]
            ready_asset.diagnostic_message = ""
            ready_asset.full_clean()
            ready_asset.save()
            published_episodes.append(episode)
        ContentRight.objects.update_or_create(
            series=series,
            contract_reference=f"synthetic-contract-{name}",
            defaults={
                "licensor": f"Synthetic Licensor {territory}",
                "territory_allowlist": [territory],
                "territory_denylist": [],
                "platforms": ["ios", "android"],
                "languages": [REQUIRED_CATALOG_LANGUAGE],
                "starts_at": now,
                "ends_at": None,
                "exclusive": False,
                "takedown": False,
                "drm_required": False,
                "revenue_share_rule_reference": f"synthetic-revshare-{name}",
                "promotional_clip_permission": True,
            },
        )
        for episode in published_episodes:
            episode.publication_status = PublicationStatus.PUBLISHED
            episode.full_clean()
            episode.save()
        series.publication_status = PublicationStatus.PUBLISHED
        series.full_clean()
        series.save()

    def _upsert_draft_series(self, *, now: datetime) -> None:
        del now
        series, _ = Series.objects.update_or_create(
            public_id=_stable_id("ser", "unreleased_draft"),
            defaults={
                "publication_status": PublicationStatus.DRAFT,
                "editorial_rank": 99,
                "original_language": REQUIRED_CATALOG_LANGUAGE,
                "artwork_url": "",
                "age_rating": "",
                "content_warnings": "",
                "attribution": "Generated metadata for P2-T03.",
            },
        )
        SeriesTranslation.objects.update_or_create(
            series=series,
            language=REQUIRED_CATALOG_LANGUAGE,
            defaults={
                "title": "Unreleased Draft",
                "synopsis": "Synthetic draft that must never appear in the public catalog.",
            },
        )

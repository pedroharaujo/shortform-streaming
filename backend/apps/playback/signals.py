from __future__ import annotations

from django.db.models import ProtectedError
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from apps.playback.exceptions import VideoProviderError
from apps.playback.ingest import expire_provider_asset
from apps.playback.models import MediaAsset


@receiver(pre_delete, sender=MediaAsset)
def expire_provider_asset_on_delete(
    sender: type[MediaAsset], instance: MediaAsset, **kwargs: object
) -> None:
    """CASCADE from Episode/Series must still expire the provider object (ADR 0005)."""
    del sender, kwargs
    try:
        expire_provider_asset(instance)
    except VideoProviderError as error:
        raise ProtectedError(
            "Provider takedown failed; take down the MediaAsset in Admin first.",
            {instance},
        ) from error

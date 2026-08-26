from __future__ import annotations

from collections.abc import Mapping

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers


@extend_schema_serializer(component_name="PlaybackAuthorizeResponse")
class PlaybackAuthorizeResponseSerializer(serializers.Serializer[Mapping[str, object]]):
    playback_url = serializers.URLField(
        help_text=(
            "Opaque HTTPS HLS playlist URL. Short-lived. Does not include Bunny "
            "library ids, video ids as separate fields, or an embed player URL. "
            "Django never serves these bytes."
        )
    )
    expires_at = serializers.DateTimeField(
        help_text="UTC expiry of this playback URL. Clients must re-authorize after expiry."
    )

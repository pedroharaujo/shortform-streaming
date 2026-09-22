from __future__ import annotations

from collections.abc import Mapping

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers


@extend_schema_serializer(component_name="WatchProgressWrite")
class WatchProgressWriteSerializer(serializers.Serializer[Mapping[str, object]]):
    position_seconds = serializers.IntegerField(
        help_text="Playback position in seconds. Clamped to the episode duration on the server."
    )
    completed = serializers.BooleanField(
        required=False,
        default=False,
        help_text=(
            "Client completion flag. The server also records completion at 95% of duration. "
            "Once true, completed stays true."
        ),
    )


@extend_schema_serializer(component_name="ContinueWatchingItem")
class ContinueWatchingItemSerializer(serializers.Serializer[Mapping[str, object]]):
    series_id = serializers.CharField(help_text="Opaque series public id.")
    series_title = serializers.CharField()
    artwork_url = serializers.CharField(allow_null=True)
    episode_id = serializers.CharField(help_text="Opaque episode public id.")
    episode_title = serializers.CharField()
    episode_order = serializers.IntegerField(min_value=1)
    position_seconds = serializers.IntegerField(min_value=0)
    duration_seconds = serializers.IntegerField(min_value=0)


@extend_schema_serializer(component_name="ContinueWatching")
class ContinueWatchingSerializer(serializers.Serializer[Mapping[str, object]]):
    items = ContinueWatchingItemSerializer(many=True)


@extend_schema_serializer(component_name="WatchProgress")
class WatchProgressSerializer(serializers.Serializer[Mapping[str, object]]):
    episode_id = serializers.CharField(help_text="Opaque episode public id.")
    position_seconds = serializers.IntegerField()
    completed = serializers.BooleanField()
    updated_at = serializers.DateTimeField()

from __future__ import annotations

from collections.abc import Mapping

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers


@extend_schema_serializer(component_name="CurrentUserProfile")
class CurrentUserProfileSerializer(serializers.Serializer[Mapping[str, object]]):
    public_id = serializers.CharField(
        help_text="Opaque profile public id. Sequential database integers are never used."
    )
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

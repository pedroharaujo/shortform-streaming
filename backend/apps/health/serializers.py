from __future__ import annotations

from django.db import models
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers


class HealthStatus(models.TextChoices):
    OK = "ok", "ok"
    UNAVAILABLE = "unavailable", "unavailable"


@extend_schema_serializer(component_name="HealthStatus")
class HealthStatusSerializer(serializers.Serializer[dict[str, str]]):
    status = serializers.ChoiceField(
        choices=HealthStatus.choices,
        help_text="ok when the probe succeeds; unavailable when readiness fails.",
    )

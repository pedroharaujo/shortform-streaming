from __future__ import annotations

from collections.abc import Mapping

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from apps.accounts.models import AccountDeletion, UserProfile


@extend_schema_serializer(component_name="CurrentUserProfile")
class CurrentUserProfileSerializer(serializers.Serializer[UserProfile]):
    public_id = serializers.CharField(
        help_text="Opaque profile public id. Sequential database integers are never used."
    )
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    locale = serializers.CharField()
    country = serializers.CharField(allow_blank=True)
    analytics_consent = serializers.BooleanField()
    ads_consent = serializers.BooleanField()
    consent_updated_at = serializers.DateTimeField(allow_null=True)


class StrictSerializer(serializers.Serializer[Mapping[str, object]]):
    def to_internal_value(self, data: object) -> dict[str, object]:
        if isinstance(data, dict) and data.keys() - self.fields.keys():
            raise serializers.ValidationError(
                {"non_field_errors": ["Unknown fields are not accepted."]}
            )
        return super().to_internal_value(data)  # type: ignore[no-any-return]


class AccountPreferencesSerializer(StrictSerializer):
    locale = serializers.ChoiceField(choices=["en"], required=False)
    country = serializers.RegexField(r"^[A-Za-z]{2}$", allow_blank=True, required=False)
    analytics_consent = serializers.BooleanField(required=False)
    ads_consent = serializers.BooleanField(required=False)

    def validate_country(self, value: str) -> str:
        return value.upper()


class AccountDeletionRequestSerializer(StrictSerializer):
    confirmation = serializers.BooleanField()

    def validate_confirmation(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("Explicit confirmation is required.")
        return value


class AccountDeletionSerializer(serializers.Serializer[AccountDeletion]):
    public_id = serializers.CharField()
    status = serializers.ChoiceField(choices=["pending", "completed"])

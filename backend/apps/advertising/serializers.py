from __future__ import annotations

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer
from apps.advertising.models import RewardIntent
from apps.advertising.services import REWARD_DESCRIPTION, reward_status


class RewardIntentCreateSerializer(StrictSerializer):
    episode_id = serializers.CharField(max_length=40)
    request_id = serializers.UUIDField()
    accepted = serializers.BooleanField()

    def validate_accepted(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("Explicit acceptance is required.")
        return value


class RewardIntentSerializer(serializers.Serializer[RewardIntent]):
    id = serializers.UUIDField()
    episode_id = serializers.CharField(source="episode.public_id")
    status = serializers.ChoiceField(
        choices=["pending", "granted", "expired", "unavailable"], read_only=True
    )
    expires_at = serializers.DateTimeField()
    reward_description = serializers.CharField(read_only=True)
    ad_unit_id = serializers.CharField()
    ssv_user_id = serializers.CharField()
    custom_data = serializers.CharField()

    def to_representation(self, instance: RewardIntent) -> dict[str, object]:
        result = super().to_representation(instance)
        result["status"] = reward_status(instance)
        result["reward_description"] = REWARD_DESCRIPTION
        return result

from collections.abc import Mapping

from rest_framework import serializers


class PurchaseIdentitySerializer(serializers.Serializer[Mapping[str, object]]):
    app_user_id = serializers.UUIDField()


class PurchaseReceiptSerializer(serializers.Serializer[Mapping[str, object]]):
    support_reference = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["credited", "quarantined"])
    reason = serializers.CharField()

from collections.abc import Mapping

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer


class PurchaseCatalogRequestSerializer(StrictSerializer):
    application_id = serializers.RegexField(
        r"\Atest\.synthetic\.[A-Za-z0-9_.:/-]*\Z", max_length=128, trim_whitespace=False
    )

    def to_internal_value(self, data: object) -> dict[str, object]:
        if isinstance(data, dict) and any(not isinstance(value, str) for value in data.values()):
            raise serializers.ValidationError(
                {"non_field_errors": ["Purchase identifiers must be strings."]}
            )
        return super().to_internal_value(data)


class PurchaseStatusRequestSerializer(PurchaseCatalogRequestSerializer):
    product_id = serializers.RegexField(
        r"\Asynthetic_[A-Za-z0-9_.:/-]*\Z", max_length=128, trim_whitespace=False
    )
    transaction_id = serializers.RegexField(
        r"\A[A-Za-z0-9_.:$/-]+\Z",
        max_length=200,
        trim_whitespace=False,
        help_text="Store transaction identifier; owner-scoped lookup only, never retained.",
    )


class PurchaseProductSerializer(serializers.Serializer[Mapping[str, object]]):
    product_id = serializers.CharField(max_length=128)
    coins = serializers.IntegerField(min_value=1, max_value=2147483647)
    product_type = serializers.ChoiceField(choices=["consumable"])
    store = serializers.ChoiceField(choices=["PLAY_STORE"])
    environment = serializers.ChoiceField(choices=["SANDBOX"])
    price_source = serializers.ChoiceField(choices=["store"])


class PurchaseCatalogSerializer(serializers.Serializer[Mapping[str, object]]):
    products = PurchaseProductSerializer(many=True)


class PurchaseStatusSerializer(serializers.Serializer[Mapping[str, object]]):
    status = serializers.ChoiceField(
        choices=["awaiting_verification", "credited", "review_required"]
    )
    historical_credited_coins = serializers.IntegerField(min_value=0, max_value=2147483647)
    support_reference = serializers.UUIDField(allow_null=True)


class PurchaseHistoryItemSerializer(serializers.Serializer[Mapping[str, object]]):
    recorded_at = serializers.DateTimeField()
    historical_credited_coins = serializers.IntegerField(min_value=1, max_value=2147483647)
    support_reference = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["credited", "review_required"])


class PurchaseHistorySerializer(serializers.Serializer[Mapping[str, object]]):
    purchases = serializers.ListField(child=PurchaseHistoryItemSerializer(), max_length=20)
    has_more = serializers.BooleanField()


class PurchaseIdentitySerializer(serializers.Serializer[Mapping[str, object]]):
    app_user_id = serializers.UUIDField()


class PurchaseReceiptSerializer(serializers.Serializer[Mapping[str, object]]):
    support_reference = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["credited", "quarantined"])
    reason = serializers.CharField()

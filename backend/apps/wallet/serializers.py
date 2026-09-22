from collections.abc import Mapping

from rest_framework import serializers

from apps.accounts.serializers import StrictSerializer


class CoinUnlockRequestSerializer(StrictSerializer):
    episode_id = serializers.CharField(max_length=40)
    request_id = serializers.UUIDField()
    expected_policy_version = serializers.RegexField(regex=r"^[0-9a-f]{64}$")
    expected_coin_price = serializers.IntegerField(min_value=1, max_value=2147483647)


class WalletSerializer(serializers.Serializer[Mapping[str, object]]):
    balance = serializers.IntegerField(min_value=0, max_value=9007199254740991)
    spending_available = serializers.BooleanField()


class WalletActivityEntrySerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["purchase", "unlock", "correction"])
    amount = serializers.IntegerField(min_value=-2147483647, max_value=2147483647)
    balance_after = serializers.IntegerField(min_value=0, max_value=9007199254740991)
    created_at = serializers.DateTimeField()
    episode_id = serializers.CharField(allow_null=True)
    episode_title = serializers.CharField(allow_null=True)


class WalletActivitySerializer(serializers.Serializer[Mapping[str, object]]):
    entries = WalletActivityEntrySerializer(many=True)
    has_more = serializers.BooleanField()


class CoinUnlockSerializer(serializers.Serializer[Mapping[str, object]]):
    episode_id = serializers.CharField()
    request_id = serializers.UUIDField()
    charged_coins = serializers.IntegerField(min_value=0, max_value=2147483647)
    balance = serializers.IntegerField(min_value=0, max_value=9007199254740991)


class CoinUnlockResolutionSerializer(CoinUnlockSerializer):
    status = serializers.ChoiceField(choices=["completed", "cancelled"])

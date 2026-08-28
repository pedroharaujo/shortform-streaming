from __future__ import annotations

from collections.abc import Mapping

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_serializer
from rest_framework import serializers

from apps.entitlements.policy import LockReason, OfferMethodType


@extend_schema_serializer(component_name="OfferMethod")
class OfferMethodSerializer(serializers.Serializer[Mapping[str, object]]):
    type = serializers.ChoiceField(
        choices=[(kind.value, kind.value) for kind in OfferMethodType],
        help_text=(
            "MVP offer method: entitlement, free, or rewarded_ad. "
            "Coin and subscription are omitted."
        ),
    )
    title = serializers.CharField(help_text="English display title. Not legal or store copy.")
    description = serializers.CharField(
        help_text="English display description. Not legal or store copy."
    )


@extend_schema_serializer(component_name="EpisodeOffersGranted")
class EpisodeOffersGrantedSerializer(serializers.Serializer[Mapping[str, object]]):
    decision = serializers.ChoiceField(
        choices=[("granted", "granted")],
        help_text="granted when the episode is playable via entitlement or the free window.",
    )
    episode_id = serializers.CharField(help_text="Opaque episode public id.")
    methods = OfferMethodSerializer(
        many=True,
        allow_empty=False,
        help_text="Non-empty list of currently available methods. Never includes a playback URL.",
    )


@extend_schema_serializer(component_name="EpisodeOffersLocked")
class EpisodeOffersLockedSerializer(serializers.Serializer[Mapping[str, object]]):
    decision = serializers.ChoiceField(
        choices=[("locked", "locked")],
        help_text="locked when the episode is catalog-eligible but not playable.",
    )
    episode_id = serializers.CharField(help_text="Opaque episode public id.")
    lock_reasons = serializers.ListField(
        child=serializers.ChoiceField(
            choices=[(reason.value, reason.value) for reason in LockReason]
        ),
        allow_empty=False,
        help_text=(
            "Non-empty machine-readable lock reasons. Closed set: login_required, "
            "entitlement_required."
        ),
    )
    methods = OfferMethodSerializer(
        many=True,
        allow_empty=True,
        help_text=(
            "Currently available unlock methods. Empty for anonymous locks and when "
            "rewarded ads are disabled. Never includes coin, subscription, or a playback URL."
        ),
    )


EPISODE_OFFERS_RESPONSE = PolymorphicProxySerializer(
    component_name="EpisodeOffersResponse",
    serializers={
        "granted": EpisodeOffersGrantedSerializer,
        "locked": EpisodeOffersLockedSerializer,
    },
    resource_type_field_name="decision",
)

from __future__ import annotations

from collections.abc import Mapping

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_serializer
from rest_framework import serializers

from apps.entitlements.policy import GrantSource, LockReason


@extend_schema_serializer(component_name="PlaybackAuthorizeGranted")
class PlaybackAuthorizeGrantedSerializer(serializers.Serializer[Mapping[str, object]]):
    decision = serializers.ChoiceField(
        choices=[("granted", "granted")],
        help_text="granted when playback is authorized and a short-lived URL is returned.",
    )
    access_method = serializers.ChoiceField(
        choices=[(source.value, source.value) for source in GrantSource],
        help_text=(
            "Server-authoritative reason this grant is playable: free policy, "
            "verified rewarded-ad entitlement, or staff support entitlement."
        ),
    )
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


@extend_schema_serializer(component_name="PlaybackAuthorizeLocked")
class PlaybackAuthorizeLockedSerializer(serializers.Serializer[Mapping[str, object]]):
    decision = serializers.ChoiceField(
        choices=[("locked", "locked")],
        help_text="locked when the episode is catalog-eligible but not playable.",
    )
    lock_reasons = serializers.ListField(
        child=serializers.ChoiceField(
            choices=[(reason.value, reason.value) for reason in LockReason]
        ),
        allow_empty=False,
        help_text=(
            "Non-empty machine-readable lock reasons. Closed set: login_required, "
            "entitlement_required. Unlock methods are on GET /v1/offers/{episode_id}. "
            "This response never includes offers or a playback URL."
        ),
    )


PLAYBACK_AUTHORIZE_RESPONSE = PolymorphicProxySerializer(
    component_name="PlaybackAuthorizeResponse",
    serializers={
        "granted": PlaybackAuthorizeGrantedSerializer,
        "locked": PlaybackAuthorizeLockedSerializer,
    },
    resource_type_field_name="decision",
)

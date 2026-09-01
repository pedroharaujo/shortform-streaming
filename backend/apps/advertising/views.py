from __future__ import annotations

from uuid import UUID

from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import FirebaseAuthenticationFailed, FirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.views import ERROR_401
from apps.advertising.models import RewardIntent
from apps.advertising.serializers import RewardIntentCreateSerializer, RewardIntentSerializer
from apps.advertising.services import create_reward_intent, current_profile, grant_verified_reward
from apps.advertising.verification import InvalidCallback, verify_callback
from apps.catalog.views import ERROR_404

ERROR_409 = {"$ref": "#/components/schemas/ErrorEnvelope"}


class RewardIntentCreateView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["rewards"],
        summary="Accept an episode reward offer",
        description=(
            "Authenticated Android intent. Requires ads preference and current "
            "catalog eligibility. The request_id is an account-scoped idempotency UUID. "
            "Reuse it after a lost response; changing the episode returns 409. "
            "No client field can grant access. expires_at is 15 minutes after creation."
        ),
        request=RewardIntentCreateSerializer,
        responses={
            201: RewardIntentSerializer,
            200: RewardIntentSerializer,
            401: ERROR_401,
            404: ERROR_404,
            409: ERROR_409,
        },
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        serializer = RewardIntentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row, created = create_reward_intent(
            request.user,
            serializer.validated_data["episode_id"],
            serializer.validated_data["request_id"],
        )
        response = Response(RewardIntentSerializer(row).data, status=201 if created else 200)
        response["Cache-Control"] = "no-store"
        return response


class RewardIntentDetailView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["rewards"],
        summary="Check the authenticated owner's reward",
        description=(
            "Owner-only status, never a playable URL. granted records a verified entitlement; "
            "playback authorization must still recheck current rights and availability."
        ),
        responses={200: RewardIntentSerializer, 401: ERROR_401, 404: ERROR_404},
    )
    def get(self, request: Request, reward_id: UUID) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        with transaction.atomic():
            profile = current_profile(request.user)
            row = (
                RewardIntent.objects.select_related("episode__series", "episode__season")
                .filter(id=reward_id, user_profile=profile)
                .first()
            )
            if row is None:
                raise NotFound("Resource not found.")
            response = Response(RewardIntentSerializer(row).data)
        response["Cache-Control"] = "no-store"
        return response


class AdMobCallbackView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["rewards"],
        auth=[],
        description=(
            "Provider-only AdMob ECDSA verification. Original URL query required; "
            "never a client grant. The verifier percent-decodes the prefix "
            "once to UTF-8, preserving order and literal plus signs, before signature and "
            "key_id (last, in that order). Duplicate verified delivery is "
            "acknowledged without granting again. Invalid/mismatched/expired callbacks return 400."
        ),
        parameters=[
            OpenApiParameter(name=name, type=str, required=True)
            for name in (
                "ad_network",
                "ad_unit",
                "custom_data",
                "reward_amount",
                "reward_item",
                "timestamp",
                "transaction_id",
                "user_id",
                "signature",
                "key_id",
            )
        ],
        responses={200: None, 400: ERROR_409, 503: ERROR_409},
    )
    def get(self, request: Request) -> Response:
        if settings.REWARDED_ADS_MODE not in {"test", "production"}:
            raise InvalidCallback()
        callback = verify_callback(request.META.get("QUERY_STRING", ""))
        grant_verified_reward(callback)
        response = Response(status=200)
        response["Cache-Control"] = "no-store"
        return response

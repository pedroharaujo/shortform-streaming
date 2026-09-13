from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import AuthenticationFailed, ParseError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.accounts.authentication import FirebaseAuthenticationFailed, FirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.views import ERROR_401
from apps.commerce.configuration import reconciliation_enabled
from apps.commerce.reads import purchase_catalog, purchase_history, purchase_status
from apps.commerce.reconciliation import synchronize_purchase
from apps.commerce.serializers import (
    PurchaseCatalogRequestSerializer,
    PurchaseCatalogSerializer,
    PurchaseHistorySerializer,
    PurchaseIdentitySerializer,
    PurchaseReceiptSerializer,
    PurchaseStatusRequestSerializer,
    PurchaseStatusSerializer,
)
from apps.commerce.services import PurchaseUnavailable, fulfill, purchase_identity
from apps.commerce.verification import MAX_BODY, InvalidCallback, authenticate, normalize

PURCHASE_READ_ERRORS = {
    400: OpenApiResponse(
        response={"$ref": "#/components/schemas/ErrorEnvelope"},
        description="Invalid or unexpected purchase lookup fields.",
    ),
    401: ERROR_401,
    409: OpenApiResponse(
        response={"$ref": "#/components/schemas/ErrorEnvelope"},
        description="Coin purchases or the requested catalog are unavailable.",
    ),
}


class PurchaseHistoryView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["commerce"],
        summary="Read the current account's latest verified purchase credits",
        description=(
            "Local test or RevenueCat sandbox mode only. Returns at most 20 owned credits, newest "
            "recorded time then support-reference UUID first, with has_more for older records. "
            "Accepts no query fields. No wallet or purchase identity is created. Historical "
            "credit survives registry changes and is not the current spendable balance, final "
            "refund settlement, entitlement or playback authorization. Any quarantined delivery "
            "keeps a credit in review, including after a successful retry. Empty history does "
            "not prove a purchase failed or make repurchasing safe. Refresh wallet separately."
        ),
        request=None,
        responses={200: PurchaseHistorySerializer, **PURCHASE_READ_ERRORS},
    )
    def get(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        if request.query_params:
            raise ParseError("This operation accepts no query fields.")
        result = purchase_history(request.user)
        response = Response(PurchaseHistorySerializer(result).data)
        response["Cache-Control"] = "no-store"
        return response


class PurchaseCatalogView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["commerce"],
        summary="Read server-approved Android test consumables",
        description=(
            "Local test or RevenueCat sandbox mode only. Quantities come from the server registry. "
            "Native checkout must independently match store offerings and display the exact "
            "store-localized monetary price. No price or purchase grant is supplied here."
        ),
        request=PurchaseCatalogRequestSerializer,
        responses={200: PurchaseCatalogSerializer, **PURCHASE_READ_ERRORS},
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        serializer = PurchaseCatalogRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rows = purchase_catalog(request.user, **serializer.validated_data)
        response = Response(PurchaseCatalogSerializer({"products": rows}).data)
        response["Cache-Control"] = "no-store"
        return response


class PurchaseStatusView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["commerce"],
        summary="Check the current account's historical verified purchase credit",
        description=(
            "Local test or RevenueCat sandbox mode only. Read-only lookup never credits coins. "
            "Unknown, foreign, mismatched and unattributed transactions all await verification. "
            "That result does not prove cancellation or make repurchasing safe. Historical "
            "credit is not the current balance, final refund settlement, entitlement or playback "
            "authorization. Any quarantined delivery on owned credit requires review. Refresh "
            "wallet and current access separately. Send transaction IDs only in the request body."
        ),
        request=PurchaseStatusRequestSerializer,
        responses={200: PurchaseStatusSerializer, **PURCHASE_READ_ERRORS},
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        serializer = PurchaseStatusRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = purchase_status(request.user, **serializer.validated_data)
        response = Response(PurchaseStatusSerializer(result).data)
        response["Cache-Control"] = "no-store"
        return response


class PurchaseIdentityView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["commerce"],
        request=None,
        summary="Obtain the authenticated account's opaque purchase identity",
        description=(
            "Local test or RevenueCat sandbox mode only. The server binds the identity to an "
            "opaque wallet. No client identity or coin amount is accepted."
        ),
        responses={
            200: PurchaseIdentitySerializer,
            400: OpenApiResponse(
                response={"$ref": "#/components/schemas/ErrorEnvelope"},
                description="The operation accepts no request fields.",
            ),
            401: ERROR_401,
            409: OpenApiResponse(
                response={"$ref": "#/components/schemas/ErrorEnvelope"},
                description="Coin purchases are disabled or unavailable.",
            ),
        },
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        if request.data:
            raise ParseError("This operation accepts no fields.")
        identity = purchase_identity(request.user)
        response = Response(PurchaseIdentitySerializer({"app_user_id": identity.pk}).data)
        response["Cache-Control"] = "no-store"
        return response


class PurchaseSyncThrottle(UserRateThrottle):
    scope = "purchase_sync"
    rate = "6/min"


class PurchaseSyncView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [PurchaseSyncThrottle]

    @extend_schema(
        tags=["commerce"],
        summary="Verify a known Google Play sandbox purchase with RevenueCat",
        description=(
            "Explicit local RevenueCat sandbox mode only. Uses the current account's existing "
            "server purchase identity and trusted provider facts; client success never grants "
            "coins. May create one verified credit or retain refund review. Unknown, foreign "
            "and unverifiable purchases remain indistinguishable. Awaiting verification does "
            "not prove cancellation or make repurchasing safe. This cannot recover an unknown "
            "transaction after process loss. Returns historical credit, not current balance or "
            "playback access. Refresh those separately. Six requests per minute per account; "
            "send transaction identifiers only in the JSON body."
        ),
        request=PurchaseStatusRequestSerializer,
        responses={
            200: PurchaseStatusSerializer,
            **PURCHASE_READ_ERRORS,
            429: OpenApiResponse(
                response={"$ref": "#/components/schemas/ErrorEnvelope"},
                description="Purchase verification rate limit exceeded.",
            ),
        },
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        if not reconciliation_enabled():
            raise PurchaseUnavailable()
        if request.query_params:
            raise ParseError("This operation accepts no query fields.")
        serializer = PurchaseStatusRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = synchronize_purchase(request.user, **serializer.validated_data)
        response = Response(PurchaseStatusSerializer(result).data)
        response["Cache-Control"] = "no-store"
        return response


class PurchaseCallbackView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = []

    @extend_schema(exclude=True)
    def post(self, request: Request) -> Response:
        if not settings.DEBUG or settings.COIN_PURCHASE_MODE != "test":
            raise PurchaseUnavailable()
        # Read bounded exact bytes; neither DRF JSON parsing nor user authentication applies.
        raw = request.read(MAX_BODY + 1)
        try:
            authenticate(
                raw,
                request.headers.get("Authorization", ""),
                request.headers.get("X-RevenueCat-Webhook-Signature", ""),
            )
            event = normalize(raw)
        except InvalidCallback:
            raise AuthenticationFailed("Callback verification failed.") from None
        receipt = fulfill(event)
        response = Response(
            PurchaseReceiptSerializer(
                {
                    "support_reference": receipt.pk,
                    "status": receipt.status,
                    "reason": receipt.reason,
                }
            ).data
        )
        response["Cache-Control"] = "no-store"
        return response

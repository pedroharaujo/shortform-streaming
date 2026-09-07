from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import FirebaseAuthenticationFailed, FirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.views import ERROR_401
from apps.catalog.views import ERROR_404
from apps.wallet.capabilities import coin_spending_enabled
from apps.wallet.models import CoinUnlock
from apps.wallet.serializers import (
    CoinUnlockRequestSerializer,
    CoinUnlockResolutionSerializer,
    CoinUnlockSerializer,
    WalletSerializer,
)
from apps.wallet.services import read_wallet, resolve_unlock, unlock_episode


class WalletView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["wallet"],
        summary="Read the authenticated account's coin balance",
        description="Ledger-derived balance. No owner ID or financial history is exposed.",
        responses={200: WalletSerializer, 401: ERROR_401},
    )
    def get(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        response = Response(
            WalletSerializer(
                {
                    "balance": read_wallet(request.user),
                    "spending_available": coin_spending_enabled(),
                }
            ).data
        )
        response["Cache-Control"] = "no-store"
        return response


class CoinUnlockView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["wallet"],
        summary="Unlock an episode using the authenticated account's coins",
        description=(
            "Local synthetic spending only; production is disabled. Reuse the account-scoped "
            "request UUID and the same episode/policy/price after a lost response. Debit and "
            "entitlement commit together. An existing valid entitlement is never charged. "
            "Current eligibility is checked even on replay. No credit or playback URL is returned; "
            "obtain fresh playback authorization after success. Invalid or unavailable "
            "offers, insufficient balance and mismatched request reuse return 409."
        ),
        request=CoinUnlockRequestSerializer,
        responses={
            200: CoinUnlockSerializer,
            400: ERROR_404,
            401: ERROR_401,
            404: ERROR_404,
            409: ERROR_404,
        },
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        serializer = CoinUnlockRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row, balance = unlock_episode(request.user, **serializer.validated_data)
        response = Response(
            CoinUnlockSerializer(
                {
                    "episode_id": row.episode_public_id,
                    "request_id": row.request_id,
                    "charged_coins": row.charged_coins,
                    "balance": balance,
                }
            ).data
        )
        response["Cache-Control"] = "no-store"
        return response


class CoinUnlockResolutionView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["wallet"],
        summary="Resolve or cancel an interrupted coin unlock",
        description=(
            "Local synthetic mode only. Submit the original request unchanged. Atomically "
            "returns its completed accounting receipt or permanently cancels that account's "
            "request so a delayed original cannot charge. No credit, refund, entitlement or "
            "playback URL is created. Completed history does not assert current rights or "
            "access; refresh offers and authorize playback separately. A cancelled result "
            "requires fresh terms and explicit confirmation before using a new request ID. "
            "Mismatched key/terms and disabled mode return 409."
        ),
        request=CoinUnlockRequestSerializer,
        responses={
            200: CoinUnlockResolutionSerializer,
            400: ERROR_404,
            401: ERROR_401,
            409: ERROR_404,
        },
    )
    def post(self, request: Request) -> Response:
        if not isinstance(request.user, UserProfile):
            raise FirebaseAuthenticationFailed()
        serializer = CoinUnlockRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row, balance = resolve_unlock(request.user, **serializer.validated_data)
        completed = isinstance(row, CoinUnlock)
        response = Response(
            CoinUnlockResolutionSerializer(
                {
                    "episode_id": row.episode_public_id,
                    "request_id": row.request_id,
                    "status": "completed" if completed else "cancelled",
                    "charged_coins": row.charged_coins if isinstance(row, CoinUnlock) else 0,
                    "balance": balance,
                }
            ).data
        )
        response["Cache-Control"] = "no-store"
        return response

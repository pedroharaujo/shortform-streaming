from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import AuthenticationFailed, ParseError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import FirebaseAuthenticationFailed, FirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.views import ERROR_401
from apps.commerce.configuration import purchases_enabled
from apps.commerce.serializers import PurchaseIdentitySerializer, PurchaseReceiptSerializer
from apps.commerce.services import PurchaseUnavailable, fulfill, purchase_identity
from apps.commerce.verification import MAX_BODY, InvalidCallback, authenticate, normalize


class PurchaseIdentityView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["commerce"],
        request=None,
        summary="Obtain the authenticated account's opaque purchase identity",
        description=(
            "Synthetic local mode only. The server permanently binds the identity to an opaque "
            "wallet. No client identity or coin amount is accepted."
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


class PurchaseCallbackView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = []

    @extend_schema(exclude=True)
    def post(self, request: Request) -> Response:
        if not purchases_enabled():
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

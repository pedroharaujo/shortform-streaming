from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import FirebaseAuthenticationFailed, FirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.serializers import CurrentUserProfileSerializer

ERROR_401 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description=(
        "Missing, malformed, expired, revoked, or otherwise unverifiable Firebase ID token. "
        "The response never includes the token or firebase_uid."
    ),
)


class MeView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["accounts"],
        summary="Current user profile",
        description=(
            "Return the local profile for the verified Firebase ID token. The first "
            "successful call creates the profile. The same Firebase UID always maps to "
            "one profile. Client-supplied user or profile identifiers are ignored. "
            "firebase_uid is never returned."
        ),
        responses={200: CurrentUserProfileSerializer, 401: ERROR_401},
    )
    def get(self, request: Request) -> Response:
        profile = request.user
        if not isinstance(profile, UserProfile):
            raise FirebaseAuthenticationFailed()
        payload = {
            "public_id": profile.public_id,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at,
        }
        return Response(CurrentUserProfileSerializer(payload).data)

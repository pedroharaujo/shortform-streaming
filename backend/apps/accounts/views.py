from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import (
    DeletionFirebaseAuthentication,
    FirebaseAuthenticationFailed,
    FirebaseIdTokenAuthentication,
)
from apps.accounts.lifecycle import process_account_deletion, request_account_deletion
from apps.accounts.models import UserProfile
from apps.accounts.serializers import (
    AccountDeletionRequestSerializer,
    AccountDeletionSerializer,
    AccountPreferencesSerializer,
    CurrentUserProfileSerializer,
)
from apps.accounts.verification import VerifiedToken

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
        return Response(CurrentUserProfileSerializer(profile).data)

    @extend_schema(
        tags=["accounts"],
        summary="Update account preferences",
        description="Preferences do not activate tracking SDKs or override content eligibility.",
        request=AccountPreferencesSerializer,
        responses={
            200: CurrentUserProfileSerializer,
            400: {"$ref": "#/components/schemas/ErrorEnvelope"},
            401: ERROR_401,
        },
    )
    def patch(self, request: Request) -> Response:
        profile = request.user
        if not isinstance(profile, UserProfile):
            raise FirebaseAuthenticationFailed()
        serializer = AccountPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updates = dict(serializer.validated_data)
        updates["updated_at"] = timezone.now()
        if {"analytics_consent", "ads_consent"} & updates.keys():
            updates["consent_updated_at"] = timezone.now()
        # UPDATE only: model.save() could reinsert a profile removed by a
        # concurrent deletion between authentication and this write.
        if not UserProfile.objects.filter(pk=profile.pk).update(**updates):
            raise FirebaseAuthenticationFailed()
        profile = UserProfile.objects.filter(pk=profile.pk).first()
        if profile is None:
            raise FirebaseAuthenticationFailed()
        return Response(CurrentUserProfileSerializer(profile).data)


class AccountDeletionView(APIView):
    authentication_classes = [DeletionFirebaseAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["accounts"],
        summary="Delete the authenticated account",
        description=(
            "Requires explicit confirmation and Firebase auth_time within five minutes. "
            "Durably removes local data and blocks account access before provider cleanup. "
            "Pending receipts require operator retry; completed receipts erase the raw UID."
        ),
        request=AccountDeletionRequestSerializer,
        responses={
            202: AccountDeletionSerializer,
            400: {"$ref": "#/components/schemas/ErrorEnvelope"},
            401: ERROR_401,
            403: {"$ref": "#/components/schemas/ErrorEnvelope"},
        },
    )
    def post(self, request: Request) -> Response:
        serializer = AccountDeletionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verified = request.auth
        if not isinstance(verified, VerifiedToken):
            raise FirebaseAuthenticationFailed()
        record = request_account_deletion(verified)
        record = process_account_deletion(record.public_id)
        return Response(AccountDeletionSerializer(record).data, status=202)


class ExportUnavailable(APIException):
    status_code = 501
    default_code = "export_unavailable"
    default_detail = "Account export is not available yet. No export request was created."
    envelope_message = default_detail


class AccountExportView(APIView):
    authentication_classes = [FirebaseIdTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["accounts"],
        summary="Account export placeholder",
        description="Explicitly unavailable; does not enqueue or claim to fulfill an export.",
        request=None,
        responses={401: ERROR_401, 501: {"$ref": "#/components/schemas/ErrorEnvelope"}},
    )
    def post(self, request: Request) -> Response:
        raise ExportUnavailable()

from __future__ import annotations

from typing import Any

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from apps.accounts.exceptions import TokenVerificationError
from apps.accounts.models import UserProfile
from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import VerifiedToken, get_token_verifier
from config.spectacular import BEARER_SCHEME

_AUTHENTICATION_REQUIRED = "Authentication is required."
_BEARER_PREFIX = "bearer "


class FirebaseAuthenticationFailed(AuthenticationFailed):
    status_code = 401
    default_code = "authentication_required"
    default_detail = _AUTHENTICATION_REQUIRED
    envelope_code = "authentication_required"
    envelope_message = _AUTHENTICATION_REQUIRED


class FirebaseIdTokenAuthentication(BaseAuthentication):
    """Authenticate from a verified Firebase ID token only.

    Client-supplied user IDs, profile IDs, and Firebase UIDs in the body,
    query string, or headers are ignored.
    """

    def authenticate(self, request: Request) -> tuple[UserProfile, VerifiedToken] | None:
        header = request.META.get("HTTP_AUTHORIZATION")
        if header is None or (isinstance(header, str) and header.strip() == ""):
            raise FirebaseAuthenticationFailed()
        if not isinstance(header, str):
            raise FirebaseAuthenticationFailed()

        authorization = header.strip()
        if not authorization.lower().startswith(_BEARER_PREFIX):
            raise FirebaseAuthenticationFailed()
        credential = authorization[len(_BEARER_PREFIX) :].strip()
        if not credential or credential.lower() == "bearer":
            raise FirebaseAuthenticationFailed()

        try:
            verified = get_token_verifier().verify_id_token(credential)
        except TokenVerificationError as exc:
            raise FirebaseAuthenticationFailed() from exc

        profile = get_or_create_profile(verified.uid)
        return (profile, verified)

    def authenticate_header(self, request: Request) -> str:
        del request
        return "Bearer"


class FirebaseIdTokenScheme(OpenApiAuthenticationExtension):  # type: ignore[no-untyped-call]
    target_class = FirebaseIdTokenAuthentication
    name = "FirebaseIdToken"

    def get_security_definition(self, auto_schema: object) -> dict[str, Any]:
        del auto_schema
        return dict(BEARER_SCHEME)

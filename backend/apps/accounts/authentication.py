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


def _authorization_header(request: Request) -> str | None:
    header = request.META.get("HTTP_AUTHORIZATION")
    if header is None or not isinstance(header, str):
        return None
    stripped = header.strip()
    return stripped if stripped else None


def verify_firebase_bearer(request: Request) -> tuple[UserProfile, VerifiedToken]:
    """Verify a present Bearer Firebase ID token and map UID to one profile.

    Missing, empty, malformed, expired, revoked, or otherwise unverifiable
    credentials raise FirebaseAuthenticationFailed. Client-supplied user IDs
    in the body, query string, or headers are ignored.
    """
    authorization = _authorization_header(request)
    if authorization is None:
        raise FirebaseAuthenticationFailed()
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


class FirebaseIdTokenAuthentication(BaseAuthentication):
    """Authenticate from a verified Firebase ID token only.

    Client-supplied user IDs, profile IDs, and Firebase UIDs in the body,
    query string, or headers are ignored. Missing credentials are 401.
    """

    def authenticate(self, request: Request) -> tuple[UserProfile, VerifiedToken] | None:
        return verify_firebase_bearer(request)

    def authenticate_header(self, request: Request) -> str:
        del request
        return "Bearer"


class OptionalFirebaseIdTokenAuthentication(FirebaseIdTokenAuthentication):
    """Authenticate when a Bearer credential is present; otherwise anonymous.

    Missing or empty Authorization is anonymous. A present invalid, expired,
    or revoked token is 401, never treated as anonymous.
    """

    def authenticate(self, request: Request) -> tuple[UserProfile, VerifiedToken] | None:
        if _authorization_header(request) is None:
            return None
        return super().authenticate(request)


class FirebaseIdTokenScheme(OpenApiAuthenticationExtension):  # type: ignore[no-untyped-call]
    target_class = FirebaseIdTokenAuthentication
    name = "FirebaseIdToken"
    match_subclasses = True

    def get_security_definition(self, auto_schema: object) -> dict[str, Any]:
        del auto_schema
        return dict(BEARER_SCHEME)

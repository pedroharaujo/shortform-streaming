from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse

from config.error_envelope import ErrorEnvelope, envelope_to_dict, get_request_id
from config.firebase import get_firebase_admin_app

APP_CHECK_HEADER = "X-Firebase-AppCheck"
_APP_CHECK_META_HEADER = "HTTP_X_FIREBASE_APPCHECK"
_APP_CHECK_TOKEN_MAX_LENGTH = 4096
_ADMOB_CALLBACK_PATH = "/v1/rewards/admob/ssv"
_MOCK_APP_CHECK_TOKEN = "mock.app-check"


class AppCheckVerificationError(Exception):
    """An App Check credential is missing, malformed, or unverifiable."""


@dataclass(frozen=True, slots=True)
class VerifiedAppCheckToken:
    app_id: str


class AppCheckTokenVerifier(Protocol):
    def verify_token(self, credential: str) -> VerifiedAppCheckToken:
        """Verify an App Check token without logging or persisting it."""


def validate_app_check_credential_shape(credential: str) -> None:
    if (
        not credential
        or len(credential) > _APP_CHECK_TOKEN_MAX_LENGTH
        or not credential.isascii()
        or not credential.isprintable()
        or any(character.isspace() for character in credential)
    ):
        raise AppCheckVerificationError


class MockAppCheckTokenVerifier:
    """Deterministic local/CI seam; production settings reject this verifier."""

    def verify_token(self, credential: str) -> VerifiedAppCheckToken:
        validate_app_check_credential_shape(credential)
        if credential != _MOCK_APP_CHECK_TOKEN:
            raise AppCheckVerificationError
        app_id = str(getattr(settings, "FIREBASE_APP_CHECK_APP_ID", "")).strip()
        if not app_id:
            raise AppCheckVerificationError
        return VerifiedAppCheckToken(app_id=app_id)


class AdminAppCheckTokenVerifier:
    """Production verifier backed by Firebase Admin and an exact Android app ID."""

    def verify_token(self, credential: str) -> VerifiedAppCheckToken:
        validate_app_check_credential_shape(credential)
        expected_app_id = str(getattr(settings, "FIREBASE_APP_CHECK_APP_ID", "")).strip()
        if not expected_app_id:
            raise AppCheckVerificationError
        try:
            from firebase_admin import app_check

            claims = app_check.verify_token(credential, app=get_firebase_admin_app())
        except Exception as exc:
            raise AppCheckVerificationError from exc
        app_id = claims.get("app_id") if isinstance(claims, dict) else None
        if not isinstance(app_id, str) or app_id != expected_app_id:
            raise AppCheckVerificationError
        return VerifiedAppCheckToken(app_id=app_id)


def get_app_check_verifier() -> AppCheckTokenVerifier:
    verifier = str(getattr(settings, "FIREBASE_APP_CHECK_VERIFIER", "")).strip().lower()
    if verifier == "mock":
        return MockAppCheckTokenVerifier()
    if verifier == "admin":
        return AdminAppCheckTokenVerifier()
    raise AppCheckVerificationError


def _is_protected_consumer_request(request: HttpRequest) -> bool:
    return request.path.startswith("/v1/") and request.path != _ADMOB_CALLBACK_PATH


def _rejection(request: HttpRequest) -> JsonResponse:
    payload: ErrorEnvelope = {
        "code": "app_check_required",
        "message": "App verification is required.",
        "request_id": get_request_id(request),
    }
    return JsonResponse(envelope_to_dict(payload), status=401)


class FirebaseAppCheckMiddleware:
    """Verify App Check before protected consumer API view work when enforced."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if getattr(
            settings, "FIREBASE_APP_CHECK_MODE", "disabled"
        ) != "enforce" or not _is_protected_consumer_request(request):
            return self.get_response(request)

        credential = request.META.get(_APP_CHECK_META_HEADER)
        if not isinstance(credential, str):
            return _rejection(request)
        try:
            verified = get_app_check_verifier().verify_token(credential)
        except AppCheckVerificationError:
            return _rejection(request)
        request.app_check_app_id = verified.app_id  # type: ignore[attr-defined]
        return self.get_response(request)

from __future__ import annotations

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from threading import Lock
from typing import Protocol

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

from apps.accounts.exceptions import TokenFailure, TokenVerificationError

MOCK_TOKEN_PREFIX = "mock."
_UID_MAX_LENGTH = 128

_admin_verifier: AdminFirebaseTokenVerifier | None = None
_admin_lock = Lock()


@dataclass(frozen=True, slots=True)
class VerifiedToken:
    uid: str
    auth_time: int | None = None

    @property
    def is_authenticated(self) -> bool:
        return True


class FirebaseTokenVerifier(Protocol):
    def verify_id_token(self, credential: str) -> VerifiedToken:
        """Return claims for a verified ID token, or raise TokenVerificationError."""


class MockFirebaseTokenVerifier:
    """Local/CI verifier. Accepts `mock.<uid>` and optional test overrides.

    Production must not use this class. Special tokens `mock.expired` and
    `mock.revoked` fail closed with the matching reason. Unknown tokens are
    malformed.
    """

    _overrides: dict[str, TokenFailure | str] = {}
    _lock = Lock()

    def verify_id_token(self, credential: str) -> VerifiedToken:
        if not credential or not credential.isprintable() or any(ch.isspace() for ch in credential):
            raise TokenVerificationError(TokenFailure.MALFORMED)

        with self._lock:
            override = self._overrides.get(credential)

        if override is not None:
            if isinstance(override, TokenFailure):
                raise TokenVerificationError(override)
            return _verified_uid(override)

        if credential == f"{MOCK_TOKEN_PREFIX}expired":
            raise TokenVerificationError(TokenFailure.EXPIRED)
        if credential == f"{MOCK_TOKEN_PREFIX}revoked":
            raise TokenVerificationError(TokenFailure.REVOKED)
        if credential.startswith(MOCK_TOKEN_PREFIX):
            return _verified_uid(credential.removeprefix(MOCK_TOKEN_PREFIX))
        raise TokenVerificationError(TokenFailure.MALFORMED)

    @classmethod
    def set_overrides(cls, mapping: Mapping[str, TokenFailure | str]) -> None:
        with cls._lock:
            cls._overrides = dict(mapping)

    @classmethod
    def clear_overrides(cls) -> None:
        with cls._lock:
            cls._overrides = {}


@contextmanager
def mock_token_overrides(mapping: Mapping[str, TokenFailure | str]) -> Iterator[None]:
    MockFirebaseTokenVerifier.set_overrides(mapping)
    try:
        yield
    finally:
        MockFirebaseTokenVerifier.clear_overrides()


class AdminFirebaseTokenVerifier:
    """Production verifier using firebase-admin. Fail closed when verification cannot run."""

    def __init__(self) -> None:
        self._app_ready = False
        self._init_failed = False
        self._lock = Lock()

    def verify_id_token(self, credential: str) -> VerifiedToken:
        if not credential or not credential.isprintable() or any(ch.isspace() for ch in credential):
            raise TokenVerificationError(TokenFailure.MALFORMED)
        if not self._ensure_app():
            raise TokenVerificationError(TokenFailure.UNVERIFIABLE)
        return self._verify_with_admin(credential)

    def _ensure_app(self) -> bool:
        with self._lock:
            if self._app_ready:
                return True
            if self._init_failed:
                return False
            project_id = str(getattr(settings, "FIREBASE_PROJECT_ID", "")).strip()
            if not project_id:
                self._init_failed = True
                return False
            try:
                import firebase_admin
            except ImportError:
                self._init_failed = True
                return False
            try:
                if firebase_admin._apps:
                    self._app_ready = True
                    return True
                firebase_admin.initialize_app(options={"projectId": project_id, "httpTimeout": 10})
                self._app_ready = True
                return True
            except Exception:
                self._init_failed = True
                return False

    def _verify_with_admin(self, credential: str) -> VerifiedToken:
        from firebase_admin import auth
        from firebase_admin.auth import (
            CertificateFetchError,
            ExpiredIdTokenError,
            InvalidIdTokenError,
            RevokedIdTokenError,
            UserDisabledError,
        )
        from firebase_admin.exceptions import FirebaseError

        try:
            decoded = auth.verify_id_token(credential, check_revoked=True)
        except ExpiredIdTokenError as exc:
            raise TokenVerificationError(TokenFailure.EXPIRED) from exc
        except RevokedIdTokenError as exc:
            raise TokenVerificationError(TokenFailure.REVOKED) from exc
        except UserDisabledError as exc:
            raise TokenVerificationError(TokenFailure.REVOKED) from exc
        except CertificateFetchError as exc:
            raise TokenVerificationError(TokenFailure.UNVERIFIABLE) from exc
        except InvalidIdTokenError as exc:
            raise TokenVerificationError(TokenFailure.MALFORMED) from exc
        except (FirebaseError, ValueError, TypeError) as exc:
            raise TokenVerificationError(TokenFailure.UNVERIFIABLE) from exc
        except Exception as exc:
            raise TokenVerificationError(TokenFailure.UNVERIFIABLE) from exc

        uid = decoded.get("uid") if isinstance(decoded, dict) else None
        if not isinstance(uid, str) or not uid.strip():
            raise TokenVerificationError(TokenFailure.MALFORMED)
        verified = _verified_uid(uid.strip())
        auth_time = decoded.get("auth_time")
        # Missing claims must never acquire a fresh server timestamp.
        return VerifiedToken(
            uid=verified.uid,
            auth_time=auth_time if type(auth_time) is int else None,
        )


def get_token_verifier() -> FirebaseTokenVerifier:
    mode = str(getattr(settings, "FIREBASE_AUTH_MODE", "")).strip().lower()
    if mode == "mock":
        return MockFirebaseTokenVerifier()
    if mode == "admin":
        return _get_admin_verifier()
    raise ImproperlyConfigured(
        "FIREBASE_AUTH_MODE must be 'mock' (local/CI) or 'admin' (production)."
    )


def reset_admin_verifier() -> None:
    """Test helper: drop the cached production verifier."""
    global _admin_verifier
    with _admin_lock:
        _admin_verifier = None


def _get_admin_verifier() -> AdminFirebaseTokenVerifier:
    global _admin_verifier
    with _admin_lock:
        if _admin_verifier is None:
            _admin_verifier = AdminFirebaseTokenVerifier()
        return _admin_verifier


def _verified_uid(uid: str) -> VerifiedToken:
    candidate = uid.strip()
    if not candidate or len(candidate) > _UID_MAX_LENGTH:
        raise TokenVerificationError(TokenFailure.MALFORMED)
    if not candidate.isprintable() or any(ch.isspace() for ch in candidate):
        raise TokenVerificationError(TokenFailure.MALFORMED)
    return VerifiedToken(uid=candidate, auth_time=int(timezone.now().timestamp()))

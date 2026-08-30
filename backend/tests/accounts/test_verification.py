from __future__ import annotations

from unittest.mock import patch

import pytest
from django.test import override_settings

from apps.accounts.exceptions import TokenFailure, TokenVerificationError
from apps.accounts.verification import (
    AdminFirebaseTokenVerifier,
    reset_admin_verifier,
)


def test_admin_verifier_fail_closed_without_project_id() -> None:
    reset_admin_verifier()
    with override_settings(FIREBASE_PROJECT_ID=""):
        verifier = AdminFirebaseTokenVerifier()
        with pytest.raises(TokenVerificationError) as raised:
            verifier.verify_id_token("any.token.value")
        assert raised.value.failure == TokenFailure.UNVERIFIABLE
        assert "any.token.value" not in str(raised.value)


def test_admin_verifier_fail_closed_when_initialize_fails() -> None:
    reset_admin_verifier()
    verifier = AdminFirebaseTokenVerifier()
    with (
        override_settings(FIREBASE_PROJECT_ID="demo-shortform-local"),
        patch("firebase_admin._apps", {}),
        patch("firebase_admin.initialize_app", side_effect=ValueError("synthetic")),
    ):
        with pytest.raises(TokenVerificationError) as raised:
            verifier.verify_id_token("any.token.value")
    assert raised.value.failure == TokenFailure.UNVERIFIABLE


def _force_ready(verifier: AdminFirebaseTokenVerifier) -> AdminFirebaseTokenVerifier:
    verifier._app_ready = True  # noqa: SLF001
    return verifier


def test_admin_verifier_maps_expired_revoked_malformed() -> None:
    from firebase_admin.auth import ExpiredIdTokenError, InvalidIdTokenError, RevokedIdTokenError

    verifier = _force_ready(AdminFirebaseTokenVerifier())
    cases = (
        (ExpiredIdTokenError("expired", None), TokenFailure.EXPIRED),
        (RevokedIdTokenError("revoked"), TokenFailure.REVOKED),
        (InvalidIdTokenError("invalid", None), TokenFailure.MALFORMED),
    )
    for exc, failure in cases:
        with patch("firebase_admin.auth.verify_id_token", side_effect=exc):
            with pytest.raises(TokenVerificationError) as raised:
                verifier.verify_id_token("token-value")
            assert raised.value.failure == failure
            assert "token-value" not in str(raised.value)


def test_admin_verifier_returns_uid() -> None:
    verifier = _force_ready(AdminFirebaseTokenVerifier())
    with patch("firebase_admin.auth.verify_id_token", return_value={"uid": "firebase-uid-9"}):
        assert verifier.verify_id_token("token-value").uid == "firebase-uid-9"


@pytest.mark.parametrize("auth_time", [None, "123", True, 123])
def test_admin_verifier_preserves_only_verified_integer_auth_time(auth_time: object) -> None:
    verifier = _force_ready(AdminFirebaseTokenVerifier())
    with patch(
        "firebase_admin.auth.verify_id_token",
        return_value={"uid": "synthetic-user", "auth_time": auth_time, "iat": 999999},
    ):
        verified = verifier.verify_id_token("synthetic-token")
    assert verified.auth_time == (auth_time if type(auth_time) is int else None)

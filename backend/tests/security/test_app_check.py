from __future__ import annotations

from unittest.mock import patch

import pytest
from django.test import Client, override_settings

from config.app_check import AdminAppCheckTokenVerifier, AppCheckVerificationError

pytestmark = pytest.mark.django_db

ENFORCED = override_settings(
    FIREBASE_APP_CHECK_MODE="enforce",
    FIREBASE_APP_CHECK_VERIFIER="mock",
    FIREBASE_APP_CHECK_APP_ID="1:1234567890:android:synthetic",
)


@ENFORCED
def test_consumer_api_rejects_missing_or_malformed_app_check_before_view_work(
    client: Client,
) -> None:
    with patch("apps.catalog.views.eligible_series_queryset") as catalog:
        missing = client.get("/v1/catalog/home")
        malformed = client.get("/v1/catalog/home", HTTP_X_FIREBASE_APPCHECK="token with whitespace")
        invalid = client.get("/v1/catalog/home", HTTP_X_FIREBASE_APPCHECK="well-shaped.invalid")

    for response in (missing, malformed, invalid):
        assert response.status_code == 401
        assert response.json()["code"] == "app_check_required"
        assert set(response.json()) == {"code", "message", "request_id"}
    catalog.assert_not_called()


@ENFORCED
def test_consumer_api_accepts_verified_app_check_without_requiring_user_auth(
    client: Client,
) -> None:
    response = client.get("/v1/catalog/home", HTTP_X_FIREBASE_APPCHECK="mock.app-check")
    assert response.status_code == 200


@ENFORCED
def test_health_admin_and_provider_callback_are_not_app_check_consumers(client: Client) -> None:
    assert client.get("/health/live").status_code == 200
    assert client.get("/admin/login/").status_code == 200
    callback = client.get("/v1/rewards/admob/ssv")
    assert callback.status_code == 400
    assert callback.json()["code"] == "invalid_reward_callback"


def test_disabled_mode_does_not_claim_or_attempt_app_check_verification(client: Client) -> None:
    with patch("config.app_check.get_app_check_verifier") as verifier:
        response = client.get("/v1/catalog/home")
    assert response.status_code == 200
    verifier.assert_not_called()


@override_settings(FIREBASE_APP_CHECK_APP_ID="1:1234567890:android:expected")
def test_admin_verifier_rejects_wrong_app_and_never_exposes_token() -> None:
    verifier = AdminAppCheckTokenVerifier()
    with (
        patch("config.app_check.get_firebase_admin_app", return_value=object()),
        patch(
            "firebase_admin.app_check.verify_token",
            return_value={"app_id": "1:1234567890:android:other"},
        ),
    ):
        with pytest.raises(AppCheckVerificationError) as raised:
            verifier.verify_token("synthetic.app-check-token")
    assert "synthetic.app-check-token" not in str(raised.value)


@override_settings(FIREBASE_APP_CHECK_APP_ID="1:1234567890:android:expected")
def test_admin_verifier_fails_closed_without_exposing_provider_details() -> None:
    verifier = AdminAppCheckTokenVerifier()
    with (
        patch("config.app_check.get_firebase_admin_app", return_value=object()),
        patch(
            "firebase_admin.app_check.verify_token",
            side_effect=RuntimeError("private provider detail"),
        ),
    ):
        with pytest.raises(AppCheckVerificationError) as raised:
            verifier.verify_token("synthetic.app-check-token")
    assert "synthetic.app-check-token" not in str(raised.value)
    assert "private provider detail" not in str(raised.value)


@override_settings(FIREBASE_APP_CHECK_APP_ID="1:1234567890:android:expected")
def test_admin_verifier_passes_the_shared_firebase_app_and_returns_only_app_id() -> None:
    verifier = AdminAppCheckTokenVerifier()
    firebase_app = object()
    with (
        patch("config.app_check.get_firebase_admin_app", return_value=firebase_app),
        patch(
            "firebase_admin.app_check.verify_token",
            return_value={"app_id": "1:1234567890:android:expected"},
        ) as verify,
    ):
        result = verifier.verify_token("synthetic.app-check-token")
    assert result.app_id == "1:1234567890:android:expected"
    verify.assert_called_once_with("synthetic.app-check-token", app=firebase_app)

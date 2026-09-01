from __future__ import annotations

import json
from io import BytesIO
from typing import Protocol
from unittest.mock import patch

import pytest
from django.test import Client, override_settings

from apps.accounts.models import UserProfile
from apps.accounts.verification import VerifiedToken
from config.request_boundaries import BoundedJSONParser, RequestTooLarge

pytestmark = pytest.mark.django_db


class _TestResponse(Protocol):
    status_code: int
    content: bytes


def _assert_safe_boundary(response: _TestResponse, status_code: int, code: str) -> None:
    assert response.status_code == status_code
    payload = json.loads(response.content)
    assert payload["code"] == code
    assert set(payload) == {"code", "message", "request_id"}
    assert "padding" not in payload["message"]


@override_settings(API_MAX_REQUEST_BODY_BYTES=64)
def test_oversized_json_is_rejected_before_authentication_or_mutation(client: Client) -> None:
    body = json.dumps({"padding": "x" * 128})
    with patch("apps.accounts.authentication.get_token_verifier") as verifier:
        verifier.return_value.verify_id_token.return_value = VerifiedToken(uid="boundary-user")
        response = client.generic(
            "PATCH",
            "/v1/me",
            body,
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer synthetic-token",
        )

    _assert_safe_boundary(response, 413, "request_too_large")
    verifier.assert_not_called()
    assert not UserProfile.objects.exists()


def test_form_body_is_rejected_before_authentication_or_mutation(client: Client) -> None:
    with patch("apps.accounts.authentication.get_token_verifier") as verifier:
        verifier.return_value.verify_id_token.return_value = VerifiedToken(uid="boundary-user")
        response = client.generic(
            "PATCH",
            "/v1/me",
            "analytics_consent=true",
            content_type="application/x-www-form-urlencoded",
            HTTP_AUTHORIZATION="Bearer synthetic-token",
        )

    _assert_safe_boundary(response, 415, "unsupported_media_type")
    verifier.assert_not_called()
    assert not UserProfile.objects.exists()


def test_post_form_fields_are_rejected_but_bodyless_post_remains_valid(client: Client) -> None:
    with patch("apps.accounts.authentication.get_token_verifier") as verifier:
        verifier.return_value.verify_id_token.return_value = VerifiedToken(uid="boundary-user")
        rejected = client.post(
            "/v1/me/export",
            {"unexpected": "field"},
            HTTP_AUTHORIZATION="Bearer synthetic-token",
        )
        bodyless = client.post(
            "/v1/me/export",
            HTTP_AUTHORIZATION="Bearer synthetic-token",
        )

    _assert_safe_boundary(rejected, 415, "unsupported_media_type")
    assert bodyless.status_code == 501
    assert verifier.call_count == 1


@override_settings(API_MAX_REQUEST_BODY_BYTES=8)
def test_bounded_parser_rejects_a_stream_that_bypasses_content_length_precheck() -> None:
    with pytest.raises(RequestTooLarge):
        BoundedJSONParser().parse(BytesIO(b'{"value":1}'), media_type="application/json")


@pytest.mark.parametrize("credential", ["x" * 4097, "token-with-\u00e9", "token with space"])
def test_malformed_bearer_is_rejected_before_firebase_verification(
    client: Client, credential: str
) -> None:
    with patch("apps.accounts.authentication.get_token_verifier") as verifier:
        response = client.get("/v1/me", HTTP_AUTHORIZATION=f"Bearer {credential}")

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"
    verifier.assert_not_called()
    assert not UserProfile.objects.exists()

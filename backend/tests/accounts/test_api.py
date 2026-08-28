from __future__ import annotations

import json
from typing import Any

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.verification import MOCK_TOKEN_PREFIX

ME = "/v1/me"
SAFE_MESSAGE = "Authentication is required."
VALID_UID = "firebase-user-1"
VALID_CREDENTIAL = f"{MOCK_TOKEN_PREFIX}{VALID_UID}"


def _bearer(credential: str) -> dict[str, Any]:
    return {"HTTP_AUTHORIZATION": f"Bearer {credential}"}


def _assert_unauthorized(response: Any, *forbidden: str) -> None:
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "authentication_required"
    assert body["message"] == SAFE_MESSAGE
    assert body["request_id"]
    assert "firebase_uid" not in body
    payload = response.content.decode()
    for fragment in forbidden:
        assert fragment not in payload
    assert "firebase-user" not in payload


@pytest.mark.django_db
def test_missing_token_returns_401_error_envelope(client: Client) -> None:
    response = client.get(ME)
    _assert_unauthorized(response)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "header",
    (
        "Bearer",
        "not-bearer tok",
    ),
)
def test_malformed_authorization_header_returns_401(client: Client, header: str) -> None:
    response = client.get(ME, HTTP_AUTHORIZATION=header)
    _assert_unauthorized(response, header)


@pytest.mark.django_db
def test_expired_token_returns_401(client: Client) -> None:
    credential = f"{MOCK_TOKEN_PREFIX}expired"
    response = client.get(ME, **_bearer(credential))
    _assert_unauthorized(response, credential)


@pytest.mark.django_db
def test_valid_token_creates_profile_without_firebase_uid(client: Client) -> None:
    response = client.get(ME, **_bearer(VALID_CREDENTIAL))
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"public_id", "created_at", "updated_at"}
    assert body["public_id"].startswith("usr_")
    assert body["public_id"] != str(UserProfile.objects.get().pk)
    assert VALID_UID not in response.content.decode()
    assert "firebase_uid" not in body
    profile = UserProfile.objects.get()
    assert profile.firebase_uid == VALID_UID
    assert profile.public_id == body["public_id"]


@pytest.mark.django_db
def test_same_firebase_uid_returns_one_profile(client: Client) -> None:
    first = client.get(ME, **_bearer(VALID_CREDENTIAL))
    second = client.get(ME, **_bearer(VALID_CREDENTIAL))
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["public_id"] == second.json()["public_id"]
    assert UserProfile.objects.filter(firebase_uid=VALID_UID).count() == 1


@pytest.mark.django_db
def test_client_supplied_ids_are_ignored(client: Client) -> None:
    attacker_uid = "attacker-uid"
    fake_public_id = "usr_forgedprofileid"
    UserProfile.objects.create(firebase_uid=attacker_uid, public_id=fake_public_id)

    response = client.generic(
        "GET",
        f"{ME}?firebase_uid={attacker_uid}&public_id={fake_public_id}&user_id=99",
        data=json.dumps(
            {
                "firebase_uid": attacker_uid,
                "public_id": fake_public_id,
                "user_id": 99,
            }
        ),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {VALID_CREDENTIAL}",
        HTTP_X_FIREBASE_UID=attacker_uid,
        HTTP_X_USER_ID="99",
        HTTP_X_PUBLIC_ID=fake_public_id,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["public_id"] != fake_public_id
    assert attacker_uid not in response.content.decode()
    created = UserProfile.objects.get(firebase_uid=VALID_UID)
    assert body["public_id"] == created.public_id
    assert UserProfile.objects.filter(firebase_uid=attacker_uid).count() == 1
    assert UserProfile.objects.filter(firebase_uid=VALID_UID).count() == 1

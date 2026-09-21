from __future__ import annotations

import json
from uuid import uuid4

import pytest

from tests.commerce.builders import registry, sandbox_registry
from tests.commerce.test_configuration import sandbox_environment
from tests.test_production_settings import IMPORT_VALID_ENVIRONMENT, run_settings_import

SETUP = """
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.hosted_sandbox'
import django
django.setup()
from django.conf import settings
from apps.commerce.configuration import purchases_enabled, reconciliation_enabled
from apps.wallet.capabilities import coin_spending_enabled
"""


def test_hosted_settings_are_secure_and_coins_default_to_disabled() -> None:
    result = run_settings_import(
        IMPORT_VALID_ENVIRONMENT,
        code=SETUP
        + """
assert settings.DEBUG is False
assert settings.HOSTED_SANDBOX is True
assert settings.ROOT_URLCONF == 'config.consumer_urls'
assert settings.FIREBASE_AUTH_MODE == 'admin'
assert settings.FIREBASE_APP_CHECK_VERIFIER == 'admin'
assert settings.SECURE_SSL_REDIRECT is True
assert settings.SESSION_COOKIE_SECURE is True
assert settings.CSRF_COOKIE_SECURE is True
assert settings.SECURE_HSTS_SECONDS == 31536000
assert settings.REWARDED_ADS_MODE == 'disabled'
assert not purchases_enabled()
assert not reconciliation_enabled()
assert not coin_spending_enabled()
""",
    )
    assert result.returncode == 0, result.stderr


def test_hosted_sandbox_explicit_purchase_spending_and_callback_activation() -> None:
    result = run_settings_import(
        {
            **sandbox_environment(),
            "COIN_SPENDING_MODE": "revenuecat_sandbox",
            "REVENUECAT_SANDBOX_WEBHOOK_ENABLED": "true",
            "COIN_PURCHASE_AUTHORIZATION": uuid4().hex,
            "COIN_PURCHASE_SIGNING_SECRET": uuid4().hex,
            "FIREBASE_APP_CHECK_MODE": "enforce",
            "FIREBASE_APP_CHECK_APP_ID": "1:1234567890:android:0123456789abcdef",
        },
        code=SETUP
        + """
from django.test import Client
assert purchases_enabled() and reconciliation_enabled() and coin_spending_enabled()
assert settings.REVENUECAT_SANDBOX_WEBHOOK_ENABLED is True
client = Client(HTTP_HOST='api.example.test')
assert client.post('/v1/purchases/revenuecat', b'{}', content_type='application/json',
                   secure=True).status_code == 403
assert client.get('/v1/me', secure=True).status_code == 401
""",
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    "overrides",
    [
        {"FIREBASE_AUTH_MODE": "mock"},
        {"FIREBASE_PROJECT_ID": ""},
        {"FIREBASE_AUTH_EMULATOR_HOST": "localhost:9099"},
        {"FIREBASE_APP_CHECK_VERIFIER": "mock"},
        {"FIREBASE_APP_CHECK_MODE": "enforce"},
        {"DJANGO_SECRET_KEY": ""},
        {"DJANGO_ALLOWED_HOSTS": ""},
        {"DATABASE_URL": "sqlite:///generated.sqlite3"},
        {"VIDEO_PROVIDER": "fake"},
        {"STAFF_UPLOAD_STORE": "fake"},
        {"COIN_PURCHASE_MODE": "production"},
        {"COIN_SPENDING_MODE": "test"},
        {"COIN_SPENDING_MODE": "production"},
        {"REWARDED_ADS_MODE": "test"},
        {
            "REWARDED_ADS_MODE": "production",
            "REWARDED_ADS_UNIT_ID": "ca-app-pub-1111111111111111/2222222222",
        },
    ],
)
def test_hosted_settings_reject_insecure_or_non_sandbox_configuration(
    overrides: dict[str, str],
) -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, **overrides}, code=SETUP)
    assert result.returncode != 0


def test_hosted_settings_reject_valid_synthetic_purchase_configuration() -> None:
    result = run_settings_import(
        {
            **IMPORT_VALID_ENVIRONMENT,
            "COIN_PURCHASE_MODE": "test",
            "COIN_PURCHASE_PRODUCTS": json.dumps(registry()),
            "COIN_PURCHASE_AUTHORIZATION": uuid4().hex,
            "COIN_PURCHASE_SIGNING_SECRET": uuid4().hex,
        },
        code=SETUP,
    )
    assert result.returncode != 0
    assert "Hosted coin purchases require RevenueCat sandbox mode" in result.stderr


@pytest.mark.parametrize("field", ["COIN_PURCHASE_AUTHORIZATION", "COIN_PURCHASE_SIGNING_SECRET"])
def test_hosted_callback_requires_both_authentication_secrets(field: str) -> None:
    result = run_settings_import(
        {
            **sandbox_environment(),
            "REVENUECAT_SANDBOX_WEBHOOK_ENABLED": "true",
            "COIN_PURCHASE_AUTHORIZATION": uuid4().hex,
            "COIN_PURCHASE_SIGNING_SECRET": uuid4().hex,
            field: "",
        },
        code=SETUP,
    )
    assert result.returncode != 0
    assert "Purchase callback authentication" in result.stderr


@pytest.mark.parametrize("field,value", [("synthetic", True), ("environment", "PRODUCTION")])
def test_hosted_registry_cannot_admit_synthetic_or_production_purchases(
    field: str, value: object
) -> None:
    rows = sandbox_registry()
    rows[0][field] = value
    result = run_settings_import(
        {**sandbox_environment(), "COIN_PURCHASE_PRODUCTS": json.dumps(rows)}, code=SETUP
    )
    assert result.returncode != 0


def test_hosted_consumer_urlconf_excludes_every_staff_entrypoint() -> None:
    result = run_settings_import(
        IMPORT_VALID_ENVIRONMENT,
        code=SETUP
        + """
from django.test import Client
from django.urls import resolve, Resolver404
client = Client(HTTP_HOST='api.example.test')
assert client.get('/health/live', secure=True).status_code == 200
for path in (
    '/admin/', '/admin/login/', '/admin/playback/mediaasset/signed-upload/',
    '/admin/playback/mediaasset/1/complete-upload/', '/internal/staff-masters/1',
):
    assert client.get(path, secure=True).status_code == 404, path
    assert client.post(path, secure=True).status_code == 404, path
# The existing private service continues to expose its staff workflow.
assert resolve('/admin/login/', urlconf='config.urls').url_name == 'login'
""",
    )
    assert result.returncode == 0, result.stderr

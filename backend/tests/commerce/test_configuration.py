from __future__ import annotations

import json
from uuid import uuid4

import pytest

from tests.commerce.builders import registry, sandbox_registry
from tests.test_production_settings import IMPORT_VALID_ENVIRONMENT, run_settings_import


def test_valid_synthetic_settings_still_reject_production_activation() -> None:
    result = run_settings_import(
        {
            **IMPORT_VALID_ENVIRONMENT,
            "COIN_PURCHASE_MODE": "test",
            "COIN_PURCHASE_PRODUCTS": json.dumps(registry()),
            "COIN_PURCHASE_AUTHORIZATION": uuid4().hex,
            "COIN_PURCHASE_SIGNING_SECRET": uuid4().hex,
        }
    )
    assert result.returncode != 0
    assert "Coin purchases cannot be enabled" in result.stderr


@pytest.mark.parametrize(
    "overrides",
    [
        {"COIN_PURCHASE_MODE": "production"},
        {"COIN_PURCHASE_MODE": "test"},
        {"COIN_PURCHASE_MODE": "test", "COIN_PURCHASE_PRODUCTS": json.dumps(registry())},
    ],
)
def test_incomplete_or_unknown_purchase_configuration_fails(overrides: dict[str, str]) -> None:
    result = run_settings_import(
        {**IMPORT_VALID_ENVIRONMENT, **overrides}, code="import config.settings.local"
    )
    assert result.returncode != 0


def sandbox_environment() -> dict[str, str]:
    return {
        **IMPORT_VALID_ENVIRONMENT,
        "COIN_PURCHASE_MODE": "revenuecat_sandbox",
        "COIN_PURCHASE_PRODUCTS": json.dumps(sandbox_registry()),
        "REVENUECAT_PROJECT_ID": "projGenerated",
        "REVENUECAT_API_KEY": uuid4().hex,
    }


def test_sandbox_settings_load_locally_but_cannot_activate_production() -> None:
    environment = sandbox_environment()
    local = run_settings_import(environment, code="import config.settings.local")
    assert local.returncode == 0, local.stderr
    production = run_settings_import(environment)
    assert production.returncode != 0
    assert "Coin purchases cannot be enabled" in production.stderr


@pytest.mark.parametrize("field", ["REVENUECAT_PROJECT_ID", "REVENUECAT_API_KEY"])
def test_sandbox_requires_private_provider_configuration(field: str) -> None:
    environment = {**sandbox_environment(), field: ""}
    result = run_settings_import(environment, code="import config.settings.local")
    assert result.returncode != 0


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("synthetic", True),
        ("environment", "PRODUCTION"),
        ("approval_reference", "unapproved"),
        ("store", "APP_STORE"),
        ("product_type", "subscription"),
        ("coins", True),
    ],
)
def test_sandbox_registry_rejects_unapproved_scope(field: str, value: object) -> None:
    rows = sandbox_registry()
    rows[0][field] = value
    result = run_settings_import(
        {**sandbox_environment(), "COIN_PURCHASE_PRODUCTS": json.dumps(rows)},
        code="import config.settings.local",
    )
    assert result.returncode != 0

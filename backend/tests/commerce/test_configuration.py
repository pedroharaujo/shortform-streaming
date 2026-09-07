from __future__ import annotations

import json
from uuid import uuid4

import pytest

from tests.commerce.builders import registry
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

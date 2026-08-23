from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_ENVIRONMENT = ("DJANGO_SECRET_KEY", "DJANGO_ALLOWED_HOSTS", "DATABASE_URL")
VALID_ENVIRONMENT = {
    "DJANGO_SECRET_KEY": "replace-with-provider-value",
    "DJANGO_ALLOWED_HOSTS": "api.example.test",
    "DATABASE_URL": "postgresql://example@127.0.0.1:5432/example",
}


def run_settings_import(overrides: dict[str, str]) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    for name in REQUIRED_ENVIRONMENT:
        environment.pop(name, None)
    environment.update(overrides)
    environment["PYTHONPATH"] = str(ROOT / "backend")
    return subprocess.run(
        [sys.executable, "-c", "import config.settings.production"],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize("missing_name", REQUIRED_ENVIRONMENT)
def test_production_settings_fail_fast_when_required_value_is_missing(missing_name: str) -> None:
    environment = {name: value for name, value in VALID_ENVIRONMENT.items() if name != missing_name}

    result = run_settings_import(environment)

    assert result.returncode != 0
    assert missing_name in result.stderr


def test_production_settings_accept_synthetic_complete_configuration() -> None:
    result = run_settings_import(VALID_ENVIRONMENT)

    assert result.returncode == 0, result.stderr

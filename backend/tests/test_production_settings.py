from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_ENVIRONMENT = ("DJANGO_SECRET_KEY", "DJANGO_ALLOWED_HOSTS", "DATABASE_URL")
PLAYBACK_ENVIRONMENT = (
    "VIDEO_PROVIDER",
    "BUNNY_STREAM_LIBRARY_ID",
    "BUNNY_STREAM_API_KEY",
    "BUNNY_STREAM_CDN_HOSTNAME",
    "BUNNY_STREAM_TOKEN_KEY",
    "PLAYBACK_SPIKE_ASSETS",
)
CONFIGURATION_ENVIRONMENT = (
    *REQUIRED_ENVIRONMENT,
    "DATABASE_CONNECT_TIMEOUT",
    *PLAYBACK_ENVIRONMENT,
)
IMPORT_VALID_ENVIRONMENT = {
    "DJANGO_SECRET_KEY": "replace-with-provider-value",
    "DJANGO_ALLOWED_HOSTS": "api.example.test",
    "DATABASE_URL": "postgresql://example@127.0.0.1:5432/example",
}
DEPLOY_VALID_SECRET = "".join(
    ("synthetic-check-only-", "9v!x2L#p7Q@m4Z-k8R_", "c5T+w3N-y6F$a1B%u0D")
)
DEPLOY_VALID_ENVIRONMENT = {
    **IMPORT_VALID_ENVIRONMENT,
    "DJANGO_SECRET_KEY": DEPLOY_VALID_SECRET,
}


def run_settings_import(overrides: dict[str, str]) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    for name in CONFIGURATION_ENVIRONMENT:
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
    environment = {
        name: value for name, value in IMPORT_VALID_ENVIRONMENT.items() if name != missing_name
    }

    result = run_settings_import(environment)

    assert result.returncode != 0
    assert missing_name in result.stderr


@pytest.mark.parametrize(
    "database_url",
    (
        "sqlite:///synthetic.sqlite3",
        "mysql://example@127.0.0.1/example",
        "unsupported://example@127.0.0.1/example",
    ),
)
def test_production_settings_reject_non_postgresql_database(database_url: str) -> None:
    environment = {**IMPORT_VALID_ENVIRONMENT, "DATABASE_URL": database_url}

    result = run_settings_import(environment)

    assert result.returncode != 0
    assert "PostgreSQL" in result.stderr


def test_production_settings_reject_empty_database_url() -> None:
    environment = {**IMPORT_VALID_ENVIRONMENT, "DATABASE_URL": " "}

    result = run_settings_import(environment)

    assert result.returncode != 0
    assert "DATABASE_URL" in result.stderr


@pytest.mark.parametrize("connect_timeout", ("0", "-1", "not-a-number", "11"))
def test_production_settings_reject_invalid_connect_timeout(connect_timeout: str) -> None:
    environment = {
        **IMPORT_VALID_ENVIRONMENT,
        "DATABASE_CONNECT_TIMEOUT": connect_timeout,
    }

    result = run_settings_import(environment)

    assert result.returncode != 0
    assert "DATABASE_CONNECT_TIMEOUT" in result.stderr


def test_production_settings_accept_import_complete_postgresql_configuration() -> None:
    result = run_settings_import(IMPORT_VALID_ENVIRONMENT)

    assert result.returncode == 0, result.stderr


def test_production_settings_pass_deployment_checks_with_strong_synthetic_config() -> None:
    environment = os.environ.copy()
    for name in CONFIGURATION_ENVIRONMENT:
        environment.pop(name, None)
    environment.update(DEPLOY_VALID_ENVIRONMENT)
    environment["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
    result = subprocess.run(
        [
            sys.executable,
            "backend/manage.py",
            "check",
            "--deploy",
            "--fail-level",
            "WARNING",
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr


def test_production_settings_reject_fake_video_provider() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "VIDEO_PROVIDER": "fake"})

    assert result.returncode != 0
    assert "VIDEO_PROVIDER" in result.stderr


def test_production_settings_reject_bunny_without_credentials() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "VIDEO_PROVIDER": "bunny"})

    assert result.returncode != 0
    assert "BUNNY_STREAM" in result.stderr


def test_production_settings_accept_bunny_with_required_credentials() -> None:
    result = run_settings_import(
        {
            **IMPORT_VALID_ENVIRONMENT,
            "VIDEO_PROVIDER": "bunny",
            "BUNNY_STREAM_LIBRARY_ID": "12345",
            "BUNNY_STREAM_API_KEY": "replace-with-provider-value",
            "BUNNY_STREAM_CDN_HOSTNAME": "vz-example.b-cdn.net",
            "BUNNY_STREAM_TOKEN_KEY": "replace-with-provider-value",
        }
    )

    assert result.returncode == 0, result.stderr


def test_production_settings_reject_unknown_video_provider() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "VIDEO_PROVIDER": "gcp"})

    assert result.returncode != 0
    assert "VIDEO_PROVIDER" in result.stderr

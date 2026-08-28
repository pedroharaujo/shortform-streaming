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
    "STAFF_UPLOAD_STORE",
    "STAFF_UPLOAD_GCS_BUCKET",
    "STAFF_UPLOAD_URL_TTL_SECONDS",
)
CONFIGURATION_ENVIRONMENT = (
    *REQUIRED_ENVIRONMENT,
    "DATABASE_CONNECT_TIMEOUT",
    "CONN_MAX_AGE",
    "FIREBASE_AUTH_MODE",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_AUTH_EMULATOR_HOST",
    *PLAYBACK_ENVIRONMENT,
)
IMPORT_VALID_ENVIRONMENT = {
    "DJANGO_SECRET_KEY": "replace-with-provider-value",
    "DJANGO_ALLOWED_HOSTS": "api.example.test",
    "DATABASE_URL": "postgresql://example@127.0.0.1:5432/example",
    "FIREBASE_PROJECT_ID": "demo-shortform-local",
}


def run_settings_import(
    overrides: dict[str, str],
    code: str = "import config.settings.production",
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    for name in CONFIGURATION_ENVIRONMENT:
        environment.pop(name, None)
    environment.update(overrides)
    environment["PYTHONPATH"] = str(ROOT / "backend")
    return subprocess.run(
        [sys.executable, "-c", code],
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


def test_production_settings_reject_non_postgresql_database() -> None:
    environment = {**IMPORT_VALID_ENVIRONMENT, "DATABASE_URL": "sqlite:///synthetic.sqlite3"}

    result = run_settings_import(environment)

    assert result.returncode != 0
    assert "PostgreSQL" in result.stderr


def test_production_settings_require_firebase_project_id() -> None:
    environment = {
        name: value
        for name, value in IMPORT_VALID_ENVIRONMENT.items()
        if name != "FIREBASE_PROJECT_ID"
    }
    result = run_settings_import(environment)
    assert result.returncode != 0
    assert "FIREBASE_PROJECT_ID" in result.stderr


def test_production_settings_reject_mock_firebase_auth_mode() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "FIREBASE_AUTH_MODE": "mock"})
    assert result.returncode != 0
    assert "firebase-admin" in result.stderr


def test_production_settings_accept_import_complete_postgresql_configuration() -> None:
    result = run_settings_import(IMPORT_VALID_ENVIRONMENT)

    assert result.returncode == 0, result.stderr


def test_production_settings_reject_fake_video_provider() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "VIDEO_PROVIDER": "fake"})

    assert result.returncode != 0
    assert "VIDEO_PROVIDER" in result.stderr


def test_production_settings_reject_fake_staff_upload_store() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "STAFF_UPLOAD_STORE": "fake"})

    assert result.returncode != 0
    assert "STAFF_UPLOAD_STORE" in result.stderr


def test_production_settings_accept_unset_staff_upload_store() -> None:
    result = run_settings_import(IMPORT_VALID_ENVIRONMENT)

    assert result.returncode == 0, result.stderr


def test_production_settings_gcs_staff_upload_without_bucket_fails() -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "STAFF_UPLOAD_STORE": "gcs"})

    assert result.returncode != 0
    assert "STAFF_UPLOAD_GCS_BUCKET" in result.stderr


CONN_MAX_AGE_CODE = (
    "from config.settings import production; print(production.DATABASES['default']['CONN_MAX_AGE'])"
)


def test_production_settings_conn_max_age_defaults_to_zero() -> None:
    result = run_settings_import(IMPORT_VALID_ENVIRONMENT, code=CONN_MAX_AGE_CODE)

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "0"


def test_production_settings_conn_max_age_accepts_sixty() -> None:
    result = run_settings_import(
        {**IMPORT_VALID_ENVIRONMENT, "CONN_MAX_AGE": "60"},
        code=CONN_MAX_AGE_CODE,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "60"


@pytest.mark.parametrize("value", ["abc", "-1", "3601"])
def test_production_settings_conn_max_age_rejects_invalid(value: str) -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "CONN_MAX_AGE": value})

    assert result.returncode != 0
    assert "CONN_MAX_AGE" in result.stderr

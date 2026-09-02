from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize(
    ("override", "expected"),
    (
        (None, "localhost,127.0.0.1,10.0.2.2,[::1]"),
        ("api.local.test, 10.0.2.2", "api.local.test,10.0.2.2"),
    ),
)
def test_local_allowed_hosts_defaults_and_override(override: str | None, expected: str) -> None:
    environment = os.environ.copy()
    for name in (
        "CONN_MAX_AGE",
        "DATABASE_CONNECT_TIMEOUT",
        "DATABASE_URL",
        "DJANGO_ALLOWED_HOSTS",
        "DJANGO_SECRET_KEY",
        "REWARDED_ADS_MODE",
        "REWARDED_ADS_UNIT_ID",
    ):
        environment.pop(name, None)
    if override is not None:
        environment["DJANGO_ALLOWED_HOSTS"] = override
    environment["PYTHONPATH"] = str(ROOT / "backend")

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from config.settings.local import ALLOWED_HOSTS; print(','.join(ALLOWED_HOSTS))",
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == expected


@pytest.mark.parametrize(
    ("mode", "unit_id", "allowed"),
    [
        ("disabled", None, True),
        ("disabled", "ca-app-pub-1111111111111111/2222222222", True),
        ("test", None, True),
        ("test", "ca-app-pub-1111111111111111/2222222222", True),
        ("production", "ca-app-pub-1111111111111111/2222222222", False),
        ("test", "", True),
        ("test", "2222222222", False),
        ("test", "ca-app-pub-111111111111111/2222222222", False),
        ("test", "ca-app-pub-1111111111111111/222222222", False),
        ("test", "ca-app-pub-1111111111111111/2222222222/extra", False),
        ("test", "ca-app-pub-1111111111111111/222222222\u0662", False),
    ],
)
def test_local_rewarded_unit_configuration(mode: str, unit_id: str | None, allowed: bool) -> None:
    environment = os.environ.copy()
    environment.pop("REWARDED_ADS_UNIT_ID", None)
    environment["REWARDED_ADS_MODE"] = mode
    if unit_id is not None:
        environment["REWARDED_ADS_UNIT_ID"] = unit_id
    environment["PYTHONPATH"] = str(ROOT / "backend")
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from config.settings.local import REWARDED_ADS_UNIT_ID; print(REWARDED_ADS_UNIT_ID)",
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    if allowed:
        assert result.returncode == 0, result.stderr
        expected = unit_id or ("ca-app-pub-3940256099942544/5224354917" if mode == "test" else "")
        assert result.stdout.strip() == expected
    else:
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "REWARDED_ADS" in result.stderr

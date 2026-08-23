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
        "DATABASE_CONNECT_TIMEOUT",
        "DATABASE_URL",
        "DJANGO_ALLOWED_HOSTS",
        "DJANGO_SECRET_KEY",
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

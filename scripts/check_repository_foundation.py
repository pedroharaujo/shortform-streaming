"""Run the dependency-free P1-T01 repository foundation gate."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("secret scan", [sys.executable, "scripts/scan_secrets.py"]),
    (
        "repository tests",
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            "tests/repository",
            "-p",
            "test_*.py",
        ],
    ),
    ("AI governance", [sys.executable, "scripts/validate_ai_governance.py"]),
)


def main() -> int:
    for label, command in CHECKS:
        print(f"==> {label}", flush=True)
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            print(f"Repository foundation failed during {label}.", file=sys.stderr)
            return result.returncode
    print("Repository foundation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

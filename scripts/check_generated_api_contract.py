"""Fail if generated OpenAPI or TypeScript client artifacts differ from git."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED_PATHS = (
    "docs/api/openapi.yaml",
    "packages/api-client/src/generated",
)


def run_git(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def main() -> int:
    diff = run_git(["diff", "--", *GENERATED_PATHS])
    if diff.returncode not in {0, 1}:
        sys.stderr.write(diff.stderr)
        return diff.returncode

    untracked = run_git(["ls-files", "--others", "--exclude-standard", "--", *GENERATED_PATHS])
    if untracked.returncode != 0:
        sys.stderr.write(untracked.stderr)
        return untracked.returncode

    if diff.stdout or untracked.stdout.strip():
        if diff.stdout:
            sys.stderr.write(diff.stdout)
        if untracked.stdout.strip():
            sys.stderr.write("Untracked generated files:\n")
            sys.stderr.write(untracked.stdout)
        sys.stderr.write(
            "Generated API contract is out of date. Run `pnpm contract:generate` and commit.\n"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

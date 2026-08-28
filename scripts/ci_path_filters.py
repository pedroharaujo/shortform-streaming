"""Classify changed paths so application CI can skip expensive jobs.

This is an in-repo replacement for third-party path-filter Actions. Callers
pass a base/head SHA pair (pull-request base vs head, or push before vs SHA).
When the event cannot be classified, every expensive job is enabled so a
filter failure cannot skip verification.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZERO_SHA = "0" * 40

# Changing the application workflow or this classifier re-runs every expensive
# job so the path filter and job graph stay independently verifiable.
ALWAYS_RUN_APPLICATION_PATHS = (
    ".github/workflows/application-ci.yml",
    "scripts/ci_path_filters.py",
)

BACKEND_PATHS = (
    *ALWAYS_RUN_APPLICATION_PATHS,
    "backend/",
    "pyproject.toml",
    "uv.lock",
    "compose.yaml",
    "package.json",
    "Dockerfile",
    "backend/Dockerfile",
    ".dockerignore",
)

MOBILE_PATHS = (
    *ALWAYS_RUN_APPLICATION_PATHS,
    "mobile/",
    "packages/",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "package.json",
)

CONTAINER_PATHS = (
    *ALWAYS_RUN_APPLICATION_PATHS,
    "backend/",
    "pyproject.toml",
    "uv.lock",
    "compose.yaml",
    "Dockerfile",
    "backend/Dockerfile",
    ".dockerignore",
)

JOB_PATTERNS = {
    "backend": BACKEND_PATHS,
    "mobile": MOBILE_PATHS,
    "container": CONTAINER_PATHS,
}


def normalize(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def path_matches(changed: str, patterns: Sequence[str]) -> bool:
    relative = normalize(changed)
    for pattern in patterns:
        candidate = normalize(pattern)
        if candidate.endswith("/"):
            if relative == candidate[:-1] or relative.startswith(candidate):
                return True
        elif relative == candidate:
            return True
    return False


def classify(changed_paths: Iterable[str]) -> dict[str, bool]:
    paths = [normalize(path) for path in changed_paths if path.strip()]
    return {
        job: any(path_matches(path, patterns) for path in paths)
        for job, patterns in JOB_PATTERNS.items()
    }


def all_jobs_enabled() -> dict[str, bool]:
    return {job: True for job in JOB_PATTERNS}


def git_changed_files(base: str, head: str) -> list[str] | None:
    for args in (
        ["git", "diff", "--name-only", f"{base}...{head}"],
        ["git", "diff", "--name-only", base, head],
    ):
        result = subprocess.run(
            args,
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return [line.strip() for line in result.stdout.splitlines() if line.strip()]
        sys.stderr.write(result.stderr)
    return None


def format_github_output(selected: dict[str, bool]) -> str:
    return "".join(f"{job}={str(enabled).lower()}\n" for job, enabled in selected.items())


def resolve_selection(
    *,
    event_name: str,
    base_sha: str,
    head_sha: str,
    changed_paths: Sequence[str] | None,
) -> dict[str, bool]:
    if event_name == "workflow_dispatch":
        return all_jobs_enabled()
    if changed_paths is not None:
        return classify(changed_paths)
    if not base_sha or base_sha == ZERO_SHA or not head_sha:
        return all_jobs_enabled()
    files = git_changed_files(base_sha, head_sha)
    if files is None:
        sys.stderr.write(
            "Unable to list changed paths; enabling backend, mobile, and container jobs.\n"
        )
        return all_jobs_enabled()
    return classify(files)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--event-name",
        default=os.environ.get("GITHUB_EVENT_NAME", ""),
        help="GitHub event name (workflow_dispatch enables every job)",
    )
    parser.add_argument(
        "--base-sha",
        default=os.environ.get("CI_BASE_SHA", ""),
        help="Pull-request base SHA or push before SHA",
    )
    parser.add_argument(
        "--head-sha",
        default=os.environ.get("CI_HEAD_SHA", ""),
        help="Pull-request head SHA or push SHA",
    )
    parser.add_argument(
        "--files",
        nargs="*",
        default=None,
        help="Explicit changed paths (skips git). Pass with no values for an empty diff.",
    )
    args = parser.parse_args()
    selected = resolve_selection(
        event_name=args.event_name,
        base_sha=args.base_sha,
        head_sha=args.head_sha,
        changed_paths=args.files,
    )
    sys.stderr.write(
        "Path filter: "
        + ", ".join(f"{job}={'run' if enabled else 'skip'}" for job, enabled in selected.items())
        + "\n"
    )
    sys.stdout.write(format_github_output(selected))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

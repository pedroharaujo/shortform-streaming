"""Detect high-confidence credential patterns without printing secret values."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]


RULES = (
    Rule(
        "private-key",
        re.compile(
            r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"
        ),
    ),
    Rule("aws-access-key-id", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    Rule("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{36,255}\b")),
    Rule(
        "github-fine-grained-token",
        re.compile(r"\bgithub_pat_[A-Za-z0-9_]{70,255}\b"),
    ),
    Rule("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    Rule("stripe-live-key", re.compile(r"\b[rs]k_live_[0-9A-Za-z]{16,}\b")),
    Rule("slack-token", re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{20,}\b")),
    Rule("npm-token", re.compile(r"\bnpm_[0-9A-Za-z]{36,}\b")),
    Rule(
        "database-url-with-password",
        re.compile(
            r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://"
            r"[^\s:/@]+:[^\s/@]{8,}@"
        ),
    ),
    Rule(
        "assigned-secret",
        re.compile(
            r"(?i)\b(?:api[_-]?key|access[_-]?key|client[_-]?secret|password|"
            r"passwd|secret(?:[_-]?key)?|token)"
            r"\s*[:=]\s*[\"']?(?P<value>[0-9A-Za-z/+_.=-]{20,})"
        ),
    ),
)

PLACEHOLDER_MARKERS = (
    "changeme",
    "dummy",
    "example",
    "placeholder",
    "redacted",
    "replace",
    "sample",
)


@dataclass(frozen=True)
class Finding:
    path: Path
    line: int
    rule: str


def git_candidates() -> list[Path]:
    """Return tracked and non-ignored untracked files from the current repository."""
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / item for item in result.stdout.decode().split("\0") if item]


def expand_paths(paths: Iterable[Path]) -> list[Path]:
    expanded: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved.is_file() and not resolved.is_symlink():
            expanded.add(resolved)
        elif resolved.is_dir():
            expanded.update(
                candidate.resolve()
                for candidate in resolved.rglob("*")
                if candidate.is_file() and not candidate.is_symlink()
            )
        else:
            raise FileNotFoundError(f"scan path does not exist: {path}")
    return sorted(expanded)


def display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def is_placeholder(match: re.Match[str]) -> bool:
    value = match.groupdict().get("value")
    if value is None:
        return False
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def scan_file(path: Path) -> list[Finding]:
    try:
        data = path.read_bytes()
    except OSError as error:
        raise OSError(f"cannot read {display_path(path)}: {error}") from error

    if b"\x00" in data:
        return []

    text = data.decode("utf-8", errors="replace")
    findings: list[Finding] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for rule in RULES:
            for match in rule.pattern.finditer(line):
                if not is_placeholder(match):
                    findings.append(Finding(path, line_number, rule.name))
    return findings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan repository files for high-confidence credential patterns."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Optional files/directories. Defaults to tracked and non-ignored files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        candidates = expand_paths(args.paths) if args.paths else git_candidates()
        findings = [finding for path in candidates for finding in scan_file(path)]
    except (FileNotFoundError, OSError, subprocess.CalledProcessError) as error:
        print(f"Secret scan failed to run: {error}", file=sys.stderr)
        return 2

    if findings:
        print("Potential secrets detected; values are intentionally redacted:", file=sys.stderr)
        for finding in findings:
            print(
                f"- {display_path(finding.path)}:{finding.line} [{finding.rule}]",
                file=sys.stderr,
            )
        print(
            "Remove the credential, rotate it if it was usable, and rerun the scan.",
            file=sys.stderr,
        )
        return 1

    print(f"Secret scan passed ({len(candidates)} files checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Fail closed on secrets and prohibited delivery assets in files and new history."""

from __future__ import annotations

import argparse
import codecs
import os
import re
import stat
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAX_FILE_BYTES = 2 * 1024 * 1024
GIT_TIMEOUT_SECONDS = 30
ZERO_OBJECT_ID = re.compile(r"^0{40,64}$")
SAFE_REVISION = re.compile(r"^[0-9A-Za-z][0-9A-Za-z._/@{}^~:+-]*$")


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]


RULES = (
    Rule(
        "private-key",
        re.compile(
            r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----"
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

CANONICAL_PLACEHOLDERS = frozenset(
    {
        "canonical-placeholder-only",
        "changeme",
        "example-only",
        "redacted",
        "replace-me",
    }
)
# This exact public phrase existed in the first P1-T01 scanner regression commit.
# It is not a substring marker and cannot make an arbitrary assigned value safe.
SAFE_NON_SECRET_LITERALS = frozenset({"replace-with-provider-value"})
EXAMPLE_FILE_NAMES = frozenset({".env.example", "env.example"})

PRIVATE_PATH_PARTS = frozenset(
    {"contracts", "licensed-media", "media", "private", "provider-payloads", "sources"}
)
VIDEO_EXTENSIONS = frozenset({".avi", ".m3u8", ".mkv", ".mov", ".mp4", ".webm"})
AUDIO_EXTENSIONS = frozenset({".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"})
SUBTITLE_EXTENSIONS = frozenset({".ass", ".srt", ".ssa", ".ttml", ".vtt"})
POSTER_EXTENSIONS = frozenset({".avif", ".jpeg", ".jpg", ".png", ".webp"})
POSTER_MARKERS = ("artwork", "cover", "poster", "thumbnail")

# P1-T01 has no media fixtures. A later task may add only a narrowly documented,
# self-owned/generated fixture prefix here together with provenance and tests.
MEDIA_ALLOWLIST_PREFIXES: tuple[str, ...] = ()


@dataclass(frozen=True)
class Finding:
    label: str
    line: int
    rule: str


class ScanConfigurationError(RuntimeError):
    """Raised when a requested scan cannot be completed safely."""


def run_git(root: Path, arguments: list[str]) -> bytes:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *arguments],
            check=True,
            capture_output=True,
            timeout=GIT_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise ScanConfigurationError("required Git inspection failed") from error
    return result.stdout


def find_repository_root(candidate: Path) -> Path:
    lexical = Path(os.path.abspath(candidate))
    output = run_git(lexical, ["rev-parse", "--show-toplevel"])
    reported = Path(output.decode("utf-8", errors="strict").strip()).resolve()
    if not reported.is_dir():
        raise ScanConfigurationError("repository root is not an accessible directory")
    return reported


def lexical_path(root: Path, candidate: Path) -> Path:
    value = candidate if candidate.is_absolute() else root / candidate
    absolute = Path(os.path.abspath(value))
    try:
        common = os.path.commonpath((str(root), str(absolute)))
        if os.path.normcase(common) != os.path.normcase(str(root)):
            raise ScanConfigurationError("scan paths must remain inside the repository")
    except ValueError as error:
        raise ScanConfigurationError("scan paths must remain inside the repository") from error
    return absolute


def relative_label(root: Path, path: Path) -> str:
    return Path(os.path.relpath(path, root)).as_posix()


def walk_without_following_links(root: Path, start: Path) -> list[Path]:
    candidates: list[Path] = []
    stack = [start]
    while stack:
        current = stack.pop()
        try:
            metadata = current.lstat()
        except OSError as error:
            raise ScanConfigurationError(
                f"cannot inspect repository path {relative_label(root, current)}"
            ) from error

        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            candidates.append(current)
            continue

        try:
            children = sorted(current.iterdir(), key=lambda path: path.name, reverse=True)
        except OSError as error:
            raise ScanConfigurationError(
                f"cannot enumerate repository path {relative_label(root, current)}"
            ) from error
        stack.extend(lexical_path(root, child) for child in children)
    return candidates


def first_symlink_component(root: Path, path: Path) -> Path | None:
    relative = Path(os.path.relpath(path, root))
    current = root
    for part in relative.parts:
        current = current / part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                return current
        except FileNotFoundError:
            return None
        except OSError as error:
            raise ScanConfigurationError(
                f"cannot inspect repository path {relative_label(root, current)}"
            ) from error
    return None


def expand_paths(root: Path, paths: Iterable[Path]) -> list[Path]:
    expanded: set[Path] = set()
    for path in paths:
        candidate = lexical_path(root, path)
        symlink = first_symlink_component(root, candidate)
        if symlink is not None:
            expanded.add(symlink)
            continue
        if not os.path.lexists(candidate):
            raise ScanConfigurationError(
                f"scan path does not exist: {relative_label(root, candidate)}"
            )
        expanded.update(walk_without_following_links(root, candidate))
    return sorted(expanded)


def git_candidates(root: Path) -> list[Path]:
    output = run_git(
        root,
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    )
    candidates: set[Path] = set()
    for item in output.decode("utf-8", errors="surrogateescape").split("\0"):
        if not item:
            continue
        path = lexical_path(root, Path(item))
        if os.path.lexists(path):
            candidates.add(path)
    return sorted(candidates)


def is_example_file(label: str) -> bool:
    name = PurePosixPath(label).name.casefold()
    return name in EXAMPLE_FILE_NAMES or name.endswith(".example")


def is_placeholder(match: re.Match[str], label: str) -> bool:
    value = match.groupdict().get("value")
    if not value:
        return False
    normalized = value.casefold()
    if normalized in SAFE_NON_SECRET_LITERALS:
        return True
    return is_example_file(label) and normalized in CANONICAL_PLACEHOLDERS


def is_media_allowlisted(label: str) -> bool:
    normalized = PurePosixPath(label).as_posix().casefold()
    return any(
        normalized == prefix or normalized.startswith(f"{prefix}/")
        for prefix in MEDIA_ALLOWLIST_PREFIXES
    )


def is_prohibited_media(label: str) -> bool:
    if is_media_allowlisted(label):
        return False
    path = PurePosixPath(label)
    parts = tuple(part.casefold() for part in path.parts)
    suffix = path.suffix.casefold()
    stem = path.stem.casefold()

    if any(part in PRIVATE_PATH_PARTS for part in parts):
        return True
    if suffix in VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | SUBTITLE_EXTENSIONS:
        return True
    if suffix == ".ts" and any(part in PRIVATE_PATH_PARTS for part in parts):
        return True
    return suffix in POSTER_EXTENSIONS and any(marker in stem for marker in POSTER_MARKERS)


def decode_text(data: bytes) -> str | None:
    try:
        if data.startswith(codecs.BOM_UTF16_LE):
            text = data[len(codecs.BOM_UTF16_LE) :].decode("utf-16-le", errors="strict")
        elif data.startswith(codecs.BOM_UTF16_BE):
            text = data[len(codecs.BOM_UTF16_BE) :].decode("utf-16-be", errors="strict")
        elif data.startswith(codecs.BOM_UTF8):
            text = data.decode("utf-8-sig", errors="strict")
        else:
            text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return None

    forbidden_controls = {chr(value) for value in range(32)} - {"\t", "\n", "\r"}
    if any(character in text for character in forbidden_controls) or "\x7f" in text:
        return None
    return text


def scan_bytes(data: bytes, label: str) -> list[Finding]:
    if len(data) > MAX_FILE_BYTES:
        return [Finding(label, 0, "oversized-file")]
    text = decode_text(data)
    if text is None:
        return [Finding(label, 0, "binary-or-unsupported-encoding")]

    findings: list[Finding] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for rule in RULES:
            for match in rule.pattern.finditer(line):
                if not is_placeholder(match, label):
                    findings.append(Finding(label, line_number, rule.name))
    return findings


def scan_path(root: Path, path: Path) -> list[Finding]:
    label = relative_label(root, path)
    try:
        metadata = path.lstat()
    except OSError as error:
        raise ScanConfigurationError(f"cannot inspect repository path {label}") from error

    if stat.S_ISLNK(metadata.st_mode):
        return [Finding(label, 0, "symlink")]
    if not stat.S_ISREG(metadata.st_mode):
        return [Finding(label, 0, "unsupported-file-type")]
    if is_prohibited_media(label):
        return [Finding(label, 0, "prohibited-media")]
    if metadata.st_size > MAX_FILE_BYTES:
        return [Finding(label, 0, "oversized-file")]

    try:
        with path.open("rb") as handle:
            data = handle.read(MAX_FILE_BYTES + 1)
    except OSError as error:
        raise ScanConfigurationError(f"cannot read repository path {label}") from error
    return scan_bytes(data, label)


def validate_revision(value: str, name: str) -> str:
    if not value or "..." in value or not SAFE_REVISION.fullmatch(value):
        raise ScanConfigurationError(f"invalid {name} revision")
    return value


def resolve_commit(root: Path, revision: str, name: str) -> str:
    validate_revision(revision, name)
    output = run_git(root, ["rev-parse", "--verify", f"{revision}^{{commit}}"])
    return output.decode("ascii", errors="strict").strip()


def parse_history_range(root: Path, value: str) -> tuple[str | None, str]:
    if "..." in value or value.count("..") != 1:
        raise ScanConfigurationError("history range must use BASE..HEAD")
    base_revision, head_revision = value.split("..", maxsplit=1)
    head = resolve_commit(root, head_revision, "head")
    base = None
    if not ZERO_OBJECT_ID.fullmatch(base_revision):
        base = resolve_commit(root, base_revision, "base")

    shallow = run_git(root, ["rev-parse", "--is-shallow-repository"])
    if shallow.decode("ascii", errors="strict").strip() == "true":
        raise ScanConfigurationError(
            "history scanning requires a complete, non-shallow checkout"
        )
    return base, head


def introduced_commits(root: Path, history_range: str) -> list[str]:
    base, head = parse_history_range(root, history_range)
    revision = head if base is None else f"{base}..{head}"
    output = run_git(root, ["rev-list", "--reverse", revision, "--"])
    return [line for line in output.decode("ascii").splitlines() if line]


def changed_paths(root: Path, commit: str) -> list[str]:
    output = run_git(
        root,
        [
            "diff-tree",
            "--root",
            "-m",
            "--no-commit-id",
            "--name-only",
            "--no-renames",
            "-r",
            "-z",
            commit,
            "--",
        ],
    )
    return sorted(
        {
            path
            for path in output.decode("utf-8", errors="surrogateescape").split("\0")
            if path
        }
    )


def tree_entry(root: Path, commit: str, path: str) -> tuple[str, str] | None:
    output = run_git(root, ["ls-tree", "-z", commit, "--", path])
    if not output:
        return None
    header, separator, _ = output.partition(b"\t")
    if not separator:
        raise ScanConfigurationError("Git returned an invalid tree entry")
    fields = header.decode("ascii", errors="strict").split()
    if len(fields) != 3:
        raise ScanConfigurationError("Git returned an invalid tree entry")
    mode, object_type, object_id = fields
    if object_type != "blob":
        return mode, ""
    return mode, object_id


def scan_history(root: Path, history_range: str) -> tuple[list[Finding], int]:
    findings: list[Finding] = []
    blob_count = 0
    for commit in introduced_commits(root, history_range):
        for path in changed_paths(root, commit):
            entry = tree_entry(root, commit, path)
            if entry is None:
                continue
            mode, object_id = entry
            label = f"history:{commit[:12]}:{PurePosixPath(path).as_posix()}"
            if mode == "120000":
                findings.append(Finding(label, 0, "symlink"))
                continue
            if not object_id or not mode.startswith("100"):
                findings.append(Finding(label, 0, "unsupported-file-type"))
                continue
            if is_prohibited_media(path):
                findings.append(Finding(label, 0, "prohibited-media"))
                continue

            size_output = run_git(root, ["cat-file", "-s", object_id])
            try:
                size = int(size_output.decode("ascii").strip())
            except ValueError as error:
                raise ScanConfigurationError("Git returned an invalid blob size") from error
            if size > MAX_FILE_BYTES:
                findings.append(Finding(label, 0, "oversized-file"))
                continue

            data = run_git(root, ["cat-file", "blob", object_id])
            if len(data) != size:
                raise ScanConfigurationError("Git returned an incomplete blob")
            findings.extend(scan_bytes(data, label))
            blob_count += 1
    return findings, blob_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Scan repository files and an optional BASE..HEAD history range for "
            "credentials and prohibited delivery assets."
        )
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Optional in-repository files/directories; defaults to Git candidates.",
    )
    parser.add_argument(
        "--repository",
        type=Path,
        default=PROJECT_ROOT,
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--history-range",
        help="Scan blobs introduced by BASE..HEAD in addition to the current tree.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    history_range = args.history_range or os.environ.get("SECRET_SCAN_HISTORY_RANGE")
    try:
        root = find_repository_root(args.repository)
        candidates = expand_paths(root, args.paths) if args.paths else git_candidates(root)
        findings = [finding for path in candidates for finding in scan_path(root, path)]
        history_blob_count = 0
        if history_range:
            history_findings, history_blob_count = scan_history(root, history_range)
            findings.extend(history_findings)
    except (ScanConfigurationError, UnicodeError) as error:
        print(f"Secret scan failed closed: {error}", file=sys.stderr)
        return 2

    if findings:
        print("Repository safety violations detected; values are redacted:", file=sys.stderr)
        for finding in findings:
            location = f"{finding.label}:{finding.line}" if finding.line else finding.label
            print(f"- {location} [{finding.rule}]", file=sys.stderr)
        print(
            "Remove the unsafe material, rotate it if it was usable, and rerun the scan.",
            file=sys.stderr,
        )
        return 1

    history_summary = (
        f"; {history_blob_count} introduced history blobs checked"
        if history_range
        else ""
    )
    print(
        f"Repository safety scan passed ({len(candidates)} current files checked"
        f"{history_summary})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

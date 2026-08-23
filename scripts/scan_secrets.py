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
            r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?"
            r"PRIVATE KEY(?: BLOCK)?-----"
        ),
    ),
    Rule("aws-access-key-id", re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}")),
    Rule("github-token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,255}")),
    Rule(
        "github-fine-grained-token",
        re.compile(r"github_pat_[A-Za-z0-9_]{70,255}"),
    ),
    Rule("google-api-key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
    Rule("stripe-live-key", re.compile(r"[rs]k_live_[0-9A-Za-z]{16,}")),
    Rule("slack-token", re.compile(r"xox[baprs]-[0-9A-Za-z-]{20,}")),
    Rule("npm-token", re.compile(r"npm_[0-9A-Za-z]{36,}")),
    Rule(
        "database-url-with-password",
        re.compile(
            r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://"
            r"[^\s:/@]+:[^\s/@]{8,}@"
        ),
    ),
)

SENSITIVE_KEY_COMPONENTS = frozenset({"password", "passwd", "pwd", "secret", "token"})
SENSITIVE_KEY_PHRASES = (
    ("api", "key"),
    ("access", "key"),
    ("private", "key"),
    ("signing", "key"),
    ("service", "role", "key"),
)
NON_SECRET_REFERENCE_COMPONENTS = frozenset({"id", "identifier", "name", "type"})
ASSIGNMENT_PREFIX = re.compile(
    r"(?i)(?<![A-Za-z0-9_-])"
    r"(?:\"(?P<double_key>[A-Za-z][A-Za-z0-9_-]*)\"|"
    r"'(?P<single_key>[A-Za-z][A-Za-z0-9_-]*)'|"
    r"(?P<bare_key>[A-Za-z][A-Za-z0-9_-]*))"
    r"\s*[:=/]\s*"
)
MIN_QUOTED_SECRET_LENGTH = 8
MIN_BARE_SECRET_LENGTH = 20
BARE_VALUE_DELIMITERS = frozenset(" \t\r\n#;,}])\"'\\")

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

PRIVATE_ROOT_DIRECTORIES = frozenset(
    {
        "contracts",
        "credentials",
        "licensed-media",
        "media",
        "private",
        "provider-payloads",
        "secrets",
        "sources",
    }
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


@dataclass(frozen=True)
class PathIdentity:
    raw: str
    label: str
    contains_secret: bool


@dataclass(frozen=True)
class HistoryEntry:
    mode: str
    object_id: str
    path: bytes


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


def sanitize_path_text(value: str) -> str:
    return "".join(
        character
        if character >= " " and character != "\x7f"
        else f"\\x{ord(character):02x}"
        for character in value
    )


def path_identity(value: str) -> PathIdentity:
    if text_contains_secret(value):
        return PathIdentity(value, "<redacted-path>", True)
    return PathIdentity(value, sanitize_path_text(value), False)


def raw_relative_label(root: Path, path: Path) -> str:
    return Path(os.path.relpath(path, root)).as_posix()


def relative_label(root: Path, path: Path) -> str:
    return path_identity(raw_relative_label(root, path)).label


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


def is_placeholder_value(value: str, label: str) -> bool:
    normalized = value.casefold()
    if normalized in SAFE_NON_SECRET_LITERALS:
        return True
    return is_example_file(label) and normalized in CANONICAL_PLACEHOLDERS


def assignment_key_components(match: re.Match[str]) -> tuple[str, ...]:
    key = (
        match.group("double_key")
        or match.group("single_key")
        or match.group("bare_key")
    )
    separated = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", "_", key)
    separated = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", separated)
    return tuple(
        component.casefold()
        for component in re.split(r"[_-]+", separated)
        if component
    )


def is_sensitive_assignment_key(match: re.Match[str]) -> bool:
    components = assignment_key_components(match)
    for index, component in enumerate(components):
        followed_by_reference = (
            index + 1 < len(components)
            and components[index + 1] in NON_SECRET_REFERENCE_COMPONENTS
        )
        if component in SENSITIVE_KEY_COMPONENTS and not followed_by_reference:
            return True

    for phrase in SENSITIVE_KEY_PHRASES:
        for start in range(len(components) - len(phrase) + 1):
            end = start + len(phrase)
            followed_by_reference = (
                end < len(components)
                and components[end] in NON_SECRET_REFERENCE_COMPONENTS
            )
            if components[start:end] == phrase and not followed_by_reference:
                return True
    return False


def parse_quoted_value(line: str, start: int, quote: str) -> tuple[str, int] | None:
    escaped = False
    for index in range(start + 1, len(line)):
        character = line[index]
        if escaped:
            escaped = False
            continue
        if character == "\\":
            escaped = True
            continue
        if character == quote:
            return line[start + 1 : index], index + 1
    return None


def parse_bare_value(line: str, start: int) -> tuple[str, int] | None:
    end = start
    while end < len(line):
        if line[end] in BARE_VALUE_DELIMITERS or line.startswith("//", end):
            break
        end += 1
    if end == start:
        return None
    return line[start:end], end


def assigned_secret_values(line: str) -> list[str]:
    values: list[str] = []
    for match in ASSIGNMENT_PREFIX.finditer(line):
        if not is_sensitive_assignment_key(match):
            continue
        start = match.end()
        if start >= len(line):
            continue
        if line[start] in {"\"", "'"}:
            parsed = parse_quoted_value(line, start, line[start])
            minimum = MIN_QUOTED_SECRET_LENGTH
        else:
            parsed = parse_bare_value(line, start)
            minimum = MIN_BARE_SECRET_LENGTH
        if parsed is not None and len(parsed[0]) >= minimum:
            values.append(parsed[0])
    return values


def text_contains_secret(text: str) -> bool:
    if any(rule.pattern.search(text) for rule in RULES):
        return True
    return any(
        not is_placeholder_value(value, "<path>")
        for value in assigned_secret_values(text)
    )


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

    if parts and parts[0] in PRIVATE_ROOT_DIRECTORIES:
        return True
    if suffix in VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | SUBTITLE_EXTENSIONS:
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
            for _ in rule.pattern.finditer(line):
                findings.append(Finding(label, line_number, rule.name))
        for value in assigned_secret_values(line):
            if not is_placeholder_value(value, label):
                findings.append(Finding(label, line_number, "assigned-secret"))
    return findings


def scan_path(root: Path, path: Path) -> list[Finding]:
    identity = path_identity(raw_relative_label(root, path))
    label = identity.label
    if identity.contains_secret:
        return [Finding(label, 0, "secret-in-path")]
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


def changed_entries(root: Path, commit: str) -> list[HistoryEntry]:
    output = run_git(
        root,
        [
            "diff-tree",
            "--root",
            "-m",
            "--no-commit-id",
            "--raw",
            "--no-renames",
            "-r",
            "-z",
            commit,
            "--",
        ],
    )
    tokens = output.split(b"\0")
    if not tokens or tokens[-1] or len(tokens) % 2 != 1:
        raise ScanConfigurationError("Git returned invalid raw history data")

    entries: set[HistoryEntry] = set()
    for index in range(0, len(tokens) - 1, 2):
        metadata = tokens[index]
        path = tokens[index + 1]
        if not metadata.startswith(b":") or not path:
            raise ScanConfigurationError("Git returned invalid raw history data")
        fields = metadata[1:].split()
        if len(fields) != 5:
            raise ScanConfigurationError("Git returned invalid raw history metadata")
        _, new_mode, _, new_object_id, status_value = fields
        if status_value[:1] in {b"C", b"R"}:
            raise ScanConfigurationError("Git unexpectedly enabled rename path parsing")
        if new_mode == b"000000" and ZERO_OBJECT_ID.fullmatch(
            new_object_id.decode("ascii", errors="strict")
        ):
            continue
        if not re.fullmatch(rb"[0-9a-f]{40,64}", new_object_id):
            raise ScanConfigurationError("Git returned an invalid history object ID")
        entries.add(
            HistoryEntry(
                new_mode.decode("ascii", errors="strict"),
                new_object_id.decode("ascii", errors="strict"),
                path,
            )
        )
    return sorted(entries, key=lambda entry: (entry.path, entry.object_id, entry.mode))


def history_path_identity(path: bytes) -> PathIdentity:
    decoded = path.decode("utf-8", errors="backslashreplace")
    return path_identity(decoded)


def scan_history(root: Path, history_range: str) -> tuple[list[Finding], int]:
    findings: list[Finding] = []
    blob_count = 0
    for commit in introduced_commits(root, history_range):
        for entry in changed_entries(root, commit):
            identity = history_path_identity(entry.path)
            label = f"history:{commit[:12]}:{PurePosixPath(identity.label).as_posix()}"
            if identity.contains_secret:
                if entry.mode.startswith("100"):
                    blob_count += 1
                findings.append(Finding(label, 0, "secret-in-path"))
                continue
            if entry.mode == "120000":
                findings.append(Finding(label, 0, "symlink"))
                continue
            if not entry.mode.startswith("100"):
                findings.append(Finding(label, 0, "unsupported-file-type"))
                continue
            blob_count += 1
            if is_prohibited_media(identity.raw):
                findings.append(Finding(label, 0, "prohibited-media"))
                continue

            size_output = run_git(root, ["cat-file", "-s", entry.object_id])
            try:
                size = int(size_output.decode("ascii").strip())
            except ValueError as error:
                raise ScanConfigurationError("Git returned an invalid blob size") from error
            if size > MAX_FILE_BYTES:
                findings.append(Finding(label, 0, "oversized-file"))
                continue

            data = run_git(root, ["cat-file", "blob", entry.object_id])
            if len(data) != size:
                raise ScanConfigurationError("Git returned an incomplete blob")
            findings.extend(scan_bytes(data, label))
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
        print(
            f"Scan evaluated {len(candidates)} current files and "
            f"{history_blob_count} introduced history blobs.",
            file=sys.stderr,
        )
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

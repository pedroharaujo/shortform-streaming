from __future__ import annotations

import codecs
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[2]
SCANNER = ROOT / "scripts" / "scan_secrets.py"
TEMP_PARENT = ROOT / ".tmp" / "repository-safety-tests"
MAX_FILE_BYTES = 2 * 1024 * 1024
ZERO_OBJECT_ID = "0" * 40


def run_command(
    repository: Path,
    *arguments: str,
    environment: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(arguments),
        cwd=repository,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
        env=environment,
    )


def git(repository: Path, *arguments: str) -> str:
    result = run_command(repository, "git", *arguments)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


@contextmanager
def temporary_repository() -> Iterator[tuple[Path, Path]]:
    TEMP_PARENT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=TEMP_PARENT) as directory:
        container = Path(directory)
        repository = container / "repo"
        repository.mkdir()
        git(repository, "init", "--quiet")
        git(repository, "config", "user.name", "Repository Safety Test")
        git(repository, "config", "user.email", "repository-safety@example.invalid")
        yield container, repository


class SecretScannerIntegrationTests(unittest.TestCase):
    def run_scanner(
        self, repository: Path, *arguments: str
    ) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        environment.pop("SECRET_SCAN_HISTORY_RANGE", None)
        return run_command(
            repository,
            sys.executable,
            str(SCANNER),
            "--repository",
            str(repository),
            *arguments,
            environment=environment,
        )

    def assert_redacted(
        self, result: subprocess.CompletedProcess[str], generated_value: str
    ) -> None:
        self.assertNotIn(generated_value, result.stdout)
        self.assertNotIn(generated_value, result.stderr)

    def test_canonical_placeholder_is_allowed_only_in_example_file(self) -> None:
        with temporary_repository() as (_, repository):
            placeholder = "canonical-" + "placeholder-only"
            fixture = repository / ".env.example"
            fixture.write_text(f"API_KEY={placeholder}\n", encoding="utf-8")

            allowed = self.run_scanner(repository, ".env.example")
            fixture.rename(repository / "runtime.env")
            rejected = self.run_scanner(repository, "runtime.env")

        self.assertEqual(allowed.returncode, 0, allowed.stderr)
        self.assertEqual(rejected.returncode, 1)
        self.assertIn("assigned-secret", rejected.stderr)
        self.assert_redacted(rejected, placeholder)

    def test_placeholder_substring_does_not_bypass_detection(self) -> None:
        with temporary_repository() as (_, repository):
            generated_value = ("a" * 12) + "example" + ("b" * 12)
            fixture = repository / ".env.example"
            fixture.write_text(f"TOKEN={generated_value}\n", encoding="utf-8")

            result = self.run_scanner(repository, ".env.example")

        self.assertEqual(result.returncode, 1)
        self.assertIn("assigned-secret", result.stderr)
        self.assert_redacted(result, generated_value)

    def test_generated_secret_pattern_is_blocked_and_redacted(self) -> None:
        with temporary_repository() as (_, repository):
            generated_pattern = "gh" + "p_" + ("a" * 36)
            fixture = repository / "unsafe.txt"
            fixture.write_text(generated_pattern, encoding="utf-8")

            result = self.run_scanner(repository, "unsafe.txt")

        self.assertEqual(result.returncode, 1)
        self.assertIn("github-token", result.stderr)
        self.assert_redacted(result, generated_pattern)

    def test_utf16_little_and_big_endian_are_decoded_and_scanned(self) -> None:
        for byte_order, bom in (
            ("utf-16-le", codecs.BOM_UTF16_LE),
            ("utf-16-be", codecs.BOM_UTF16_BE),
        ):
            with self.subTest(byte_order=byte_order), temporary_repository() as (
                _,
                repository,
            ):
                generated_pattern = "gh" + "p_" + ("b" * 36)
                fixture = repository / "encoded.txt"
                fixture.write_bytes(bom + generated_pattern.encode(byte_order))

                result = self.run_scanner(repository, "encoded.txt")

                self.assertEqual(result.returncode, 1)
                self.assertIn("github-token", result.stderr)
                self.assert_redacted(result, generated_pattern)

    def test_nul_and_binary_content_fail_closed(self) -> None:
        fixtures = {
            "nul.dat": b"text-before\x00text-after",
            "binary.dat": bytes((0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)),
        }
        for name, content in fixtures.items():
            with self.subTest(name=name), temporary_repository() as (_, repository):
                (repository / name).write_bytes(content)

                result = self.run_scanner(repository, name)

                self.assertEqual(result.returncode, 1)
                self.assertIn("binary-or-unsupported-encoding", result.stderr)

    def test_oversized_file_fails_closed_without_reading_it_all(self) -> None:
        with temporary_repository() as (_, repository):
            fixture = repository / "large.txt"
            with fixture.open("wb") as handle:
                handle.seek(MAX_FILE_BYTES)
                handle.write(b"x")

            result = self.run_scanner(repository, "large.txt")

        self.assertEqual(result.returncode, 1)
        self.assertIn("oversized-file", result.stderr)

    def test_file_symlink_is_rejected_without_disclosing_target(self) -> None:
        with temporary_repository() as (container, repository):
            external = container / "external-target.txt"
            external.write_text("outside", encoding="utf-8")
            link = repository / "file-link"
            try:
                os.symlink(external, link)
            except (NotImplementedError, OSError) as error:
                self.skipTest(f"file symlinks are unavailable: {error}")
            git(repository, "add", "file-link")

            result = self.run_scanner(repository)

        self.assertEqual(result.returncode, 1)
        self.assertIn("file-link [symlink]", result.stderr)
        self.assertNotIn(external.name, result.stderr)

    def test_directory_symlink_is_rejected_without_following_it(self) -> None:
        with temporary_repository() as (container, repository):
            external = container / "external-directory"
            external.mkdir()
            (external / "outside.txt").write_text("outside", encoding="utf-8")
            link = repository / "directory-link"
            try:
                os.symlink(external, link, target_is_directory=True)
            except (NotImplementedError, OSError) as error:
                self.skipTest(f"directory symlinks are unavailable: {error}")
            git(repository, "add", "directory-link")

            result = self.run_scanner(repository)
            nested_result = self.run_scanner(
                repository, "directory-link/outside.txt"
            )

        for scan_result in (result, nested_result):
            self.assertEqual(scan_result.returncode, 1)
            self.assertIn("directory-link [symlink]", scan_result.stderr)
            self.assertNotIn(external.name, scan_result.stderr)

    def test_removed_secret_in_introduced_history_is_still_blocked(self) -> None:
        with temporary_repository() as (_, repository):
            (repository / "safe.txt").write_text("safe\n", encoding="utf-8")
            git(repository, "add", "safe.txt")
            git(repository, "commit", "--quiet", "-m", "base")
            base = git(repository, "rev-parse", "HEAD")

            generated_pattern = "gh" + "p_" + ("c" * 36)
            leak = repository / "temporary.txt"
            leak.write_text(generated_pattern, encoding="utf-8")
            git(repository, "add", "temporary.txt")
            git(repository, "commit", "--quiet", "-m", "introduce fixture")
            leak.unlink()
            git(repository, "add", "--update")
            git(repository, "commit", "--quiet", "-m", "remove fixture")
            head = git(repository, "rev-parse", "HEAD")

            result = self.run_scanner(
                repository, "--history-range", f"{base}..{head}"
            )
            initial_branch = self.run_scanner(
                repository, "--history-range", f"{ZERO_OBJECT_ID}..{head}"
            )

        for scan_result in (result, initial_branch):
            self.assertEqual(scan_result.returncode, 1)
            self.assertIn("history:", scan_result.stderr)
            self.assertIn("github-token", scan_result.stderr)
            self.assert_redacted(scan_result, generated_pattern)

    def test_shallow_history_scan_fails_closed(self) -> None:
        with temporary_repository() as (container, repository):
            (repository / "safe.txt").write_text("safe\n", encoding="utf-8")
            git(repository, "add", "safe.txt")
            git(repository, "commit", "--quiet", "-m", "base")
            shallow = container / "shallow"
            clone = run_command(
                container,
                "git",
                "clone",
                "--quiet",
                "--depth",
                "1",
                repository.as_uri(),
                str(shallow),
            )
            self.assertEqual(clone.returncode, 0, clone.stderr)

            result = self.run_scanner(
                shallow, "--history-range", f"{ZERO_OBJECT_ID}..HEAD"
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn("non-shallow checkout", result.stderr)

    def test_forced_prohibited_media_is_rejected_case_insensitively(self) -> None:
        with temporary_repository() as (_, repository):
            shutil.copyfile(ROOT / ".gitignore", repository / ".gitignore")
            fixtures = (
                "episode.MP4",
                "trailer.WEBM",
                "audio.WAV",
                "subtitles.SRT",
                "launch-poster.JPG",
                "media/segment.TS",
            )
            for relative_path in fixtures:
                fixture = repository / relative_path
                fixture.parent.mkdir(parents=True, exist_ok=True)
                fixture.write_bytes(b"generated test bytes")
            git(repository, "add", ".gitignore")
            git(repository, "add", "--force", *fixtures)

            result = self.run_scanner(repository)

        self.assertEqual(result.returncode, 1)
        self.assertGreaterEqual(result.stderr.count("[prohibited-media]"), len(fixtures))


if __name__ == "__main__":
    unittest.main()

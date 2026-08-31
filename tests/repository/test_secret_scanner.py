from __future__ import annotations

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

    def test_compose_local_dummy_secret_literal_is_allowed(self) -> None:
        with temporary_repository() as (_, repository):
            dummy = "local-compose-not-a-production-secret"
            fixture = repository / "compose.yaml"
            fixture.write_text(f"DJANGO_SECRET_KEY: {dummy}\n", encoding="utf-8")

            allowed = self.run_scanner(repository, "compose.yaml")
            other = repository / "runtime.env"
            generated_value = "not" + "-the-compose-dummy-" + ("x" * 12)
            assignment_key = "DJANGO_" + "SECRET_" + "KEY"
            other.write_text(assignment_key + "=" + generated_value + "\n", encoding="utf-8")
            rejected = self.run_scanner(repository, "runtime.env")

        self.assertEqual(allowed.returncode, 0, allowed.stderr)
        self.assertEqual(rejected.returncode, 1)
        self.assertIn("assigned-secret", rejected.stderr)
        self.assert_redacted(rejected, generated_value)

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

    def test_rotation_inventory_patterns_are_blocked_without_echoing_values(self) -> None:
        # Synthetic fragments only: no usable provider keys or database accounts.
        generated_value = "synthetic-" + ("x" * 32)
        fixtures = (
            ("runtime.env", "DJANGO_SECRET_" + "KEY=" + generated_value, "assigned-secret"),
            ("Dockerfile", "ENV BUNNY_STREAM_API_" + "KEY=" + generated_value, "assigned-secret"),
            (
                "app.config.json",
                '{"BUNNY_STREAM_TOKEN_' + 'KEY":"' + generated_value + '"}',
                "assigned-secret",
            ),
            (
                "diagnostic.log",
                "postgresql://synthetic:" + generated_value + "@example.invalid/db",
                "database-url-with-password",
            ),
            ("provider.txt", "AI" + "za" + ("a" * 35), "google-api-key"),
            (
                "provider.json",
                '{"private_' + 'key":"-----BEGIN ' + 'PRIVATE KEY-----"}',
                "private-key",
            ),
        )
        for filename, content, rule in fixtures:
            with self.subTest(filename=filename), temporary_repository() as (_, repository):
                (repository / filename).write_text(content, encoding="utf-8")
                result = self.run_scanner(repository, filename)

            self.assertEqual(result.returncode, 1)
            self.assertIn(rule, result.stderr)
            self.assert_redacted(result, generated_value)
            self.assert_redacted(result, content)

    def test_prefixed_provider_tokens_in_current_paths_are_opaque(self) -> None:
        with temporary_repository() as (_, repository):
            prefixes = (("dash", "-"), ("underscore", "_"), ("alphanumeric", "A"))
            tokens: list[str] = []
            paths: list[Path] = []
            for prefix_index, (name, prefix) in enumerate(prefixes):
                for extension_index, extension in enumerate((".txt", ".MP4")):
                    character = chr(ord("k") + (prefix_index * 2) + extension_index)
                    token = "gh" + "p_" + (character * 36)
                    tokens.append(token)
                    paths.append(repository / f"{name}{prefix}{token}{extension}")
            for fixture in paths:
                fixture.write_text("safe content\n", encoding="utf-8")
            git(repository, "add", "--force", *(path.name for path in paths))

            result = self.run_scanner(repository)

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr.count("[secret-in-path]"), len(paths))
        self.assertNotIn("prohibited-media", result.stderr)
        self.assertEqual(result.stderr.count("<redacted-path>"), len(paths))
        self.assertNotIn("<redacted-path:", result.stderr)
        for token, path in zip(tokens, paths, strict=True):
            self.assert_redacted(result, token)
            self.assertNotIn(path.name, result.stdout)
            self.assertNotIn(path.name, result.stderr)

    def test_prefixed_provider_tokens_are_detected_in_current_and_history_content(
        self,
    ) -> None:
        with temporary_repository() as (_, repository):
            (repository / "safe.txt").write_text("safe\n", encoding="utf-8")
            git(repository, "add", "safe.txt")
            git(repository, "commit", "--quiet", "-m", "base")
            base = git(repository, "rev-parse", "HEAD")

            tokens = [
                "gh" + "p_" + (character * 36) for character in ("d", "e", "f")
            ]
            fixture = repository / "provider-content.txt"
            fixture.write_text(
                "\n".join(prefix + token for prefix, token in zip("-_C", tokens))
                + "\n",
                encoding="utf-8",
            )
            current = self.run_scanner(repository, fixture.name)
            git(repository, "add", fixture.name)
            git(repository, "commit", "--quiet", "-m", "introduce provider tokens")
            fixture.unlink()
            git(repository, "add", "--update")
            git(repository, "commit", "--quiet", "-m", "remove provider tokens")
            head = git(repository, "rev-parse", "HEAD")
            history = self.run_scanner(
                repository, "--history-range", f"{base}..{head}"
            )

        for result in (current, history):
            self.assertEqual(result.returncode, 1)
            self.assertEqual(result.stderr.count("[github-token]"), len(tokens))
            for token in tokens:
                self.assert_redacted(result, token)

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
            renamed_leak = repository / "renamed temporary file.txt"
            leak.rename(renamed_leak)
            git(repository, "add", "--all")
            git(repository, "commit", "--quiet", "-m", "rename fixture")
            renamed_leak.unlink()
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
                "credentials/opaque.bin",
                "secrets/opaque.bin",
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
        for relative_path in fixtures:
            self.assertIn(relative_path, result.stderr)


if __name__ == "__main__":
    unittest.main()

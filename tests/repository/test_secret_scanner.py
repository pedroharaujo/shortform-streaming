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


def git_bytes(
    repository: Path,
    *arguments: str,
    content: bytes | None = None,
) -> bytes:
    result = subprocess.run(
        ["git", *arguments],
        cwd=repository,
        input=content,
        check=False,
        capture_output=True,
        timeout=20,
    )
    if result.returncode:
        raise AssertionError(result.stderr.decode("utf-8", errors="replace"))
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

    def test_current_secret_paths_are_hashed_before_media_or_content_findings(self) -> None:
        with temporary_repository() as (_, repository):
            text_token = "gh" + "p_" + ("x" * 36)
            media_token = "gh" + "p_" + ("y" * 36)
            paths = (
                repository / f"note-{text_token}.txt",
                repository / f"{media_token}.MP4",
            )
            for fixture in paths:
                fixture.write_text("safe content\n", encoding="utf-8")
            git(repository, "add", "--force", *(path.name for path in paths))

            result = self.run_scanner(repository)
            repeated = self.run_scanner(repository)

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr, repeated.stderr)
        self.assertEqual(result.stderr.count("[secret-in-path]"), len(paths))
        self.assertNotIn("prohibited-media", result.stderr)
        self.assertIn("<redacted-path:", result.stderr)
        for token, path in zip((text_token, media_token), paths, strict=True):
            self.assert_redacted(result, token)
            self.assertNotIn(path.name, result.stdout)
            self.assertNotIn(path.name, result.stderr)

    def test_removed_history_secret_paths_are_hashed_and_redacted(self) -> None:
        with temporary_repository() as (_, repository):
            (repository / "safe.txt").write_text("safe\n", encoding="utf-8")
            git(repository, "add", "safe.txt")
            git(repository, "commit", "--quiet", "-m", "base")
            base = git(repository, "rev-parse", "HEAD")

            text_token = "gh" + "p_" + ("u" * 36)
            media_token = "gh" + "p_" + ("v" * 36)
            paths = (
                repository / f"note-{text_token}.txt",
                repository / f"{media_token}.MP4",
            )
            for fixture in paths:
                fixture.write_text("safe content\n", encoding="utf-8")
            git(repository, "add", "--force", *(path.name for path in paths))
            git(repository, "commit", "--quiet", "-m", "introduce unsafe paths")
            for fixture in paths:
                fixture.unlink()
            git(repository, "add", "--update")
            git(repository, "commit", "--quiet", "-m", "remove unsafe paths")
            head = git(repository, "rev-parse", "HEAD")

            result = self.run_scanner(
                repository, "--history-range", f"{base}..{head}"
            )

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr.count("[secret-in-path]"), len(paths))
        self.assertIn("2 introduced history blobs", result.stderr)
        self.assertNotIn("prohibited-media", result.stderr)
        self.assertIn("history:", result.stderr)
        for token, path in zip((text_token, media_token), paths, strict=True):
            self.assert_redacted(result, token)
            self.assertNotIn(path.name, result.stdout)
            self.assertNotIn(path.name, result.stderr)

    def test_missing_secret_path_error_is_sanitized(self) -> None:
        with temporary_repository() as (_, repository):
            generated_token = "gh" + "p_" + ("w" * 36)
            relative_path = f"missing-{generated_token}.txt"

            result = self.run_scanner(repository, relative_path)

        self.assertEqual(result.returncode, 2)
        self.assertIn("<redacted-path:", result.stderr)
        self.assertNotIn(relative_path, result.stdout)
        self.assertNotIn(relative_path, result.stderr)
        self.assert_redacted(result, generated_token)

    def test_encrypted_pkcs8_private_key_header_is_blocked_and_redacted(self) -> None:
        with temporary_repository() as (_, repository):
            generated_header = (
                "-----BEGIN " + "ENCRYPTED " + "PRIVATE KEY" + "-----"
            )
            fixture = repository / "encrypted-key.txt"
            fixture.write_text(generated_header, encoding="utf-8")

            result = self.run_scanner(repository, "encrypted-key.txt")

        self.assertEqual(result.returncode, 1)
        self.assertIn("private-key", result.stderr)
        self.assert_redacted(result, generated_header)

    def test_assignment_parser_covers_json_camelcase_quotes_escapes_and_bare(self) -> None:
        values = [
            punctuation + (chr(ord("m") + index) * 28)
            for index, punctuation in enumerate("!$:@!$:@")
        ]
        values[2] = values[2][:10] + "'" + values[2][10:]
        values[3] = values[3][:10] + '"' + values[3][10:]
        values[4] = values[4][:10] + "\\\"" + values[4][10:]
        keys = (
            "pass" + "word",
            "client" + "Secret",
            "api" + "Key",
            "access" + "_key",
            "to" + "ken",
            "secret" + "-key",
            "api" + "_key",
            "tok" + "en",
        )
        lines = (
            f'{{"{keys[0]}": "{values[0]}"}}',
            f'{keys[1]}="{values[1]}"',
            f'{keys[2]}="{values[2]}"',
            f"{keys[3]}='{values[3]}'",
            f'{keys[4]}="{values[4]}"',
            f"{keys[5]}={values[5]} # comment",
            f"{keys[6]}:{values[6]}; trailing",
            f"{keys[7]}/{values[7]} ",
        )
        with temporary_repository() as (_, repository):
            fixture = repository / "assigned.txt"
            fixture.write_text("\n".join(lines) + "\n", encoding="utf-8")

            result = self.run_scanner(repository, "assigned.txt")

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr.count("[assigned-secret]"), len(lines))
        for generated_value in values:
            self.assert_redacted(result, generated_value)

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

    def test_history_paths_are_literal_bytes_not_git_pathspecs(self) -> None:
        magic_paths = (
            b":(literal)credential.txt",
            b":(glob)match-*.txt",
            b":(exclude)match-one.txt",
            b":!match-two.txt",
            b"meta[ab]*?.txt",
            b"path with spaces.txt",
            b"match-one.txt",
            b"match-two.txt",
        )
        with temporary_repository() as (_, repository):
            (repository / "safe.txt").write_text("safe\n", encoding="utf-8")
            git(repository, "add", "safe.txt")
            git(repository, "commit", "--quiet", "-m", "base")
            base = git(repository, "rev-parse", "HEAD")
            base_tree = git(repository, "rev-parse", "HEAD^{tree}")
            tree_records = git_bytes(repository, "ls-tree", "-z", base_tree)

            generated_values: list[str] = []
            for index, path in enumerate(magic_paths):
                generated_value = "gh" + "p_" + (chr(ord("d") + index) * 36)
                generated_values.append(generated_value)
                object_id = git_bytes(
                    repository,
                    "hash-object",
                    "-w",
                    "--stdin",
                    content=generated_value.encode("utf-8"),
                )
                tree_records += b"100644 blob " + object_id + b"\t" + path + b"\0"

            leak_tree = git_bytes(
                repository, "mktree", "-z", content=tree_records
            ).decode("ascii")
            leak_commit = git(
                repository,
                "commit-tree",
                leak_tree,
                "-p",
                base,
                "-m",
                "introduce magic paths",
            )
            head = git(
                repository,
                "commit-tree",
                base_tree,
                "-p",
                leak_commit,
                "-m",
                "remove magic paths",
            )
            git(repository, "update-ref", "HEAD", head)

            result = self.run_scanner(
                repository, "--history-range", f"{base}..{head}"
            )

        self.assertEqual(result.returncode, 1)
        self.assertIn(f"{len(magic_paths)} introduced history blobs", result.stderr)
        self.assertEqual(result.stderr.count("[github-token]"), len(magic_paths))
        for path in magic_paths:
            self.assertIn(path.decode("ascii"), result.stderr)
        for generated_value in generated_values:
            self.assert_redacted(result, generated_value)

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

    def test_nested_domain_directory_names_are_not_private_root_holding_dirs(self) -> None:
        with temporary_repository() as (_, repository):
            paths = (
                "backend/apps/media/models.py",
                "backend/apps/licensed-media/models.py",
                "backend/apps/contracts/models.py",
                "backend/apps/private/config.py",
                "backend/apps/sources/service.ts",
                "backend/apps/credentials/provider.py",
                "backend/apps/secrets/service.py",
            )
            for relative_path in paths:
                fixture = repository / relative_path
                fixture.parent.mkdir(parents=True, exist_ok=True)
                fixture.write_text("safe source\n", encoding="utf-8")

            result = self.run_scanner(repository)

        self.assertEqual(result.returncode, 0, result.stderr)

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

    def test_removed_forced_credentials_and_secrets_holdings_block_in_history(self) -> None:
        with temporary_repository() as (_, repository):
            shutil.copyfile(ROOT / ".gitignore", repository / ".gitignore")
            git(repository, "add", ".gitignore")
            git(repository, "commit", "--quiet", "-m", "base")
            base = git(repository, "rev-parse", "HEAD")
            paths = ("credentials/opaque.bin", "secrets/opaque.bin")
            for relative_path in paths:
                fixture = repository / relative_path
                fixture.parent.mkdir(parents=True, exist_ok=True)
                fixture.write_bytes(b"opaque\x00material")
            git(repository, "add", "--force", *paths)
            git(repository, "commit", "--quiet", "-m", "introduce holdings")
            for relative_path in paths:
                (repository / relative_path).unlink()
            git(repository, "add", "--update")
            git(repository, "commit", "--quiet", "-m", "remove holdings")
            head = git(repository, "rev-parse", "HEAD")

            result = self.run_scanner(
                repository, "--history-range", f"{base}..{head}"
            )

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr.count("[prohibited-media]"), len(paths))
        self.assertIn("2 introduced history blobs", result.stderr)
        self.assertNotIn("binary-or-unsupported-encoding", result.stderr)
        for relative_path in paths:
            self.assertIn(relative_path, result.stderr)


if __name__ == "__main__":
    unittest.main()

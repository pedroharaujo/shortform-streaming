from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_PATHS = (
    ".github/dependabot.yml",
    ".github/workflows/ai-governance.yml",
    ".github/workflows/repository-safety.yml",
    "backend/apps/README.md",
    "backend/config/README.md",
    "backend/tests/README.md",
    "mobile/app/README.md",
    "mobile/src/README.md",
    "packages/api-client/README.md",
    "infra/environments/README.md",
    "infra/modules/README.md",
    "docs/api/README.md",
    "docs/analytics/README.md",
    "docs/runbooks/repository-controls.md",
    "scripts/check_repository_foundation.py",
    "scripts/scan_secrets.py",
    "tests/repository/test_secret_scanner.py",
)

IGNORED_PRIVATE_PATHS = (
    ".env.production",
    "credentials/provider.json",
    "secrets/signing.txt",
    "sources/source-manifest.txt",
    "media/rendition.bin",
    "licensed-media/rights-manifest.txt",
    "contracts/licensor.pdf",
    "private/customer.csv",
    "provider-payloads/webhook.json",
    "sample.mp4",
    "episode.MP4",
    "trailer.WEBM",
    "audio.WAV",
    "captions.SRT",
    "launch-poster.JPG",
    "media/segment.TS",
    "signing-key.p8",
    "signing-key.P8",
    "signing-key.PEM",
    "signing-key.PFX",
    "signing-key.P12",
    "signing-key.KEY",
    "android-signing.JKS",
    "android-signing.KEYSTORE",
    "service-account-production.json",
)

TRACKABLE_NESTED_PATHS = (
    "backend/apps/media/models.py",
    "backend/apps/licensed-media/models.py",
    "backend/apps/contracts/models.py",
    "backend/apps/private/config.py",
    "backend/apps/sources/service.ts",
    "backend/apps/credentials/provider.py",
    "backend/apps/secrets/service.py",
)


class RepositoryFoundationTests(unittest.TestCase):
    def test_required_foundation_paths_exist(self) -> None:
        missing = [path for path in REQUIRED_PATHS if not (ROOT / path).is_file()]
        self.assertEqual(missing, [])

    def test_private_inputs_are_ignored(self) -> None:
        for relative_path in IGNORED_PRIVATE_PATHS:
            with self.subTest(path=relative_path):
                result = subprocess.run(
                    [
                        "git",
                        "-c",
                        "core.ignoreCase=false",
                        "check-ignore",
                        "--no-index",
                        "--quiet",
                        relative_path,
                    ],
                    cwd=ROOT,
                    check=False,
                )
                self.assertEqual(result.returncode, 0)

    def test_typescript_source_is_not_ignored_as_mpeg_ts_media(self) -> None:
        result = subprocess.run(
            ["git", "check-ignore", "--no-index", "--quiet", "mobile/src/example.ts"],
            cwd=ROOT,
            check=False,
        )
        self.assertEqual(result.returncode, 1)

    def test_nested_domain_directories_are_not_ignored(self) -> None:
        for relative_path in TRACKABLE_NESTED_PATHS:
            with self.subTest(path=relative_path):
                result = subprocess.run(
                    [
                        "git",
                        "-c",
                        "core.ignoreCase=false",
                        "check-ignore",
                        "--no-index",
                        "--quiet",
                        relative_path,
                    ],
                    cwd=ROOT,
                    check=False,
                )
                self.assertEqual(result.returncode, 1)

    def test_repository_workflows_are_pinned_and_least_privilege(self) -> None:
        workflows = {
            name: (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
            for name in ("ai-governance.yml", "repository-safety.yml", "api-contract.yml")
        }
        for name, workflow in workflows.items():
            for action in ("actions/checkout", "actions/setup-python"):
                with self.subTest(workflow=name, action=action):
                    self.assertRegex(
                        workflow,
                        rf"uses: {re.escape(action)}@[0-9a-f]{{40}} # v[0-9]",
                    )
            self.assertIn("permissions:\n  contents: read", workflow)
            self.assertIn("persist-credentials: false", workflow)
            self.assertIn("timeout-minutes: 10", workflow)

        contract = workflows["api-contract.yml"]
        for action in ("actions/setup-node", "astral-sh/setup-uv"):
            with self.subTest(workflow="api-contract.yml", action=action):
                self.assertRegex(
                    contract,
                    rf"uses: {re.escape(action)}@[0-9a-f]{{40}} # v[0-9]",
                )
        self.assertIn("uv sync --locked", contract)
        self.assertIn("pnpm install --frozen-lockfile", contract)
        self.assertIn("pnpm contract:check", contract)

        safety = workflows["repository-safety.yml"]
        self.assertIn("fetch-depth: 0", safety)
        self.assertIn("SECRET_SCAN_HISTORY_RANGE", safety)

    def test_bootstrap_command_is_documented(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("python scripts/check_repository_foundation.py", readme)
        self.assertIn("## Architecture and repository layout", readme)
        self.assertIn("## Common commands", readme)


if __name__ == "__main__":
    unittest.main()

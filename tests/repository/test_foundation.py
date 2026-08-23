from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_PATHS = (
    ".github/dependabot.yml",
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
    "service-account-production.json",
)


class RepositoryFoundationTests(unittest.TestCase):
    def test_required_foundation_paths_exist(self) -> None:
        missing = [path for path in REQUIRED_PATHS if not (ROOT / path).is_file()]
        self.assertEqual(missing, [])

    def test_private_inputs_are_ignored(self) -> None:
        for relative_path in IGNORED_PRIVATE_PATHS:
            with self.subTest(path=relative_path):
                result = subprocess.run(
                    ["git", "check-ignore", "--no-index", "--quiet", relative_path],
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

    def test_repository_workflow_is_pinned_and_fetches_history(self) -> None:
        workflow = (ROOT / ".github/workflows/repository-safety.yml").read_text(
            encoding="utf-8"
        )
        for action in ("actions/checkout", "actions/setup-python"):
            with self.subTest(action=action):
                self.assertRegex(
                    workflow,
                    rf"uses: {re.escape(action)}@[0-9a-f]{{40}} # v[0-9]",
                )
        self.assertIn("fetch-depth: 0", workflow)
        self.assertIn("timeout-minutes: 10", workflow)
        self.assertIn("SECRET_SCAN_HISTORY_RANGE", workflow)

    def test_bootstrap_command_is_documented(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("python scripts/check_repository_foundation.py", readme)
        self.assertIn("## Architecture and repository layout", readme)
        self.assertIn("## Common commands", readme)


if __name__ == "__main__":
    unittest.main()

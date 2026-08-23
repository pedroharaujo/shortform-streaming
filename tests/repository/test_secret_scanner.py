from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCANNER = ROOT / "scripts" / "scan_secrets.py"


class SecretScannerIntegrationTests(unittest.TestCase):
    def run_scanner(self, directory: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCANNER), str(directory)],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

    def test_placeholder_is_allowed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / ".env.example"
            fixture.write_text("API_KEY=replace-with-provider-value\n", encoding="utf-8")

            result = self.run_scanner(Path(directory))

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_generated_secret_pattern_is_blocked_and_redacted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "unsafe.txt"
            generated_pattern = "gh" + "p_" + ("a" * 36)
            fixture.write_text(generated_pattern, encoding="utf-8")

            result = self.run_scanner(Path(directory))

        self.assertEqual(result.returncode, 1)
        self.assertIn("github-token", result.stderr)
        self.assertNotIn(generated_pattern, result.stdout)
        self.assertNotIn(generated_pattern, result.stderr)


if __name__ == "__main__":
    unittest.main()

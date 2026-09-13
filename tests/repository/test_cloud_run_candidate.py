from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/resolve_cloud_run_candidate.py"
REVISION = "shortform-staging-00042-abc"
URL = "https://candidate---shortform-staging-example-uc.a.run.app"


class CloudRunCandidateTests(unittest.TestCase):
    def run_parser(self, payload: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT)],
            input=payload,
            text=True,
            capture_output=True,
            check=False,
        )

    def assert_rejected(self, service: object) -> None:
        result = self.run_parser(json.dumps(service))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "Cannot resolve a unique, valid Cloud Run candidate.\n")

    def test_selects_candidate_after_serving_revision(self) -> None:
        result = self.run_parser(
            json.dumps(
                {
                    "status": {
                        "traffic": [
                            {"revisionName": "shortform-staging-00041-abc", "percent": 100},
                            {"tag": "candidate", "revisionName": REVISION, "url": URL},
                        ]
                    }
                }
            )
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, f"{REVISION} {URL}\n")
        self.assertEqual(result.stderr, "")

    def test_rejects_missing_malformed_or_ambiguous_candidate(self) -> None:
        target = {"tag": "candidate", "revisionName": REVISION, "url": URL}
        for service in (
            None,
            [],
            {},
            {"status": None},
            {"status": {}},
            {"status": {"traffic": {}}},
            {"status": {"traffic": [None]}},
            {"status": {"traffic": []}},
            {"status": {"traffic": [{"tag": "old"}]}},
            {"status": {"traffic": [target, target]}},
        ):
            with self.subTest(service=service):
                self.assert_rejected(service)

    def test_rejects_missing_or_unsafe_target_fields(self) -> None:
        for field, value in (
            ("revisionName", None),
            ("revisionName", ""),
            ("revisionName", 42),
            ("revisionName", "revision\nINJECTED=yes"),
            ("url", None),
            ("url", ""),
            ("url", 42),
            ("url", "http://candidate.run.app"),
            ("url", "https://candidate.run.app.evil.example"),
            ("url", "https://user:password@candidate.run.app"),
            ("url", "https://candidate.run.app/path"),
            ("url", "https://candidate.run.app?x=y"),
            ("url", URL + ",INJECTED=yes"),
            ("url", URL + "\nINJECTED=yes"),
        ):
            target = {"tag": "candidate", "revisionName": REVISION, "url": URL}
            target[field] = value
            with self.subTest(field=field, value=value):
                self.assert_rejected({"status": {"traffic": [target]}})

    def test_invalid_json_does_not_echo_input(self) -> None:
        result = self.run_parser("invalid-json-runtime-configuration")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "Cannot resolve a unique, valid Cloud Run candidate.\n")


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_PATHS = (
    ".github/dependabot.yml",
    ".github/workflows/ai-governance.yml",
    ".github/workflows/api-contract.yml",
    ".github/workflows/application-ci.yml",
    ".github/workflows/repository-safety.yml",
    "backend/Dockerfile",
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
    "docs/runbooks/compatible-dependency-set.md",
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

    def test_repository_workflows_are_pinned_and_least_privilege(self) -> None:
        workflow_dir = ROOT / ".github/workflows"
        workflows = {
            path.name: path.read_text(encoding="utf-8")
            for path in sorted(workflow_dir.glob("*.yml"))
        }
        self.assertIn("ai-governance.yml", workflows)
        self.assertIn("api-contract.yml", workflows)
        self.assertIn("application-ci.yml", workflows)
        self.assertIn("repository-safety.yml", workflows)

        for name, workflow in workflows.items():
            with self.subTest(workflow=name):
                self.assertIn("permissions:\n  contents: read", workflow)
                self.assertNotIn("pull_request_target", workflow)
                self.assertNotIn("id-token", workflow)
                self.assertNotIn("docker push", workflow)
                self.assertNotIn("docker/login-action", workflow)
                self.assertIsNone(re.search(r"docker\s+login", workflow))
                self.assertNotIn("${{ secrets.", workflow)
                self.assertIn("persist-credentials: false", workflow)
                self._assert_every_action_is_pinned(workflow)
                self._assert_every_job_has_timeout(name, workflow)

            if "actions/checkout" in workflow:
                self.assertRegex(
                    workflow,
                    r"uses: actions/checkout@[0-9a-f]{40} # v[0-9]",
                )
            if "actions/setup-python" in workflow:
                self.assertRegex(
                    workflow,
                    r"uses: actions/setup-python@[0-9a-f]{40} # v[0-9]",
                )

        for name in ("ai-governance.yml", "repository-safety.yml", "api-contract.yml"):
            self.assertIn("timeout-minutes: 10", workflows[name])

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

        application = workflows["application-ci.yml"]
        self.assertIn("name: Application CI", application)
        self.assertRegex(application, r"(?m)^    name: Application CI\s*$")
        self.assertIn("if: always()", application)
        self.assertNotRegex(application, r"pull_request:\n    paths:")
        self.assertIn("postgres:17.6-alpine", application)
        self.assertIn("pnpm backend:lint", application)
        self.assertIn("pnpm backend:format:check", application)
        self.assertIn("pnpm backend:typecheck", application)
        self.assertIn("pnpm backend:migrations:check", application)
        self.assertIn("pnpm backend:test:coverage", application)
        self.assertIn("pnpm mobile:lint", application)
        self.assertIn("pnpm mobile:format:check", application)
        self.assertIn("pnpm mobile:typecheck", application)
        self.assertIn("pnpm mobile:test", application)
        self.assertIn("pnpm mobile:config:check", application)
        self.assertIn("pnpm mobile:bundle:check", application)
        self.assertIn("docker build -f backend/Dockerfile", application)
        self.assertRegex(
            application,
            r"uses: actions/dependency-review-action@[0-9a-f]{40} # v[0-9]",
        )

    def test_backend_dockerfile_is_secret_free_build_smoke(self) -> None:
        dockerfile = (ROOT / "backend/Dockerfile").read_text(encoding="utf-8")
        self.assertIn("uv sync --locked", dockerfile)
        self.assertNotIn("DJANGO_SECRET_KEY", dockerfile)
        self.assertNotIn("DATABASE_URL", dockerfile)
        self.assertNotIn("config.settings.production", dockerfile)
        self.assertNotIn("docker push", dockerfile)

    def _assert_every_action_is_pinned(self, workflow: str) -> None:
        for line in workflow.splitlines():
            if line.lstrip().startswith("uses:"):
                self.assertRegex(
                    line,
                    r"uses:\s+\S+@[0-9a-f]{40} # v[0-9]",
                    msg=line.strip(),
                )

    def _assert_every_job_has_timeout(self, name: str, workflow: str) -> None:
        jobs_section = workflow.split("\njobs:\n", 1)
        self.assertEqual(len(jobs_section), 2, msg=name)
        job_ids = re.findall(r"^  [A-Za-z0-9_-]+:", jobs_section[1], re.MULTILINE)
        timeouts = re.findall(
            r"^    timeout-minutes: [1-9][0-9]*\s*$",
            jobs_section[1],
            re.MULTILINE,
        )
        self.assertEqual(len(job_ids), len(timeouts), msg=name)
        self.assertGreater(len(timeouts), 0, msg=name)


if __name__ == "__main__":
    unittest.main()

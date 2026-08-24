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

    def test_dependabot_covers_application_ecosystems(self) -> None:
        dependabot = (ROOT / ".github/dependabot.yml").read_text(encoding="utf-8")
        for ecosystem in ("github-actions", "uv", "npm", "docker"):
            with self.subTest(ecosystem=ecosystem):
                self.assertIn(f"package-ecosystem: {ecosystem}", dependabot)
        self.assertIn("directory: /backend", dependabot)

    def test_dependabot_ignores_incompatible_majors(self) -> None:
        dependabot = (ROOT / ".github/dependabot.yml").read_text(encoding="utf-8")
        npm = self._dependabot_ignored_ranges(dependabot, "npm")
        uv = self._dependabot_ignored_ranges(dependabot, "uv")
        docker = self._dependabot_ignored_ranges(dependabot, "docker")

        npm_expected = {
            "react-native": ">=0.87.0",
            "eslint": ">=10.0.0",
            "react": ">19.2.3",
            "react-test-renderer": ">19.2.3",
            "expo": ">=58.0.0",
            "expo-router": ">=58.0.0",
            "expo-constants": ">=58.0.0",
            "jest-expo": ">=58.0.0",
            "eslint-config-expo": ">=58.0.0",
            "typescript": ">=7.0.0",
            "jest": ">=30.0.0",
            "@types/jest": ">=30.0.0",
            "react-native-screens": ">=4.27.0",
            "react-native-safe-area-context": ">=5.8.0",
            "expo-video": ">=58.0.0",
        }
        for name, version in npm_expected.items():
            with self.subTest(ecosystem="npm", dependency=name):
                self.assertIn(name, npm)
                self.assertIn(version, npm[name])

        for name, version in (("django", ">=6.2"), ("django-stubs", ">=6.2")):
            with self.subTest(ecosystem="uv", dependency=name):
                self.assertIn(name, uv)
                self.assertIn(version, uv[name])

        self.assertIn("python", docker)
        self.assertIn(">=3.15", docker["python"])

    def test_backend_dockerfile_is_secret_free_build_smoke(self) -> None:
        dockerfile = (ROOT / "backend/Dockerfile").read_text(encoding="utf-8")
        self.assertIn("uv sync --locked", dockerfile)
        self.assertNotIn("DJANGO_SECRET_KEY", dockerfile)
        self.assertNotIn("DATABASE_URL", dockerfile)
        self.assertNotIn("config.settings.production", dockerfile)
        self.assertNotIn("docker push", dockerfile)

    def _dependabot_ecosystem_block(self, config: str, ecosystem: str) -> str:
        matches = list(re.finditer(r"(?m)^  - package-ecosystem: (\S+)\s*$", config))
        self.assertTrue(matches, "dependabot.yml has no package-ecosystem entries")
        for index, match in enumerate(matches):
            if match.group(1) == ecosystem:
                end = matches[index + 1].start() if index + 1 < len(matches) else len(config)
                return config[match.start() : end]
        self.fail(f"missing package-ecosystem: {ecosystem}")
        return ""

    def _dependabot_ignored_ranges(self, config: str, ecosystem: str) -> dict[str, list[str]]:
        block = self._dependabot_ecosystem_block(config, ecosystem)
        ignores: dict[str, list[str]] = {}
        for match in re.finditer(
            r'dependency-name:\s*["\']?([^"\'\s]+)["\']?\s*\n\s*versions:\s*\[([^\]]+)\]',
            block,
        ):
            versions = [item.strip().strip("\"'") for item in match.group(2).split(",") if item.strip()]
            ignores[match.group(1)] = versions
        return ignores

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

    def test_bootstrap_command_is_documented(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("python scripts/check_repository_foundation.py", readme)
        self.assertIn("## Architecture and repository layout", readme)
        self.assertIn("## Common commands", readme)


if __name__ == "__main__":
    unittest.main()

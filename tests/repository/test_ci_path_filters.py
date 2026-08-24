from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[2]


def load_path_filters() -> ModuleType:
    path = ROOT / "scripts" / "ci_path_filters.py"
    spec = importlib.util.spec_from_file_location("ci_path_filters", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


path_filters = load_path_filters()


class PathFilterTests(unittest.TestCase):
    def test_docs_only_skips_expensive_jobs(self) -> None:
        selected = path_filters.classify(
            [
                "docs/runbooks/repository-controls.md",
                "README.md",
                "docs/AI_DEVELOPMENT.md",
                "AGENTS.md",
            ]
        )
        self.assertEqual(
            selected,
            {"backend": False, "mobile": False, "container": False},
        )

    def test_backend_source_runs_backend_and_container(self) -> None:
        selected = path_filters.classify(["backend/apps/health/views.py"])
        self.assertEqual(
            selected,
            {"backend": True, "mobile": False, "container": True},
        )

    def test_mobile_source_runs_only_mobile(self) -> None:
        selected = path_filters.classify(["mobile/src/config/environment.ts"])
        self.assertEqual(
            selected,
            {"backend": False, "mobile": True, "container": False},
        )

    def test_generated_client_package_runs_mobile(self) -> None:
        selected = path_filters.classify(["packages/api-client/src/generated/index.ts"])
        self.assertTrue(selected["mobile"])
        self.assertFalse(selected["backend"])
        self.assertFalse(selected["container"])

    def test_lockfiles_select_matching_ecosystems(self) -> None:
        python = path_filters.classify(["uv.lock", "pyproject.toml"])
        self.assertTrue(python["backend"])
        self.assertTrue(python["container"])
        self.assertFalse(python["mobile"])

        javascript = path_filters.classify(["pnpm-lock.yaml", "pnpm-workspace.yaml"])
        self.assertTrue(javascript["mobile"])
        self.assertFalse(javascript["backend"])
        self.assertFalse(javascript["container"])

    def test_root_package_json_runs_backend_and_mobile(self) -> None:
        selected = path_filters.classify(["package.json"])
        self.assertTrue(selected["backend"])
        self.assertTrue(selected["mobile"])
        self.assertFalse(selected["container"])

    def test_dockerfile_and_dockerignore_run_backend_and_container(self) -> None:
        selected = path_filters.classify(["backend/Dockerfile", ".dockerignore"])
        self.assertTrue(selected["backend"])
        self.assertTrue(selected["container"])
        self.assertFalse(selected["mobile"])

    def test_compose_file_runs_backend_and_container(self) -> None:
        selected = path_filters.classify(["compose.yaml"])
        self.assertTrue(selected["backend"])
        self.assertTrue(selected["container"])
        self.assertFalse(selected["mobile"])

    def test_application_workflow_change_runs_every_expensive_job(self) -> None:
        selected = path_filters.classify([".github/workflows/application-ci.yml"])
        self.assertEqual(
            selected,
            {"backend": True, "mobile": True, "container": True},
        )

    def test_unrelated_workflow_change_skips_expensive_jobs(self) -> None:
        selected = path_filters.classify([".github/workflows/repository-safety.yml"])
        self.assertEqual(
            selected,
            {"backend": False, "mobile": False, "container": False},
        )

    def test_mixed_docs_and_backend_still_runs_backend(self) -> None:
        selected = path_filters.classify(["docs/adr/0001-monorepo.md", "backend/manage.py"])
        self.assertTrue(selected["backend"])
        self.assertTrue(selected["container"])
        self.assertFalse(selected["mobile"])

    def test_workflow_dispatch_and_zero_base_enable_all_jobs(self) -> None:
        dispatch = path_filters.resolve_selection(
            event_name="workflow_dispatch",
            base_sha="abc",
            head_sha="def",
            changed_paths=None,
        )
        self.assertEqual(
            dispatch,
            {"backend": True, "mobile": True, "container": True},
        )
        initial = path_filters.resolve_selection(
            event_name="push",
            base_sha=path_filters.ZERO_SHA,
            head_sha="def",
            changed_paths=None,
        )
        self.assertEqual(
            initial,
            {"backend": True, "mobile": True, "container": True},
        )

    def test_explicit_empty_file_list_skips_expensive_jobs(self) -> None:
        selected = path_filters.resolve_selection(
            event_name="pull_request",
            base_sha="abc",
            head_sha="def",
            changed_paths=[],
        )
        self.assertEqual(
            selected,
            {"backend": False, "mobile": False, "container": False},
        )

    def test_github_output_format(self) -> None:
        output = path_filters.format_github_output(
            {"backend": True, "mobile": False, "container": True}
        )
        self.assertEqual(output, "backend=true\nmobile=false\ncontainer=true\n")

    def test_classifier_lives_in_repository_root_scripts(self) -> None:
        self.assertTrue((ROOT / "scripts" / "ci_path_filters.py").is_file())


if __name__ == "__main__":
    unittest.main()

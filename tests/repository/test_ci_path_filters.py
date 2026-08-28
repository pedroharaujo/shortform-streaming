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
    def test_container_verify_script_runs_container_job(self) -> None:
        selected = path_filters.classify(["scripts/verify_backend_container.sh"])
        self.assertEqual(
            selected,
            {"backend": False, "mobile": False, "container": True},
        )

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


if __name__ == "__main__":
    unittest.main()

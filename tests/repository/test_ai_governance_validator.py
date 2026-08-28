from __future__ import annotations

import unittest
from unittest import mock

from scripts import validate_ai_governance as governance


class AiGovernanceValidatorTests(unittest.TestCase):
    def test_current_governance_contracts_pass(self) -> None:
        governance.validate_contracts()

    def test_rejects_agents_missing_direct_workflow(self) -> None:
        actual_read = governance.read
        original = actual_read("AGENTS.md")
        self.assertIn("Direct Codex / Cursor workflow", original)
        regressed = original.replace(
            "Direct Codex / Cursor workflow", "Always use Superpowers"
        )

        with mock.patch.object(
            governance,
            "read",
            side_effect=lambda relative: (
                regressed if relative == "AGENTS.md" else actual_read(relative)
            ),
        ):
            with self.assertRaisesRegex(AssertionError, "AGENTS.md is missing"):
                governance.validate_agents_md()

    def test_rejects_obsolete_role_file_if_present(self) -> None:
        fake_path = mock.Mock()
        fake_path.exists.return_value = True
        fake_root = mock.MagicMock()
        fake_root.__truediv__.return_value = fake_path

        with mock.patch.object(governance, "ROOT", fake_root):
            with mock.patch.object(
                governance, "OBSOLETE_PATHS", ("ai/roles/orchestrator.md",)
            ):
                with self.assertRaisesRegex(
                    AssertionError, "obsolete custom agent files must be removed"
                ):
                    governance.validate_obsolete_files_removed()

    def test_rejects_vendored_superpowers(self) -> None:
        fake_path = mock.Mock()
        fake_path.is_file.return_value = True
        fake_root = mock.MagicMock()
        fake_root.__truediv__.return_value = fake_path

        with mock.patch.object(governance, "ROOT", fake_root):
            with self.assertRaisesRegex(
                AssertionError, "Superpowers must not be vendored"
            ):
                governance.validate_superpowers_not_vendored()


if __name__ == "__main__":
    unittest.main()

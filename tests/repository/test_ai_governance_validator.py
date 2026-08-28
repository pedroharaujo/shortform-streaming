from __future__ import annotations

import unittest
from unittest import mock

from scripts import validate_ai_governance as governance


class AiGovernanceValidatorTests(unittest.TestCase):
    def assert_contract_regression(
        self,
        path: str,
        old: str,
        new: str,
        expected_error: str,
    ) -> None:
        actual_read = governance.read
        original = actual_read(path)
        self.assertIn(old, original, f"probe fixture drifted in {path}")
        regressed = original.replace(old, new, 1)

        with mock.patch.object(
            governance,
            "read",
            side_effect=lambda relative: (
                regressed if relative == path else actual_read(relative)
            ),
        ):
            with self.assertRaisesRegex(AssertionError, expected_error):
                governance.validate_contracts()

    def test_current_governance_contracts_pass(self) -> None:
        governance.validate_contracts()

    def test_rejects_orchestrator_manifest_responsibility_regression(self) -> None:
        self.assert_contract_regression(
            "ai/roles/orchestrator.md",
            (
                "2. Before implementation, produce the Validation Manifest defined in "
                "`ai/workflows/development-loop.md`. The orchestrator owns the "
                "Validation Manifest and remains accountable for it."
            ),
            (
                "2. The orchestrator records task state. Before implementation, the "
                "planner owns and produces the Validation Manifest."
            ),
            "orchestrator Procedure must keep the orchestrator responsible",
        )


if __name__ == "__main__":
    unittest.main()

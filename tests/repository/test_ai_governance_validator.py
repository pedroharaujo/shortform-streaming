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
                "`ai/workflows/development-loop.md`. Consult the optional, read-only "
                "validation planner only when scope is ambiguous, cross-boundary, or "
                "sensitive; the orchestrator remains accountable for the manifest."
            ),
            (
                "2. The orchestrator records task state. Before implementation, the "
                "validation planner owns and produces the Validation Manifest."
            ),
            "orchestrator Procedure must keep the orchestrator responsible",
        )

    def test_rejects_path_based_workflow_classification(self) -> None:
        self.assert_contract_regression(
            "ai/workflows/development-loop.md",
            (
                "Classify the semantic impact at the highest applicable level; never "
                "classify only from file extension or path:"
            ),
            "Classify risk primarily from file extension or path:",
            "workflow Validation planning must classify semantic risk",
        )

    def test_rejects_planner_manifest_ownership(self) -> None:
        self.assert_contract_regression(
            "ai/roles/validation-planner.md",
            (
                "The orchestrator owns the Validation Manifest and normally prepares it "
                "directly."
            ),
            (
                "The validation planner owns the Validation Manifest and normally "
                "prepares it directly."
            ),
            "validation planner must not own the Validation Manifest",
        )

    def test_rejects_pr_manifest_without_base_revision(self) -> None:
        self.assert_contract_regression(
            ".github/pull_request_template.md",
            "- Base revision:\n",
            "",
            "PR template Validation Manifest is missing Base revision:",
        )

    def test_rejects_missing_r3_security_and_supply_chain_scope(self) -> None:
        trigger_scope = (
            "security controls or trust boundaries, secrets, privacy, rights, commerce, "
            "payments, entitlements, dependencies or supply-chain integrity, "
        )
        for path in (
            "ai/roles/validation-planner.md",
            "ai/workflows/development-loop.md",
        ):
            with self.subTest(path=path):
                self.assert_contract_regression(
                    path,
                    trigger_scope,
                    "secrets, privacy, rights, commerce, payments, entitlements, ",
                    "R3 trigger security controls is missing",
                )

    def test_rejects_unbounded_omission_inventory(self) -> None:
        self.assert_contract_regression(
            "ai/roles/validation-planner.md",
            (
                "6. Omissions: justify only checks, suites, platforms, or reviews "
                "reasonably expected from the change surface, applicable risk triggers, "
                "the `AGENTS.md` validation matrix, or required CI. Related omissions "
                "with the same reason may be grouped."
            ),
            "6. Omissions: justify every omitted suite, platform, or review.",
            "validation planner Validation Manifest is missing expected omission scope",
        )


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest
from unittest import mock

from scripts import validate_ai_governance as governance


class AiGovernanceValidatorTests(unittest.TestCase):
    def validate_contract_variant(self, path: str, old: str, new: str) -> None:
        actual_read = governance.read
        original = actual_read(path)
        self.assertIn(old, original, f"probe fixture drifted in {path}")
        variant = original.replace(old, new, 1)

        with mock.patch.object(
            governance,
            "read",
            side_effect=lambda relative: (
                variant if relative == path else actual_read(relative)
            ),
        ):
            governance.validate_contracts()

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

    def test_rejects_path_first_policy_despite_irrelevant_negation(self) -> None:
        cases = (
            (
                "ai/roles/validation-planner.md",
                (
                    "- Classify risk from intended behavior, affected consumers, data "
                    "flow, and failure impact; never classify from file extension or "
                    "path alone."
                ),
                (
                    "- Classify risk from intended behavior, affected consumers, data "
                    "flow, and failure impact. Do not use path to skip checks. Classify "
                    "risk primarily by file extension."
                ),
                "validation planner Hard boundaries must classify semantic risk",
            ),
            (
                "ai/workflows/development-loop.md",
                (
                    "Classify the semantic impact at the highest applicable level; "
                    "never classify only from file extension or path:"
                ),
                (
                    "Classify the semantic impact at the highest applicable level. Do "
                    "not use path to skip checks. Classify risk primarily by file "
                    "extension:"
                ),
                "workflow Validation planning must classify semantic risk",
            ),
        )
        for path, old, new, expected_error in cases:
            with self.subTest(path=path):
                self.assert_contract_regression(
                    path,
                    old,
                    new,
                    expected_error,
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

    def test_accepts_optional_planner_before_orchestrator_ownership(self) -> None:
        self.validate_contract_variant(
            "ai/roles/validation-planner.md",
            (
                "This is an optional, consultative role. The orchestrator owns the "
                "Validation Manifest and normally prepares it directly."
            ),
            (
                "The planner is optional and consultative; the orchestrator owns the "
                "Validation Manifest and normally prepares it directly."
            ),
        )

    def test_rejects_pr_manifest_without_base_revision(self) -> None:
        self.assert_contract_regression(
            ".github/pull_request_template.md",
            "- Base revision:\n",
            "",
            "PR template Validation Manifest is missing Base revision:",
        )

    def test_rejects_r3_triggers_moved_to_lower_risk(self) -> None:
        cases = (
            (
                "ai/roles/validation-planner.md",
                (
                    "| `R1` | Isolated module behavior with bounded consumers and no "
                    "sensitive trigger. |\n"
                    "| `R2` | API, database, schema, migration, generated "
                    "contract/client, shared configuration, or cross-boundary "
                    "integration change. |\n"
                    "| `R3` | Authentication, authorization, security controls or trust "
                    "boundaries, secrets, privacy, rights, commerce, payments, "
                    "entitlements, dependencies or supply-chain integrity, "
                    "infrastructure, destructive migrations, or data deletion. |"
                ),
                (
                    "| `R1` | Isolated module behavior with bounded consumers, security "
                    "controls or trust boundaries, dependencies or supply-chain "
                    "integrity. |\n"
                    "| `R2` | API, database, schema, migration, generated "
                    "contract/client, shared configuration, or cross-boundary "
                    "integration change. |\n"
                    "| `R3` | Authentication, authorization, secrets, privacy, rights, "
                    "commerce, payments, entitlements, infrastructure, destructive "
                    "migrations, or data deletion. |"
                ),
            ),
            (
                "ai/workflows/development-loop.md",
                (
                    "- `R1`: isolated module behavior with bounded consumers and no "
                    "sensitive trigger.\n"
                    "- `R2`: API, database, schema, migration, generated "
                    "contract/client, shared configuration, or cross-boundary "
                    "integration.\n"
                    "- `R3`: authentication, authorization, security controls or trust "
                    "boundaries, secrets, privacy, rights, commerce, payments, "
                    "entitlements, dependencies or supply-chain integrity, "
                    "infrastructure, destructive migrations, or data deletion."
                ),
                (
                    "- `R1`: isolated module behavior with bounded consumers and no "
                    "sensitive trigger.\n"
                    "- `R2`: API, database, schema, migration, generated "
                    "contract/client, shared configuration, cross-boundary integration, "
                    "security controls or trust boundaries, dependencies or supply-chain "
                    "integrity.\n"
                    "- `R3`: authentication, authorization, secrets, privacy, rights, "
                    "commerce, payments, entitlements, infrastructure, destructive "
                    "migrations, or data deletion."
                ),
            ),
        )
        for path, old, new in cases:
            with self.subTest(path=path):
                self.assert_contract_regression(
                    path,
                    old,
                    new,
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

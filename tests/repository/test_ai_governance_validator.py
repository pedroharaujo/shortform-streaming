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
                "`ai/workflows/development-loop.md`. The orchestrator owns the "
                "Validation Manifest and remains accountable for it."
            ),
            (
                "2. The orchestrator records task state. Before implementation, the "
                "planner owns and produces the Validation Manifest."
            ),
            "orchestrator Procedure must keep the orchestrator responsible",
        )

    def test_rejects_path_first_policy_despite_irrelevant_negation(self) -> None:
        self.assert_contract_regression(
            "ai/workflows/development-loop.md",
            (
                "Classify the semantic impact at the highest applicable level from "
                "intended behavior, affected consumers, data flow, and failure "
                "impact; never classify only from file extension or path:"
            ),
            (
                "Classify the semantic impact at the highest applicable level from "
                "intended behavior, affected consumers, data flow, and failure "
                "impact. Do not use path to skip checks. Classify risk primarily by "
                "file extension:"
            ),
            "workflow Validation planning must classify semantic risk",
        )

    def test_rejects_passive_path_first_policy(self) -> None:
        self.assert_contract_regression(
            "ai/workflows/development-loop.md",
            (
                "Classify the semantic impact at the highest applicable level from "
                "intended behavior, affected consumers, data flow, and failure "
                "impact; never classify only from file extension or path:"
            ),
            (
                "Risk is classified primarily by file extension or path. Record "
                "semantic impact; never classify only from file extension or path:"
            ),
            "workflow Validation planning must classify semantic risk",
        )

    def test_accepts_paths_as_only_a_secondary_signal(self) -> None:
        self.validate_contract_variant(
            "ai/workflows/development-loop.md",
            (
                "Classify the semantic impact at the highest applicable level from "
                "intended behavior, affected consumers, data flow, and failure "
                "impact; never classify only from file extension or path:"
            ),
            (
                "Record intended behavior and affected consumers. File paths are "
                "only a secondary signal, never the primary basis for classification:"
            ),
        )

    def test_rejects_planner_manifest_ownership(self) -> None:
        self.assert_contract_regression(
            "ai/roles/planner.md",
            (
                "The orchestrator owns the Validation Manifest and remains "
                "accountable for it."
            ),
            (
                "The planner owns the Validation Manifest and remains accountable "
                "for it."
            ),
            "planner must not own the Validation Manifest",
        )

    def test_accepts_planner_invocation_orchestrator_ownership_rephrase(self) -> None:
        self.validate_contract_variant(
            "ai/roles/planner.md",
            (
                "The orchestrator owns the Validation Manifest and remains "
                "accountable for it."
            ),
            "The orchestrator remains accountable for the Validation Manifest.",
        )

    def test_rejects_pr_manifest_without_base_revision(self) -> None:
        self.assert_contract_regression(
            ".github/pull_request_template.md",
            "- Base revision:\n",
            "",
            "PR template Validation Manifest is missing Base revision:",
        )

    def test_rejects_r3_triggers_moved_to_lower_risk(self) -> None:
        self.assert_contract_regression(
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
            "R3 trigger security controls is missing",
        )

    def test_rejects_duplicate_r3_entries_in_the_same_format(self) -> None:
        r3_line = (
            "- `R3`: authentication, authorization, security controls or trust "
            "boundaries, secrets, privacy, rights, commerce, payments, "
            "entitlements, dependencies or supply-chain integrity, "
            "infrastructure, destructive migrations, or data deletion."
        )
        self.assert_contract_regression(
            "ai/workflows/development-loop.md",
            r3_line,
            f"{r3_line}\n{r3_line}",
            "workflow validation planning must define exactly one R3 entry",
        )

    def test_rejects_unbounded_omission_inventory(self) -> None:
        cases = (
            (
                "ai/workflows/development-loop.md",
                (
                    "omissions only for checks, suites, platforms, or reviews "
                    "reasonably expected from the change surface, applicable risk "
                    "triggers, the `AGENTS.md` validation matrix, or required CI; "
                    "related omissions with the same reason may be grouped;"
                ),
                "omissions: justify every omitted suite, platform, or review;",
                "workflow Validation planning is missing expected omission scope",
            ),
            (
                ".github/pull_request_template.md",
                (
                    "- Specialized agents/reviews; justified expected omissions from "
                    "surface/triggers/`AGENTS.md`/CI, grouped when reasons match:"
                ),
                "- Specialized agents/reviews; list every omitted suite:",
                "PR template Validation Manifest is missing expected omission scope",
            ),
        )
        for path, old, new, expected_error in cases:
            with self.subTest(path=path):
                self.assert_contract_regression(path, old, new, expected_error)

    def test_rejects_loop_order_without_plan(self) -> None:
        self.assert_contract_regression(
            "ai/workflows/development-loop.md",
            "plan -> implement -> review -> fix -> verify -> PR",
            "implement -> review -> fix -> verify -> PR",
            "development loop order is missing",
        )

    def test_rejects_flow_diagram_without_plan(self) -> None:
        self.assert_contract_regression(
            "ai/workflows/development-loop.md",
            "  -> ai-in-progress / plan\n  -> implement\n",
            "  -> ai-in-progress / implement\n",
            "development loop state flow must include plan",
        )


if __name__ == "__main__":
    unittest.main()

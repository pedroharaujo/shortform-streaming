"""Validate shared agent instructions and that Superpowers is not vendored."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

OBSOLETE_PATHS = (
    "ai/README.md",
    "ai/STATES.md",
    "ai/roles/orchestrator.md",
    "ai/roles/planner.md",
    "ai/roles/implementer.md",
    "ai/roles/reviewer.md",
    "ai/roles/verifier.md",
    "ai/roles/validation-planner.md",
    "ai/workflows/development-loop.md",
    ".codex/agents/orchestrator.toml",
    ".codex/agents/planner.toml",
    ".codex/agents/implementer.toml",
    ".codex/agents/reviewer.toml",
    ".codex/agents/verifier.toml",
    ".codex/agents/validation-planner.toml",
    ".cursor/agents/orchestrator.md",
    ".cursor/agents/planner.md",
    ".cursor/agents/implementer.md",
    ".cursor/agents/reviewer.md",
    ".cursor/agents/verifier.md",
    ".cursor/agents/validation-planner.md",
    ".cursor/rules/ai-native-workflow.mdc",
)

VENDORED_SUPERPOWERS = (
    "skills/using-superpowers/SKILL.md",
    "skills/brainstorming/SKILL.md",
    "skills/writing-plans/SKILL.md",
    "skills/subagent-driven-development/SKILL.md",
    ".cursor-plugin/plugin.json",
    ".codex-plugin/plugin.json",
)

REQUIRED_DOCS = (
    "AGENTS.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "MICRODRAMA_IMPLEMENTATION_PLAN.md",
    "docs/AI_DEVELOPMENT.md",
    "docs/README.md",
    "docs/product/MVP_PRODUCT_BRIEF.md",
    "docs/product/DECISION_REGISTER.md",
    ".cursor/BUGBOT.md",
)

AGENTS_TOKENS = (
    "Repository map",
    "Documentation authority",
    "Project constraints",
    "High-risk surfaces",
    "Commands",
    "Development workflow",
    "Direct Codex / Cursor workflow",
    "Superpowers workflow",
    "Explicit user override",
    "Task complexity",
    "Level 1",
    "Level 2",
    "Level 3",
    "Do not create extra git worktrees",
    "python scripts/validate_ai_governance.py",
    "pnpm backend:test",
    "pnpm contract:check",
    "pnpm mobile:test",
    "docs/product/DECISION_REGISTER.md",
    "docs/product/MVP_PRODUCT_BRIEF.md",
    "MICRODRAMA_IMPLEMENTATION_PLAN.md",
    "playback-authorize",
    "OpenAPI",
)

AGENTS_FORBIDDEN = (
    "ai/roles/orchestrator.md",
    "ai/workflows/development-loop.md",
    "never implements or fixes production code",
    "Validation Manifest",
)


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise AssertionError(f"missing required file: {relative}")
    return path.read_text(encoding="utf-8")


def validate_obsolete_files_removed() -> None:
    present = [path for path in OBSOLETE_PATHS if (ROOT / path).exists()]
    if present:
        raise AssertionError(
            "obsolete custom agent files must be removed: " + ", ".join(present)
        )


def validate_superpowers_not_vendored() -> None:
    present = [path for path in VENDORED_SUPERPOWERS if (ROOT / path).is_file()]
    if present:
        raise AssertionError(
            "Superpowers must not be vendored in the repository: "
            + ", ".join(present)
        )


def validate_required_docs() -> None:
    for path in REQUIRED_DOCS:
        read(path)


def validate_agents_md() -> None:
    agents = read("AGENTS.md")
    folded = agents.casefold()
    for token in AGENTS_TOKENS:
        if token.casefold() not in folded:
            raise AssertionError(f"AGENTS.md is missing {token}")
    for token in AGENTS_FORBIDDEN:
        if token.casefold() in folded:
            raise AssertionError(f"AGENTS.md must not contain {token}")


def validate_operating_docs() -> None:
    operating = read("docs/AI_DEVELOPMENT.md")
    for token in (
        "Superpowers",
        "/add-plugin superpowers",
        "AGENTS.md",
        "no extra git worktrees",
    ):
        if token.casefold() not in operating.casefold():
            raise AssertionError(f"docs/AI_DEVELOPMENT.md is missing {token}")

    contributing = read("CONTRIBUTING.md")
    if "AGENTS.md" not in contributing:
        raise AssertionError("CONTRIBUTING.md must reference AGENTS.md")
    if "ai/workflows/development-loop.md" in contributing:
        raise AssertionError("CONTRIBUTING.md still references the removed workflow")

    bugbot = read(".cursor/BUGBOT.md")
    for token in (
        "decision-register",
        "purchases, coins, rewards",
        "territory",
        "OpenAPI",
    ):
        if token.casefold() not in bugbot.casefold():
            raise AssertionError(f".cursor/BUGBOT.md is missing {token}")

    pr = read(".github/pull_request_template.md")
    for token in (
        "Purchase/coin/reward/entitlement",
        "Rights/territory/takedown",
        "Level 1",
        "Superpowers",
    ):
        if token not in pr and token.casefold() not in pr.casefold():
            raise AssertionError(f"PR template is missing {token}")
    if "Validation Manifest" in pr:
        raise AssertionError("PR template still requires a Validation Manifest")

    issue = read(".github/ISSUE_TEMPLATE/implementation-task.yml")
    if "Ready to implement" not in issue:
        raise AssertionError("issue template does not enforce the ready-to-implement gate")
    for token in (
        "Acceptance criteria are observable and bounded",
        "decision-register",
        "No unapproved legal, rights, market, price, or budget decision",
    ):
        if token not in issue:
            raise AssertionError(f"issue template is missing {token}")

    labels = read(".github/labels.yml")
    for state in ("ai-ready", "ai-in-progress", "ai-review", "ai-verified"):
        if state not in labels:
            raise AssertionError(f"{state} missing from labels")


def validate_contracts() -> None:
    validate_obsolete_files_removed()
    validate_superpowers_not_vendored()
    validate_required_docs()
    validate_agents_md()
    validate_operating_docs()


def main() -> int:
    try:
        validate_contracts()
    except (AssertionError, OSError) as error:
        print(f"AI governance validation failed: {error}", file=sys.stderr)
        return 1

    print("AI governance validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

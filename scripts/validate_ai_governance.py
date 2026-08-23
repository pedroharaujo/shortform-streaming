"""Validate the repository's tool-neutral and tool-specific AI contracts."""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_ROLES = ("orchestrator", "implementer", "reviewer", "verifier")
OPTIONAL_ROLES = ("validation-planner",)
ROLES = CORE_ROLES + OPTIONAL_ROLES
READ_ONLY_ROLES = ("orchestrator", "reviewer", "validation-planner")
STATES = ("ai-ready", "ai-in-progress", "ai-review", "ai-verified")


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise AssertionError(f"missing required file: {relative}")
    return path.read_text(encoding="utf-8")


def validate_codex_agents() -> None:
    config = tomllib.loads(read(".codex/config.toml"))
    maximum = config.get("agents", {}).get("max_concurrent_threads_per_session", 0)
    if maximum < 3:
        raise AssertionError("Codex must allow implementer, reviewer, and verifier threads")

    for role in ROLES:
        data = tomllib.loads(read(f".codex/agents/{role}.toml"))
        for key in ("name", "description", "developer_instructions"):
            if not data.get(key):
                raise AssertionError(f".codex agent {role} is missing {key}")
        if data["name"] != role:
            raise AssertionError(f".codex agent name mismatch for {role}")

    for role in READ_ONLY_ROLES:
        data = tomllib.loads(read(f".codex/agents/{role}.toml"))
        if data.get("sandbox_mode") != "read-only":
            raise AssertionError(f"{role} must be read-only")

    planner = tomllib.loads(read(".codex/agents/validation-planner.toml"))
    planner_instructions = planner["developer_instructions"].lower()
    for token in (
        "optional",
        "read-only",
        "validation manifest",
        "ai/roles/validation-planner.md",
    ):
        if token not in (planner["description"] + planner_instructions).lower():
            raise AssertionError(f"Codex validation planner is missing {token}")


def validate_cursor_agents() -> None:
    for role in ROLES:
        content = read(f".cursor/agents/{role}.md")
        match = re.match(r"^---\n(?P<header>.*?)\n---\n", content, re.DOTALL)
        if not match:
            raise AssertionError(f"Cursor agent {role} has invalid frontmatter")
        header = match.group("header")
        if f"name: {role}" not in header or "description:" not in header:
            raise AssertionError(f"Cursor agent {role} is missing name or description")

    planner = read(".cursor/agents/validation-planner.md")
    for token in ("optional", "read-only", "ai/roles/validation-planner.md"):
        if token not in planner.lower():
            raise AssertionError(f"Cursor validation planner is missing {token}")


def validate_contracts() -> None:
    agents = read("AGENTS.md")
    loop = read("ai/workflows/development-loop.md")
    states = read("ai/STATES.md")
    labels = read(".github/labels.yml")
    issue = read(".github/ISSUE_TEMPLATE/implementation-task.yml")
    pr = read(".github/pull_request_template.md")
    planner = read("ai/roles/validation-planner.md")

    for role in ROLES:
        read(f"ai/roles/{role}.md")
        if role not in agents:
            raise AssertionError(f"AGENTS.md does not reference {role}")

    for role in CORE_ROLES:
        if role not in loop:
            raise AssertionError(f"core role {role} is missing from the development loop")

    for token in (
        "optional",
        "read-only",
        "does not create a state transition or serial gate",
        "never classify from file extension or path alone",
        "scope",
        "intended behavior",
        "affected consumers",
        "required",
        "selected",
        "not-applicable",
        "commit SHA",
        "environment",
        "configuration",
        "review scope",
        "expiration condition",
        "escalation",
        "replanning",
    ):
        if token.lower() not in planner.lower():
            raise AssertionError(f"validation planner contract is missing {token}")

    for level in ("R0", "R1", "R2", "R3"):
        if level not in planner or level not in loop or level not in pr:
            raise AssertionError(f"validation risk level {level} is not documented everywhere")

    for trigger in (
        "authentication",
        "authorization",
        "secrets",
        "privacy",
        "rights",
        "commerce",
        "payments",
        "entitlements",
        "infrastructure",
        "destructive migrations",
        "data deletion",
    ):
        if trigger not in planner.lower() or trigger not in loop.lower():
            raise AssertionError(f"R3 trigger {trigger} is missing")

    if "implement -> review -> fix -> verify -> PR" not in loop:
        raise AssertionError("development loop order is missing")
    flow_match = re.search(r"## Loop\s+```text(?P<flow>.*?)```", loop, re.DOTALL)
    if not flow_match:
        raise AssertionError("development loop state flow is missing")
    if "validation-planner" in flow_match.group("flow"):
        raise AssertionError("optional validation planner must not be a serial workflow step")
    if "never implements or fixes production code" not in agents.lower():
        raise AssertionError("orchestrator write boundary is missing")
    if "python scripts/validate_ai_governance.py" not in agents:
        raise AssertionError("governance validation command is missing")

    for gate in (
        "independent review",
        "independent verification on the final revision",
        "passing required CI",
    ):
        if gate.lower() not in loop.lower() or gate.lower() not in planner.lower():
            raise AssertionError(f"mandatory gate is missing: {gate}")

    for policy in (
        "full suite is not the default",
        "does not repeat valid CI without a recorded reason",
        "required, missing, or failing check cannot become `not-applicable`",
        "material fix or elevated risk invalidates",
    ):
        if policy.lower() not in loop.lower():
            raise AssertionError(f"proportional validation policy is missing: {policy}")

    for state in STATES:
        for location, content in (("states", states), ("labels", labels)):
            if state not in content:
                raise AssertionError(f"{state} missing from {location}")

    if "ai-ready" not in issue or "AI-ready gate" not in issue:
        raise AssertionError("issue template does not enforce the ai-ready gate")
    for token in ("Reviewer result", "Verifier result", "separate contexts"):
        if token not in pr:
            raise AssertionError(f"PR template is missing {token}")
    for token in (
        "Validation Manifest",
        "scope",
        "behavior",
        "consumers/boundaries",
        "required",
        "selected",
        "not-applicable",
        "justified omissions",
        "SHA",
        "environment/configuration",
        "review scope",
        "expiration",
        "Escalation/replanning",
    ):
        if token not in pr:
            raise AssertionError(f"PR template Validation Manifest is missing {token}")


def main() -> int:
    try:
        validate_codex_agents()
        validate_cursor_agents()
        validate_contracts()
    except (AssertionError, OSError, tomllib.TOMLDecodeError) as error:
        print(f"AI governance validation failed: {error}", file=sys.stderr)
        return 1

    print("AI governance validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

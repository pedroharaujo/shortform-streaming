"""Validate the repository's tool-neutral and tool-specific AI contracts."""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLES = ("orchestrator", "implementer", "reviewer", "verifier")
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

    orchestrator = tomllib.loads(read(".codex/agents/orchestrator.toml"))
    reviewer = tomllib.loads(read(".codex/agents/reviewer.toml"))
    if orchestrator.get("sandbox_mode") != "read-only":
        raise AssertionError("orchestrator must be read-only")
    if reviewer.get("sandbox_mode") != "read-only":
        raise AssertionError("reviewer must be read-only")


def validate_cursor_agents() -> None:
    for role in ROLES:
        content = read(f".cursor/agents/{role}.md")
        match = re.match(r"^---\n(?P<header>.*?)\n---\n", content, re.DOTALL)
        if not match:
            raise AssertionError(f"Cursor agent {role} has invalid frontmatter")
        header = match.group("header")
        if f"name: {role}" not in header or "description:" not in header:
            raise AssertionError(f"Cursor agent {role} is missing name or description")


def validate_contracts() -> None:
    agents = read("AGENTS.md")
    loop = read("ai/workflows/development-loop.md")
    states = read("ai/STATES.md")
    labels = read(".github/labels.yml")
    issue = read(".github/ISSUE_TEMPLATE/implementation-task.yml")
    pr = read(".github/pull_request_template.md")

    for role in ROLES:
        read(f"ai/roles/{role}.md")
        if role not in agents:
            raise AssertionError(f"AGENTS.md does not reference {role}")

    if "implement -> review -> fix -> verify -> PR" not in loop:
        raise AssertionError("development loop order is missing")
    if "never implements or fixes production code" not in agents.lower():
        raise AssertionError("orchestrator write boundary is missing")
    if "python scripts/validate_ai_governance.py" not in agents:
        raise AssertionError("governance validation command is missing")

    for state in STATES:
        for location, content in (("states", states), ("labels", labels)):
            if state not in content:
                raise AssertionError(f"{state} missing from {location}")

    if "ai-ready" not in issue or "AI-ready gate" not in issue:
        raise AssertionError("issue template does not enforce the ai-ready gate")
    for token in ("Reviewer result", "Verifier result", "separate contexts"):
        if token not in pr:
            raise AssertionError(f"PR template is missing {token}")


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

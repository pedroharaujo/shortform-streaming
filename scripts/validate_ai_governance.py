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


def markdown_section(content: str, heading: str, location: str) -> str:
    match = re.search(
        rf"^## {re.escape(heading)}\s*$\n(?P<body>.*?)(?=^## |\Z)",
        content,
        re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise AssertionError(f"{location} is missing the {heading} section")
    return match.group("body")


def normalized(content: str) -> str:
    return re.sub(r"[-\s]+", " ", content.casefold())


def risk_entry(content: str, level: str, location: str) -> str:
    patterns = (
        rf"^\|\s*`{re.escape(level)}`\s*\|\s*(?P<body>.*?)\s*\|\s*$",
        rf"^-\s*`{re.escape(level)}`\s*:\s*(?P<body>.+)$",
    )
    matches = [
        match.group("body")
        for pattern in patterns
        for match in re.finditer(pattern, content, re.MULTILINE)
    ]
    if len(matches) != 1:
        raise AssertionError(f"{location} must define exactly one {level} entry")
    return matches[0]


def validate_manifest_ownership(
    orchestrator: str, planner: str, loop: str
) -> None:
    sections = (
        (
            "orchestrator Procedure",
            markdown_section(orchestrator, "Procedure", "orchestrator contract"),
        ),
        (
            "validation planner Invocation",
            markdown_section(planner, "Invocation", "validation planner contract"),
        ),
        (
            "workflow Validation planning",
            markdown_section(loop, "Validation planning", "development workflow"),
        ),
    )
    planner_invocation = sections[1][1]
    planner_ownership = re.compile(
        r"(?:\b(?:the )?(?:validation )?planner (?:owns|"
        r"is (?:accountable|responsible) for) (?:the )?"
        r"(?:validation )?manifest\b|"
        r"\b(?:validation )?manifest (?:is )?owned by (?:the )?"
        r"(?:validation )?planner\b)",
        re.IGNORECASE,
    )
    if planner_ownership.search(planner_invocation):
        raise AssertionError("validation planner must not own the Validation Manifest")

    responsibility = re.compile(
        r"(?:\borchestrator\b (?:owns|produces|prepares) (?:the )?"
        r"validation manifest\b|"
        r"\borchestrator\b (?:remains |is )?(?:accountable|responsible) "
        r"for (?:the )?(?:validation )?manifest\b|"
        r"\bvalidation manifest\b (?:is )?(?:owned|produced|prepared) by "
        r"(?:the )?orchestrator\b)",
        re.IGNORECASE,
    )
    for location, section in sections:
        if not responsibility.search(normalized(section)):
            raise AssertionError(
                f"{location} must keep the orchestrator responsible for the "
                "Validation Manifest"
            )


def validate_semantic_classification(planner: str, loop: str) -> None:
    sections = (
        (
            "validation planner Hard boundaries",
            markdown_section(planner, "Hard boundaries", "validation planner contract"),
        ),
        (
            "workflow Validation planning",
            markdown_section(loop, "Validation planning", "development workflow"),
        ),
    )
    direct_prohibition = re.compile(
        r"\b(?:never|do not|must not|cannot|may not)\s+classify\b"
        r"(?:[^.\n]{0,60}\b(?:only|solely|primarily)\b"
        r"[^.\n]{0,100}\b(?:from|by|based on)\b"
        r"[^.\n]{0,80}\b(?:file extensions?|paths?)\b|"
        r"[^.\n]{0,60}\b(?:from|by|based on)\b"
        r"[^.\n]{0,80}\b(?:file extensions?|paths?)\b"
        r"[^.\n]{0,30}\balone\b)",
        re.IGNORECASE,
    )
    passive_prohibition = re.compile(
        r"\b(?:risk )?classification\b[^.\n]{0,50}"
        r"\b(?:must not|cannot|may not)\b[^.\n]{0,60}"
        r"\bbased (?:only|solely|primarily) on\b[^.\n]{0,80}"
        r"\b(?:file extensions?|paths?)\b",
        re.IGNORECASE,
    )
    secondary_signal_prohibition = re.compile(
        r"\bfile paths?\s+(?:are|remain)\s+only\s+a\s+secondary\s+signal,\s*"
        r"never\s+the\s+primary\s+basis\s+for\s+(?:risk\s+)?classification\b",
        re.IGNORECASE,
    )
    primary_classifier = re.compile(
        r"(?:\bclassif(?:y|ied|ying|ication)\b[^.\n]{0,60}"
        r"\b(?:primary|primarily|sole|solely|only|alone|first)\b"
        r"[^.\n]{0,80}\b(?:from|by|based on)\b[^.\n]{0,80}"
        r"\b(?:file extensions?|paths?)\b|"
        r"\bclassif(?:y|ied|ying|ication)\b[^.\n]{0,60}"
        r"\b(?:from|by|based on)\b[^.\n]{0,80}"
        r"\b(?:file extensions?|paths?)\b[^.\n]{0,40}"
        r"\b(?:primary|primarily|sole|solely|only|alone|first)\b|"
        r"\b(?:file extensions?|paths?)\b\s+"
        r"(?:is|are|remain|become|serve as|act as)\s+(?:the\s+)?"
        r"(?:primary|sole|only)\s+"
        r"\b(?:classifier|basis|criterion|input|signal)\b)",
        re.IGNORECASE,
    )
    direct_negation = re.compile(
        r"\b(?:never|do not|must not|cannot|may not)\s+classify\b",
        re.IGNORECASE,
    )
    semantic_terms = (
        "semantic impact",
        "intended behavior",
        "affected consumers",
        "data flow",
        "failure impact",
    )
    for location, section in sections:
        folded = section.casefold()
        statements = re.split(r"(?<=[.;!?])\s+|\n+", section)
        path_first = any(
            primary_classifier.search(statement)
            and not direct_negation.search(statement)
            and not passive_prohibition.search(statement)
            for statement in statements
        )
        has_prohibition = (
            direct_prohibition.search(section)
            or passive_prohibition.search(section)
            or secondary_signal_prohibition.search(section)
        )
        if (
            not any(term in folded for term in semantic_terms)
            or not has_prohibition
            or path_first
        ):
            raise AssertionError(
                f"{location} must classify semantic risk and prohibit "
                "classification from path or extension alone"
            )


def validate_omission_scope(planner: str, loop: str, pr: str) -> None:
    sections = (
        (
            "validation planner Validation Manifest",
            markdown_section(
                planner, "Validation Manifest", "validation planner contract"
            ),
        ),
        (
            "workflow Validation planning",
            markdown_section(loop, "Validation planning", "development workflow"),
        ),
        (
            "PR template Validation Manifest",
            markdown_section(pr, "Validation Manifest", "PR template"),
        ),
    )
    concepts = (
        ("expected omission scope", ("expected",)),
        ("change surface", ("change surface", "surface")),
        ("risk triggers", ("risk triggers", "triggers")),
        ("AGENTS.md validation matrix", ("agents.md",)),
        ("required CI", ("required ci", "ci")),
        ("grouping by shared reason", ("grouped", "group")),
    )
    for location, section in sections:
        folded = normalized(section)
        for concept, alternatives in concepts:
            if not any(alternative in folded for alternative in alternatives):
                raise AssertionError(f"{location} is missing {concept}")


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
    pr_manifest = markdown_section(pr, "Validation Manifest", "PR template")
    role_contracts = {role: read(f"ai/roles/{role}.md") for role in ROLES}
    orchestrator = role_contracts["orchestrator"]
    planner = role_contracts["validation-planner"]

    for role in ROLES:
        if role not in agents:
            raise AssertionError(f"AGENTS.md does not reference {role}")

    for role in CORE_ROLES:
        if role not in loop:
            raise AssertionError(f"core role {role} is missing from the development loop")

    for token in (
        "optional",
        "read-only",
        "does not create a state transition or serial gate",
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

    validate_manifest_ownership(orchestrator, planner, loop)
    validate_semantic_classification(planner, loop)
    validate_omission_scope(planner, loop, pr)

    planner_risk = markdown_section(
        planner, "Risk classification", "validation planner contract"
    )
    workflow_planning = markdown_section(
        loop, "Validation planning", "development workflow"
    )
    for level in ("R0", "R1", "R2", "R3"):
        risk_entry(planner_risk, level, "validation planner risk classification")
        risk_entry(workflow_planning, level, "workflow validation planning")
        if level not in pr_manifest:
            raise AssertionError(f"validation risk level {level} is missing from PR template")

    planner_r3 = normalized(
        risk_entry(planner_risk, "R3", "validation planner risk classification")
    )
    workflow_r3 = normalized(
        risk_entry(workflow_planning, "R3", "workflow validation planning")
    )
    for trigger in (
        "authentication",
        "authorization",
        "security controls",
        "trust boundaries",
        "secrets",
        "privacy",
        "rights",
        "commerce",
        "payments",
        "entitlements",
        "dependencies",
        "supply chain",
        "infrastructure",
        "destructive migrations",
        "data deletion",
    ):
        if trigger not in planner_r3 or trigger not in workflow_r3:
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
        "Base revision:",
        "scope",
        "behavior",
        "consumers/boundaries",
        "required",
        "selected",
        "not-applicable",
        "justified",
        "omissions",
        "SHA",
        "environment/configuration",
        "review scope",
        "expiration",
        "Escalation/replanning",
    ):
        if token not in pr_manifest:
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

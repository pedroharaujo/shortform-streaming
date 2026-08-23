# AI-native repository instructions

This repository uses Codex as the primary development environment and Cursor as a compatible environment. `ai/` contains the canonical role and workflow contracts; tool-specific files must remain thin adapters to those contracts.

## Source of truth

Read the smallest relevant set before acting:

1. `MICRODRAMA_IMPLEMENTATION_PLAN.md` for scope, phases, dependencies, and task IDs.
2. `docs/product/DECISION_REGISTER.md` for approval status. Do not implement behavior that depends on an unapproved decision.
3. `docs/product/MVP_PRODUCT_BRIEF.md` for MVP journeys and boundaries.
4. Applicable `docs/adr/*.md` records for architecture.
5. Applicable rights, store, privacy, security, and cost documents under `docs/product/`, plus `SECURITY.md` and `CONTRIBUTING.md`.

When documents conflict, the decision register and accepted ADRs govern. Do not silently resolve a material conflict; record it in the task and escalate it.

## Required multiagent workflow

- The primary agent acts as orchestrator and follows `ai/roles/orchestrator.md` and `ai/workflows/development-loop.md`.
- The orchestrator never implements or fixes production code. It delegates implementation to the `implementer` agent.
- The implementer never approves its own work.
- After implementation, use a fresh `reviewer` context and then a separate `verifier` context. Reviewer and implementer must never be the same agent thread.
- Blocking review findings return to the implementer. Repeat `implement -> review -> fix -> review` until no blocking findings remain, then run independent verification.
- A pull request is ready only after review is clear, verification evidence is recorded, and required CI checks pass.
- Prefer one write-capable agent at a time. Read-only investigation and review may run in parallel when their scopes do not overlap.

Codex project agents are defined in `.codex/agents/`. Cursor-compatible agents are in `.cursor/agents/`. The canonical behavior remains in `ai/roles/`.

## Task and state rules

- Every change must reference a GitHub issue or an explicit plan task ID.
- Required issue states are documented in `ai/STATES.md`: `ai-ready`, `ai-in-progress`, `ai-review`, and `ai-verified`.
- Do not start a task marked blocked or one whose dependencies/decisions are unresolved.
- Use a short-lived branch or isolated worktree; never implement directly on `main`.
- Keep one task per pull request unless the issue explicitly justifies a split or grouping.

## Validation commands

Run the checks relevant to the changed area and record exact commands/results in the pull request.

- Governance files: `python scripts/validate_ai_governance.py`
- Full repository gate when the bootstrap supports it: `pnpm check`
- Backend: `pnpm backend:lint`, `pnpm backend:format:check`, `pnpm backend:typecheck`, `pnpm backend:migrations:check`, `pnpm backend:test`
- API contract: `pnpm contract:check`
- Mobile: `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:test`, `pnpm mobile:config:check`

If a required command is unavailable or fails because scaffolding is incomplete, verification fails. Document the blocker; do not convert a missing check into a pass.

## Code Review Rules

- Flag implementation that is not traceable to acceptance criteria or an approved product/architecture decision. Safe path: link the task and governing document, or stop for approval.
- Flag any purchase, coin, reward, entitlement, or webhook path that lacks idempotency, transaction safety, authorization, and reconciliation coverage. Safe path: preserve ledger invariants and add failure/retry tests.
- Flag content delivery that ignores rights, territory, availability windows, takedown, or age-rating constraints. Safe path: enforce eligibility before returning playable media.
- Flag API/schema changes that can silently break the generated client. Safe path: update the OpenAPI schema and generated client together, and run `pnpm contract:check`.
- Flag secrets, licensed assets, confidential rates/contracts, provider payloads, or personal/production data in code, fixtures, logs, screenshots, or PR evidence. Safe path: use redacted, generated, or self-owned data.
- Do not approve with unresolved BLOCKER or MAJOR findings, failing/missing required tests, or verification performed only by the implementer.

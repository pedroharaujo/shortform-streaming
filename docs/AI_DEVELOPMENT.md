# Operating the AI-native development flow

Codex is the primary environment. Cursor uses the same canonical contracts through adapters. The workflow does not replace branch protection, CI, or human approval for product/legal decisions.

## Before starting

1. Create an issue with `.github/ISSUE_TEMPLATE/implementation-task.yml`.
2. Fill the plan ID, dependencies/decisions, acceptance criteria, validation, and risks.
3. Apply `ai-ready` only after its entry gate in `ai/STATES.md` is satisfied.
4. Start from `main` in an isolated branch/worktree named from the plan task.

## Codex (primary)

The root `AGENTS.md` is loaded automatically. Project-scoped custom agents are in `.codex/agents/`.

```text
Act only as orchestrator for issue #42. Follow ai/workflows/development-loop.md.
Confirm the ai-ready gate, then delegate implementation to implementer.
Use a fresh reviewer after implementation and a separate verifier after blocking findings are clear.
Return fixes to implementer and repeat until the final revision is independently verified.
Do not implement code in the orchestrator context and do not merge automatically.
```

Inspect subagent threads in the Codex app. In the CLI, use `/agent`. If custom agents do not appear, start a new session from the repository root so `.codex/agents/` and `AGENTS.md` are reloaded.

## Cursor (compatible)

Project agents are in `.cursor/agents/`, with an always-applied pointer in `.cursor/rules/ai-native-workflow.mdc`. Ask the main Cursor agent to act as orchestrator and explicitly delegate to `implementer`, `reviewer`, and `verifier`. Use separate/background agents or worktrees so review contexts do not inherit implementation reasoning.

Cursor Bugbot guidance is in `.cursor/BUGBOT.md`; Bugbot is an additional reviewer, never a replacement for verifier evidence or required checks.

## GitHub states and labels

`.github/labels.yml` is the declarative label source. Create/update the labels with GitHub CLI when repository administration is available:

```text
gh label create ai-ready --color 1D76DB --description "Approved and ready for AI implementation" --force
gh label create ai-in-progress --color FBCA04 --description "AI implementation is in progress" --force
gh label create ai-review --color D4C5F9 --description "Independent AI review/fix loop is active" --force
gh label create ai-verified --color 0E8A16 --description "Independent verification and required checks passed" --force
```

Only the orchestrator changes state labels. Follow the entry/exit gates in `ai/STATES.md`.

## Pull requests and verification

A draft PR may be opened during implementation. Mark it ready only when criteria map to evidence, no BLOCKER/MAJOR findings remain, the verifier tested the final revision, required CI passes, and deployment/rollback/documentation/sensitive-data checks are complete.

Run `python scripts/validate_ai_governance.py` after changing this infrastructure. The `AI governance` workflow runs the same deterministic validation and intentionally does not duplicate application CI. Enable the broader `pnpm check` application CI once every referenced bootstrap script is implemented and reproducible in CI.

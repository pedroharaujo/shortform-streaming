# Development loop

## Preconditions

- One issue or plan task with observable acceptance criteria.
- Applicable dependencies and decision-register entries approved.
- Validation plan and rollback/risk notes defined.
- Cleanly identified base revision and isolated branch/worktree.

## Loop

```text
ai-ready
  -> orchestrate
  -> ai-in-progress / implement
  -> self-check and hand-off
  -> ai-review / independent review
       -> BLOCKER or MAJOR? implementer fixes -> independent re-review
       -> clear? independent verify
  -> verification failure? implementer fixes -> independent re-review -> re-verify
  -> ai-verified
  -> finalize PR
```

The required order is **implement -> review -> fix -> verify -> PR**. `fix` and re-review repeat as many times as needed. A PR may be opened as a draft earlier for visibility, but it is not ready for approval until `ai-verified`.

## Hand-off contracts

- Orchestrator to implementer: task/plan ID, branch/worktree, objective, out-of-scope items, criteria, source documents, checks, and risks.
- Implementer to reviewer: final diff/revision, criteria mapping, commands/results, limitations, migrations/contracts/docs, deployment, and rollback notes.
- Reviewer to implementer/orchestrator: prioritized findings with location, evidence, impact, safe direction, and `APPROVE` or `CHANGES_REQUESTED`.
- Verifier to orchestrator: tested revision, criterion evidence, exact commands/results, limitations, and `VERIFIED`, `FAILED`, or `BLOCKED`.

## Stopping rules

- Stop for a human decision when product/legal/rights/market/price/budget scope is unapproved or contradictory.
- Stop on suspected secret, personal data, licensed asset, or confidential information exposure.
- After two failed fixes for the same finding, require a root-cause note and narrower plan before retrying.
- Never merge automatically unless repository protections and the task explicitly authorize it.

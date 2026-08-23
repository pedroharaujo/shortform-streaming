# Development loop

## Preconditions

- One issue or plan task with observable acceptance criteria.
- Applicable dependencies and decision-register entries approved.
- A proportional Validation Manifest and rollback/risk notes defined before implementation.
- Cleanly identified base revision and isolated branch/worktree.

## Validation planning

The orchestrator owns the Validation Manifest and usually prepares it directly. The optional, read-only `validation-planner` may advise only when scope is ambiguous, crosses component or contract boundaries, or has a sensitive trigger. Consulting it does not create a state transition or serial gate, and it does not replace review, verification, required CI, or human approval.

Classify the semantic impact at the highest applicable level; never classify only from file extension or path:

- `R0`: documentation or process only, without executable or configuration behavior change.
- `R1`: isolated module behavior with bounded consumers and no sensitive trigger.
- `R2`: API, database, schema, migration, generated contract/client, shared configuration, or cross-boundary integration.
- `R3`: authentication, authorization, secrets, privacy, rights, commerce, payments, entitlements, infrastructure, destructive migrations, or data deletion.

The manifest records:

- task ID and base revision;
- scope, intended behavior, affected consumers, integrations, and boundaries;
- risk level `R0`-`R3`, triggers, and rationale;
- every check or manual observation as `required`, `selected`, or `not-applicable`, with the command/observation and reason;
- core agents and any specialized reviews;
- omitted suites/platforms/reviews and their justification;
- any reused evidence with result, commit SHA, environment, configuration, review scope, run/time reference, and expiration condition;
- escalation and replanning conditions for scope growth, new consumers/boundaries, higher risk, material fixes, drift, stale evidence, or failure.

A required, missing, or failing check cannot become `not-applicable`. Independent review, independent verification on the final revision, and passing required CI are the mandatory baseline for every risk level.

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

## Proportional execution and evidence reuse

- The implementer runs the manifest's selected checks and records exact results.
- The reviewer inspects the task, diff, and evidence, then runs focused probes only when needed to investigate a finding or evidence gap; a full suite is not the default.
- The verifier works on the final reviewed SHA. It may inspect trustworthy CI evidence when the SHA, environment, configuration, review scope, and expiration condition match, and runs only the additional checks or observations needed for independent coverage. It does not repeat valid CI without a recorded reason.
- After a fix, rerun the affected checks. A material fix or elevated risk invalidates the related review, CI, or verification evidence and triggers replanning as applicable.

## Hand-off contracts

- Orchestrator to implementer: task/plan ID, branch/worktree, objective, out-of-scope items, criteria, source documents, and the Validation Manifest with checks and risks.
- Implementer to reviewer: final diff/revision, criteria mapping, commands/results, limitations, migrations/contracts/docs, deployment, and rollback notes.
- Reviewer to implementer/orchestrator: prioritized findings with location, evidence, impact, safe direction, and `APPROVE` or `CHANGES_REQUESTED`.
- Verifier to orchestrator: tested revision, criterion evidence, exact commands/results, limitations, and `VERIFIED`, `FAILED`, or `BLOCKED`.

## Stopping rules

- Stop for a human decision when product/legal/rights/market/price/budget scope is unapproved or contradictory.
- Stop on suspected secret, personal data, licensed asset, or confidential information exposure.
- After two failed fixes for the same finding, require a root-cause note and narrower plan before retrying.
- Never merge automatically unless repository protections and the task explicitly authorize it.

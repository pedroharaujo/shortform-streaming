# Agent instructions

Short Form Streaming is a public monorepo for a mobile-first vertical microdrama
platform: Django REST plus Django Admin, and one React Native/Expo app for iOS
and Android. A consumer web client is post-MVP.

Codex and Cursor share this file as the project instruction source. Generic
software-engineering methodology lives in the **Superpowers** plugin, not in
this repository. Do not copy Superpowers into the tree.

## Repository map

- `backend/` — Django/DRF modular monolith and backend tests
- `mobile/` — Expo/React Native development-client app
- `packages/api-client/` — generated OpenAPI TypeScript client
- `infra/` — environment and reusable infrastructure
- `docs/` — product, architecture decisions, API, runbooks, analytics
- `scripts/` and `tests/repository/` — repository-wide deterministic gates
- `MICRODRAMA_IMPLEMENTATION_PLAN.md` — delivery plan, phases, and task IDs

Human setup, bootstrap, and status: `README.md`. Contribution rules:
`CONTRIBUTING.md`. Documentation index: `docs/README.md`.

## Communication with the founder

Assume the founder is not a mobile-development specialist. In every chat and
handoff, use plain product language first.

- Lead with: **what the founder needs to do**, **what happens next**, and
  **what that step unlocks**. If no founder action is needed, say so clearly.
- Recommend one next action instead of presenting a long menu of technical
  choices. Make routine engineering and sequencing decisions without asking
  the founder to choose implementation details.
- Explain unavoidable mobile, backend, infrastructure, privacy, or store terms
  in one short sentence. Translate task IDs and acronyms into their practical
  meaning when first mentioned.
- Separate founder decisions from engineering work and from external blockers.
  Do not make a technical checklist look like work the founder must perform.
- Keep chat summaries short and outcome-focused. Put detailed commands, test
  evidence, and implementation notes in the issue or pull request unless the
  founder asks for them.

## Documentation authority

Read the smallest relevant set. Do not ingest the whole `docs/` tree by default.

```text
Product requirements / feature specifications
                ↓
Architecture decisions
                ↓
Implementation plans
                ↓
Code
```

1. **Product:** `docs/product/MVP_PRODUCT_BRIEF.md`,
   `docs/product/DECISION_REGISTER.md`, plus applicable rights, store, privacy,
   security, and cost documents under `docs/product/`, `SECURITY.md`, and
   `CONTRIBUTING.md`.
2. **Architecture:** accepted records in `docs/adr/`.
3. **Delivery plan:** `MICRODRAMA_IMPLEMENTATION_PLAN.md` for task IDs,
   sequencing, and per-task acceptance. Runbooks may contain historical
   implementation evidence; that evidence is not a current product requirement.
4. **Code** implements the documents above.

If a plan conflicts with an authoritative specification or approved decision,
the specification or decision wins. If code conflicts with an approved product
requirement, treat the requirement as intended behavior unless it is explicitly
superseded. Do not implement behavior that depends on an unapproved
decision-register entry.

## Project constraints

- Public repository: never commit secrets, licensed media, confidential
  contracts or rates, provider payloads, or personal/production data. Use
  redacted, generated, or self-owned fixtures.
- Work on a short-lived isolated branch from `main` in this checkout. Do not
  create extra git worktrees. One task per pull request unless the issue
  explicitly justifies grouping.
- Every change should reference a GitHub issue or an explicit plan task ID.
- Do not add a consumer web frontend during MVP.
- Do not serve video bytes through Django.
- Do not trust the mobile client for purchases, coin balances, rewarded-ad
  grants, or entitlements.
- Do not weaken rights, territory, availability-window, takedown, age-rating,
  authorization, or playback-authorize checks.
- Database changes use expand/migrate/contract; destructive contraction is a
  separate release.
- When architecture is already approved and the only question is now versus
  later, choose the smaller mergeable slice, document the deferral, and open a
  follow-up. Do not ask the founder to pick that sequencing. Still stop for
  unapproved product, legal, rights, market, price, or budget scope.
- Stop on suspected secret, personal data, licensed-asset, or confidential
  exposure.
- Never merge automatically.
- An unavailable required check is never a pass. It blocks the current merge unless
  the founder has explicitly deferred that device/manual/provider check under D-029
  to the consolidated P6-T03 final validation pass. Record the deferral and keep the
  capability disabled or fail-closed. Never defer checks that protect secrets or
  personal/licensed data, authorization/entitlements, financial integrity,
  destructive migrations/data, or production activation.

## High-risk surfaces

Unless the user explicitly asks for a lighter workflow, treat these as large /
risky work: authentication, authorization, playback and content eligibility,
purchases, coins, rewards, entitlements, webhooks, subscriptions, the streaming
pipeline, schema or migrations, infrastructure, privacy or account deletion,
and changes that span backend and mobile.

For those paths, reviews and tests must cover:

- idempotency, transaction safety, authorization, and reconciliation for
  purchase, coin, reward, entitlement, and webhook flows;
- eligibility before returning playable media;
- OpenAPI schema and generated client updated together (`pnpm contract:check`);
- no secrets, licensed assets, confidential data, or provider payloads in code,
  fixtures, logs, screenshots, or PR evidence.

## Commands

Run the checks relevant to the changed area and record exact commands and
results.

- Governance files: `python scripts/validate_ai_governance.py`
- Full repository gate when the bootstrap supports it: `pnpm check`
- Backend: `pnpm backend:lint`, `pnpm backend:format:check`,
  `pnpm backend:typecheck`, `pnpm backend:migrations:check`, `pnpm backend:test`
- API contract: `pnpm contract:check`
- Mobile: `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:test`,
  `pnpm mobile:config:check`

Testing policy is in `CONTRIBUTING.md`: one test at the highest level that
would catch the bug; do not stack client, screen, and smoke coverage for the
same outcome.

## Development workflow

Use the lightest workflow that provides sufficient confidence for the task.

Superpowers is available for substantial engineering work, but it must not be
used automatically for every interaction.

### Direct Codex / Cursor workflow

Do not invoke the full Superpowers development workflow for:

- exploratory questions
- codebase questions
- explaining existing behavior
- quick experiments
- trivial fixes
- copy or text changes
- simple test changes
- isolated mechanical refactors
- obvious one-file changes
- small configuration changes
- tasks the user explicitly asked to be done directly

For these tasks:

1. Inspect the relevant code.
2. Make the smallest appropriate change.
3. Run the relevant tests and checks.
4. Report the result.

Do not create unnecessary plans, specs, agents, worktrees, or review loops.

### Superpowers workflow

Use Superpowers when the work is substantial enough to benefit from structured
planning and independent verification.

Examples include:

- new product features
- new subsystems
- architectural changes
- multi-module changes
- significant refactors
- non-trivial debugging
- database or schema changes
- authentication or authorization changes
- payment or subscription changes
- streaming architecture changes
- infrastructure changes
- changes affecting both backend and mobile
- high-risk behavior
- work with multiple independent implementation tasks

For these tasks, use the relevant Superpowers workflow for requirements
clarification, design, planning, task decomposition, implementation, testing,
review, and final verification.

Project constraints in this file override Superpowers defaults. In particular,
stay in this checkout and do not create extra git worktrees. Follow
`CONTRIBUTING.md` for test layering rather than multiplying equivalent suites.

Install Superpowers in each agent harness; do not vendor it here. Operating
notes: `docs/AI_DEVELOPMENT.md`.

### Explicit user override

The user's explicit instruction always wins.

Examples:

- "Do this directly, no Superpowers." → work directly.
- "Use Superpowers for this feature." → use Superpowers.

Do not override an explicit workflow request based only on your own complexity
assessment.

## Task complexity

### Level 1 — Small / direct

Examples: typo, serializer field, test assertion, obvious bug, small query
change, tiny UI adjustment.

```text
inspect → modify → test → done
```

No formal planning required.

### Level 2 — Normal feature

Examples: contained API feature, one screen plus API support, moderate
business-rule change, small integration.

```text
understand → lightweight plan → implement → test → review
```

Superpowers may be used selectively if useful. Avoid unnecessary agent
fan-out. Batch small related tasks where appropriate.

### Level 3 — Large / risky

Examples: payment system, subscription architecture, authentication, streaming
pipeline, major schema migration, cross-platform feature, infrastructure
redesign, large refactor.

```text
spec / clarify → design → implementation plan → dependency-aware tasks
→ isolated implementation → review → fixes → final verification
```

Use the appropriate Superpowers workflow. Parallel execution only when tasks
are genuinely independent. Do not create artificial parallelism.

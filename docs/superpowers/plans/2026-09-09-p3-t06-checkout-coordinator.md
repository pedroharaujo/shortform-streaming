# Dormant Android checkout coordinator implementation plan

> **For agentic workers:** Use Superpowers subagent-driven-development and TDD.
> This checkout only; no extra worktrees. Root owns Git operations.

**Goal:** Implement checkout identity, price confirmation and interruption safety
behind a disabled shipped factory, using synthetic integrations (P3-T03/T06 #142).

**Architecture:** Generated-contract client, serialized SecureStore attempt marker,
and one process-wide checkout coordinator with an injected provider. The backend
remains financial authority. No real SDK or production activation is introduced.

**Tech stack:** TypeScript, Expo SecureStore, generated OpenAPI, Jest.

## Global constraints

The companion specification is authoritative for this task's exact invariants.
Follow AGENTS.md and CONTRIBUTING.md. User authorizes agent-reviewed, validated
merges and continued implementation until a blocker. Commercial/privacy/provider
approvals are not implied. No other feature, package, backend or schema changes.

### Task 1: Implement the dormant orchestration boundary

Suggested files: `mobile/src/api/purchases/purchaseCheckoutClient.ts` and checkout
types; `mobile/src/features/purchases/{checkoutCoordinator,pendingPurchaseAttempt,
types,createAppCheckoutCoordinator}.ts`; focused integration tests. Modify the app
client factory for authenticated/attested checkout reads. Keep history behavior
and existing WalletScreen unchanged. Do not activate a route or purchase button.

Interfaces: controller exposes async `load()`, `purchase(productId)`, `sync()`;
state discriminates unavailable, busy, session_changed, storage_unavailable,
ready/offers, awaiting_verification, cancelled, credited, review_required.
Credited includes historical quantity and safe reference plus separately refreshed
wallet or unavailable wallet state. Public states contain no raw transaction.
Provider and storage contracts should be small and explicit; choose routine
internal signatures to satisfy the spec. Default app factory always unavailable
without constructing dependencies; tests explicitly inject synthetic mode.

- [ ] Write failing integration tests for the spec's highest-risk behaviors.
- [ ] Implement client/marker/coordinator and disabled factory.
- [ ] Run focused tests then all mobile static/config/tests and Android JS bundle.
- [ ] Write exact evidence to `.tmp/checkout-implementation-report.md`; freeze source.

### Task 2: Review and merge

- [ ] Root updates delivery/runbook status with exact limitations and test evidence.
- [ ] Independent reviewer assesses full diff and spec; validator reruns relevant
      privacy/financial/session/storage regressions and repository/contract gates.
- [ ] Resolve findings and require passing current-head GitHub CI before merge.
- [ ] Record the next genuine provider integration/reconciliation prerequisite in
      the delivery plan, referencing #142 and keeping full P3-T03/T06 acceptance
      incomplete. Preserve the founder's closed issue state.

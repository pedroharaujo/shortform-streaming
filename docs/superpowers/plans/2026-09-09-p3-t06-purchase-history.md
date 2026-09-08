# Recent verified purchase recovery implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement
> this plan task by task, in this checkout without extra worktrees.

**Goal:** Recover verified purchase history and support references on Android
without device-retained store transaction IDs (P3-T06 / #142).

**Architecture:** A bounded read-only owner-scoped Django projection feeds a mobile
screen through the generated API contract. Existing purchase activation and session
guards remain authoritative.

**Tech stack:** Django/DRF, OpenAPI, TypeScript, Expo/React Native.

## Global constraints

Follow AGENTS.md, CONTRIBUTING.md and the companion specification. Public synthetic
fixtures only. No production activation, provider calls, new financial mutations,
schema migrations, local purchase persistence, or entitlement authority. Root owns
branch/commit operations. User authorized agent-reviewed and validated merges on
2026-09-08; this supersedes the repository's default manual-merge instruction for
this session.

### Task 1: Bounded owner-scoped history API

Files: `backend/apps/commerce/{reads,serializers,views,urls}.py`,
`backend/tests/commerce/test_purchase_history.py`, generated OpenAPI and TS schema.

Implement `GET /v1/purchases/history` exactly as in the companion specification.
Response: `{purchases: [{recorded_at: ISO datetime, historical_credited_coins:
positive bounded integer, support_reference: UUID, status: credited|review_required}],
has_more: boolean}`. At most 20 rows. Reject unexpected query fields with 400.
Use one annotated query for rows and their quarantine state, selecting at most 21
to calculate `has_more`. Hold the current profile lock as existing purchase reads do.
No filtering by current registry; no raw store or provider fields returned.

- [ ] Write and run failing integration tests for required evidence in the spec.
- [ ] Implement the read, strict output contract, route and OpenAPI documentation.
- [ ] Generate the contract and run commerce tests and backend static gates.
- [ ] Report exact tests and changes to `.tmp/purchase-history-backend-report.md`.

### Task 2: Android recent-purchases screen

Files: new `mobile/src/api/purchases/{types,purchasesClient}.ts`,
new `mobile/src/features/wallet/PurchaseHistoryScreen.tsx` and tests,
new `mobile/app/purchases.tsx`, existing wallet route/screen, app client factory,
and localization messages.

Consume Task 1 contract through `createPurchasesClient(...).getHistory()` and
`createAppPurchasesClient()`. Validate success data at runtime including <=20 rows,
unique UUID references, positive bounded coin integers, recognized status,
valid ISO datetime and boolean `has_more`; malformed data is unavailable. Never
surface reflected errors/provider fields. Use the real API wrapper in screen
integration tests; do not duplicate the same behavior at multiple test layers.
The wallet link opens `/purchases`. The new screen retains normal account/back
navigation, session guards and authoritative refresh patterns.

- [ ] Add failing screen integration tests covering the specification.
- [ ] Implement wrapper, screen, route, wallet link and English messages.
- [ ] Run all mobile gates and Android JavaScript bundle check.
- [ ] Report exact tests and changes to `.tmp/purchase-history-mobile-report.md`.

### Task 3: Review, validate and merge

- [ ] Update delivery status and runbook with exact evidence and deferred checks.
- [ ] Run the full repository gate and independent code review and validation.
- [ ] Resolve findings, publish one PR referencing #142, require passing CI on its
      reviewed head, then merge using the user's standing authorization.
- [ ] Keep #142 open and record native checkout as remaining work.

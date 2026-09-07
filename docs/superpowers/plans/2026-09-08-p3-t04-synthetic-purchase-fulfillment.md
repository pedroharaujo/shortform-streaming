# Synthetic purchase fulfillment implementation plan

> **For agentic workers:** Use Superpowers executing-plans within the assigned checkout. Root owns independent review and branch completion.

**Goal:** #142 / P3-T03/T04: authenticated synthetic Android purchase events fund an opaque wallet once.

**Architecture:** A strict settings registry maps synthetic products to server coin snapshots. Authenticated callbacks normalize only necessary values, serialize event and transaction identities, then account lifecycle and wallet writes. Immutable receipts and database constraints preserve decisions.

**Tech Stack:** Django, DRF, PostgreSQL, pytest, existing generated OpenAPI client.

## Global constraints

- Disabled by default; test mode requires DEBUG; production rejects activation.
- Synthetic data only. No native purchase UI, provider setup, live prices, refund compensation or production activation.
- No git/worktree operations by the implementation agent. Root coordinates shared backend ownership and independent security review.

## Task 1: Registry and callback boundary

Files: new `backend/apps/commerce/{configuration,verification}.py`, `backend/tests/commerce/test_verification.py`.

- [x] Add failing tests for exact registry scope, invalid quantities, missing configuration, strict signature format, body tampering, stale timestamp and duplicate JSON keys.
- [x] Implement `load_products(value)`, `authenticate(raw, authorization, signature, now)` and `normalize(raw)` with bounded inputs and generic failures.
- [x] Run `uv run pytest backend/tests/commerce/test_verification.py`; all cases must pass without database access.

## Task 2: Identity and immutable fulfillment

Files: new `backend/apps/commerce/{models,services}.py`, migrations and `backend/tests/commerce/test_fulfillment.py`.

- [x] Add tests for `purchase_identity(profile)` stability/deletion and `fulfill(event)` once-only credit, altered event/transaction conflicts, refund ordering, rollback, registry snapshots and concurrency.
- [x] Add unique opaque identity, transaction decisions and event receipts; immutable guards verify receipt credit amount/wallet/reference and block history mutation.
- [x] Acquire advisory event then transaction lock before account deletion lock and wallet row lock. Unknown state quarantines; database errors propagate for retry.
- [x] Run focused PostgreSQL tests after root releases backend ownership.

## Task 3: Disabled API and integration verification

Files: new commerce views/serializers/urls and runbook; settings/base and production, urls, exact App Check exemption; contract artifacts; mechanical cross-app migration-test target adjustment.

- [x] Add authenticated identity POST and provider-authenticated callback POST; responses expose safe support UUID/status/reason only.
- [x] Add integration tests for Firebase ownership, exact App Check exemption, raw-body privacy, production gate and migration preservation.
- [x] Run `pnpm backend:lint`, `pnpm backend:format:check`, `pnpm backend:typecheck`, `pnpm backend:migrations:check`, `pnpm backend:test`, `pnpm contract:check`.
- [x] Record actual evidence and remaining #142 native/provider/refund-policy gates in the runbook. Request root's independent financial/security review; fix findings before PR completion.

## Final verification and review — 2026-09-08

Exact commands are recorded in [the runbook](../../runbooks/synthetic-purchases.md).
All 479 backend tests and quality/migration checks passed. A final registry/OpenAPI
subset passed 28 tests after the last response-description clarification. Root
independently passed `pnpm contract:check` with the final artifacts staged.

Independent financial/security and specification review identified a transaction
namespace defect during development. Immutable RevenueCat-to-Google application
bindings, Google application transaction keys and retained unknown-app barriers
fixed it; regressions cover app replacement and cancellation before registration.
Final code review found no remaining actionable findings. Root also inspected
the service, verification, settings, guards and runbook; the disabled synthetic
scope matches the design. No native/provider or release check is claimed complete.

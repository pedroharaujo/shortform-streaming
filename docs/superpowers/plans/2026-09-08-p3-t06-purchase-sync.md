# Purchase synchronization implementation plan

> **For agentic workers:** Use Superpowers executing-plans in this checkout;
> use requesting-code-review for independent verification before completion.

**Goal:** Deliver #142 / P3-T06's owner-scoped synthetic purchase catalog and
verification status contract, required before safe native checkout.

**Architecture:** Read existing validated configuration and immutable purchase
decisions through authenticated DRF views. Reuse account lifecycle locking and
the fulfillment transaction namespace. Do not write financial state.

**Tech Stack:** Django/DRF, PostgreSQL, pytest, generated OpenAPI/TypeScript.

## Global constraints

Same checkout, isolated branch from main, no automatic merge. Synthetic local
mode only. Preserve all financial, privacy, identity and playback boundaries in
the [specification](../specs/2026-09-08-p3-t06-purchase-sync.md). No real products,
native activation or refund-policy assumptions.

## Task 1: Read contract and integration tests

Files: `backend/tests/commerce/test_purchase_sync.py`,
`backend/apps/commerce/reads.py`, `serializers.py`, `views.py`, `urls.py`.

Interfaces: `purchase_catalog(profile, *, application_id)` returns public product
dicts; `purchase_status(profile, *, application_id, product_id, transaction_id)`
returns status, historical credited coins and nullable support UUID.

- [x] Add HTTP integration tests that fail on the missing routes. Known owner
  callback then status must return `credited` and 13 historical coins; the same
  query as another account must equal an unknown transaction response.
- [x] Run `uv run pytest backend/tests/commerce/test_purchase_sync.py -q` and
  verify missing-route failures before implementing.
- [x] Add strict request serializers and bounded response serializers. Reject
  extra owner/coin/environment fields and malformed/oversized identifiers.
- [x] Implement catalog filtering and immutable application-binding checks;
  status uses `digest([application_id, "PLAY_STORE", "SANDBOX",
  digest(transaction_id)])` plus owner and product filtering. Lock the current
  profile during reads to serialize account deletion. Never create a wallet.
- [x] Add routes with explicit OpenAPI responses and no-store successful results.
- [x] Run the focused suite; test callback retry, refund review, changed registry,
  stale/deleted/replaced accounts, disabled mode and App Check before proceeding.

## Task 2: Contract, handoff and verification

Files: `docs/api/openapi.yaml`, `packages/api-client/src/generated/`,
`docs/runbooks/synthetic-purchases.md`, `README.md`,
`MICRODRAMA_IMPLEMENTATION_PLAN.md`, `docs/runbooks/final-validation.md`.

- [x] Generate both contracts with `pnpm contract:generate`, stage artifacts,
  and pass `pnpm contract:check` without drift.
- [x] Update stale completion text and document exact API meaning, remaining
  native/provider work and reproducible final validation.
- [x] Run `pnpm check` against disposable local PostgreSQL; record exact output.
- [x] Request independent code/financial/security review against the spec while
  completing the handoff. Resolve blocking findings and rerun affected checks.
- [x] Prepare the focused branch and evidence for human review; never merge.

## Verification result

`pnpm check` passed: 50 repository tests, 521 backend tests, 232 mobile tests,
all quality/configuration checks and generated-contract consistency. The focused
suite has 30 passing tests. Independent financial/security review found one
identifier-boundary mismatch, fixed and verified by a failing-then-passing
regression; review completed with no remaining findings. A transient Windows
mobile-test warning cleared on a targeted serial rerun (30 tests). Exact evidence
and outstanding native/provider gates are in
[the runbook](../../runbooks/synthetic-purchases.md#purchase-synchronization-verification-2026-09-08).

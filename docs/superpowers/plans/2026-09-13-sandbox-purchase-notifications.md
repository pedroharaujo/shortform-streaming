# Sandbox Purchase Notifications Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this focused task. Stay in this checkout; do not create worktrees.

**Goal:** Verify and credit approved sandbox purchases while the app is closed.

**Architecture:** Extend the existing callback with a separately disabled local
sandbox gate. Reuse exact-body authentication, fresh v2 verification and immutable
fulfillment; signed cancellations establish review barriers immediately.

**Tech Stack:** Django/DRF, PostgreSQL, RevenueCat webhooks and v2 API.

## Global constraints

- Issue #169 / P3-T04, ADR 0006, D-036; no production activation or refund policy.
- No raw provider payloads, private identifiers or credentials in durable evidence.
- Financial/authorization/privacy tests cannot be deferred.
- Implement the matching specification; no new database schema is required.

## Task 1: Authenticated sandbox notification handling

Files: `backend/apps/commerce/views.py`, `verification.py`, a focused callback
service module if useful, configuration/settings and `.env.example`; backend
commerce/configuration tests. No mobile API contract change is expected.

- [x] Write failing backend API tests for genuine-mode gating and fresh positive verification.
- [x] Add bounded notification parsing and independently gated sandbox dispatch.
- [x] Reuse original normalized event keys and existing locks/fulfillment.
- [x] Cover authentication, malformed bodies, identity/scope mismatch, deleted
  owner, aliases, unknown events, retry/outage, duplicate/concurrent sync and
  both refund orders at the highest relevant backend layer.
- [x] Run focused tests, then backend checks, contract and repository foundation.
- [x] Independently review correctness, security, financial integrity, simplicity
  and bounded provider I/O. Fix findings and rerun affected checks.

## Task 2: Delivery and genuine-provider validation record

Files: `docs/runbooks/revenuecat-sandbox.md`, `final-validation.md`,
`MICRODRAMA_IMPLEMENTATION_PLAN.md` and the issue/PR.

- [x] Document exact local enablement, required HMAC/dashboard fields and retry
  behavior. Keep real provider evidence private and provider steps unchecked.
- [ ] Record actual automated results and independent review in the PR.
- [ ] Confirm all required CI at the reviewed commit, merge under the founder's
  explicit authorization, then fast-forward local main.

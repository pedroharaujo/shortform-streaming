# RevenueCat sandbox transaction reconciliation

**Goal:** Implement the server verification step of the approved D-036 Android
journey, under P3-T04/P3-T06 and issue #164.

**Architecture:** An authenticated `POST /v1/purchases/sync` resolves one known
Google Play order through RevenueCat v2, then feeds verified facts into the
existing atomic purchase fulfillment service. `/status` remains read-only.

**Tech stack:** Django/DRF, PostgreSQL, Python HTTPS client, generated OpenAPI
TypeScript client. No database migration or native SDK activation.

## Global constraints

- Only explicit local `revenuecat_sandbox` mode with DEBUG enabled may reconcile.
  Production settings continue rejecting purchase activation.
- Client-supplied identity, amounts, environment and provider results never grant
  credit. Require the server purchase UUID as both current and original customer,
  exact registered app/package/SKU, sandbox Google Play, purchased ownership and
  quantity one. Prices remain the store's responsibility.
- Reuse immutable ledger fulfillment and transaction locking; callback and sync
  retries must credit a store transaction at most once.
- Provider requests run outside financial transactions. Account deletion must
  prevent credit. Missing, malformed, ambiguous and transient responses cannot
  permanently quarantine a transaction or prove a purchase failed.
- Refund evidence retains review state; do not invent D-008 compensation rules.
- Never persist or log credentials, raw order identifiers, provider payloads or
  private customer data. Tests use generated fixtures only.
- This resolves a known transaction. It does not recover an unidentified mobile
  attempt after process loss, enable checkout or complete the real device journey.

## Implementation

1. **Provider adapter (independent task):** add `commerce/revenuecat.py` and its
   focused tests. Interface `lookup_purchase(Product, transaction_id, owner_id)`
   returns `Event | None`. Use fixed HTTPS host, bounded responses, timeouts and
   no redirects. Resolve purchase and expanded product/app; normalize stable
   provider facts into the existing webhook transaction namespace. Test malformed
   data, ownership/scope/state mismatches, transport boundaries and stable retries.
2. **Server integration:** first add failing endpoint and configuration tests.
   Extend registry validation with an explicit D-036 sandbox scope, add private
   provider settings and authenticated sync route. Find the existing account
   purchase identity, fetch provider evidence outside locks, fulfill, then return
   the existing owner-scoped status shape. Test no identity/no provider work,
   duplicate sync/callback and concurrent delivery, failure then recovery, refund
   review, deletion during lookup and disabled/production gates.
3. **Contract and handoff:** regenerate OpenAPI/client, document private sandbox
   setup and the remaining native recovery/provider checks. Keep issue #164 open.
4. **Verification:** focused tests during implementation, full backend checks,
   repository and contract checks, mobile checks for generated-client compatibility,
   independent review. Open a focused PR with exact evidence; do not merge.

## Progress

- Design implements accepted ADR-0006 and D-036; no new commercial decision.
- Provider adapter, server integration, contract and runbooks implemented.
- Full local gate passed: 611 backend, 359 mobile and 50 repository tests.
- Review identified the documented explicit `consumable` product type alongside
  `one_time`. Added compatibility without accepting conflicting metadata; three
  regression cases failed before the fix. All 191 commerce tests and backend
  lint/format/types pass afterward. Final independent review and GitHub checks
  are pending at PR preparation.
- Genuine provider/device evidence unavailable; no activation claimed.

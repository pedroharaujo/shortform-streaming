# Android sandbox lifecycle validation

Scope: P3-T04/P3-T06, D-036, following the three genuine no-charge purchases.

## Findings and boundaries

Known-result recovery passed after backend outage and device-process restart.
Before the native result is saved, the local attempt has no store order binding.
The installed RevenueCat Android adapter supplies the order on purchase success;
its account history is not proof that a particular interrupted attempt completed.
Do not clear an unknown marker using timestamps, balance changes or history deltas.
Exact unknown-attempt resolution remains a separate engineering requirement.

RevenueCat's test project has no active integrations. Its callback handler already
requires Authorization and HMAC, fresh provider verification for positive events,
and immediate review barriers for signed refunds. The local backend is not an
approved public server. The existing rewarded-ad bridge accepts only GET and
cannot carry RevenueCat's signed JSON POST body.

## Implementation and verification

1. Add a separate short-lived loopback purchase callback bridge using the existing
   bridge's bounded socket lifecycle, no-log responses and automatic expiry.
   Permit only exact POST `/v1/purchases/revenuecat`; preserve raw JSON bytes and
   the two authentication headers. Reject ambiguous framing, queries, alternate
   paths and methods. Never expose Django response bodies, headers or redirects.
2. Test through real local HTTP sockets: byte preservation, header isolation,
   malformed/duplicate framing, size limits, expiry/rate limit, slow body/upstream,
   no logs, and fail-closed upstream errors. Re-run existing callback/authentication
   and financial lifecycle tests. Obtain scoped independent review.
3. Prepare a sandbox-only, Play-app-only RevenueCat webhook form. Before activation,
   obtain explicit approval for the temporary external callback route and its
   credential setup; verify tunnel capture/exports with harmless probes. Expose
   only the bridge, with a supervised expiry and no auto-restart. Production stays off.
4. Verify genuine TEST delivery, purchase delivery/replay and refund quarantine.
   Preserve all package values and balances except verified existing ledger logic.
   D-008 refund settlement/coin clawback terms remain unapproved.

Reference: https://www.revenuecat.com/docs/integrations/webhooks

## Validation checkpoint, 2026-09-20

- First transport regression failed with HTTP 404 before implementation. Review
  then found the runbook's incorrect route; the new Django URL regression failed
  before the route correction and passed afterward.
- `uv run pytest backend/tests/commerce backend/tests/advertising/test_callback_bridge.py
  -q -p no:cacheprovider --tb=short`: 297 passed. The final set includes 38 purchase
  bridge checks; independent review reran those 38 and found no remaining issues.
- `pnpm backend:lint`, `pnpm backend:format:check`, `pnpm backend:typecheck`,
  `pnpm backend:migrations:check`, `pnpm contract:check`, `git diff --check`: passed.
- A temporary loopback probe against the current disabled callback backend
  confirmed admin and purchase-sync paths return empty 404, while the callback
  remains empty/retryable 503. The probe receiver was stopped afterward. No
  external tunnel or callback integration has been activated.
- Wallet check remained 299 coins, three purchase credits, one one-coin debit,
  one unlock receipt and one entitlement.
- The unsaved RevenueCat form selects Sandbox only, the Play test app, and only
  Cancellation/Non renewing purchase event types. Public URL and credentials are
  still absent. Next action requires approval for a supervised temporary ngrok
  route and dedicated sandbox webhook credentials; verify cloud request capture
  and log exports before carrying any genuine callback.

The unknown-attempt gap is not fixed by this bridge. No attempt marker was reset,
and no claim of genuine callback/refund delivery or release readiness is made.

## Provider validation checkpoint, 2026-09-20

The founder approved one supervised 30-minute receiver and dedicated credentials.
Signed provider TEST and genuine sandbox refund deliveries returned HTTP 200.
The refund was quarantined as `refund_after_credit`; two live reconciliations and
known-result recovery preserved `review_required`, all ledger rows, and balance
299. The transport and local callback gate have now been stopped/disabled.
The earlier checkpoint above describes the pre-activation state. See
[Android evidence](../../runbooks/android-play-registration.md) for current scope
and remaining positive-delivery/replay/outage/interruption gates. Refund policy
and production activation remain unapproved; no release readiness is claimed.

A second approved window subsequently verified a genuine fourth purchase with
the local server stopped, manual RevenueCat retry after restoring it, and credit
while the app was confirmed stopped (299 to 399 coins, exactly four credits).
Cold launch and Check purchase cleared the saved purchase marker without another
credit. Successful HTTP-delivery replay/reordering, automatic retry timing and
provider-API outage are distinct remaining gates. No unknown marker was reset.

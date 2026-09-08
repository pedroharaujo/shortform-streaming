# #142 / P3-T03, P3-T04: synthetic Android purchase fulfillment

Implement a disabled-by-default, local synthetic foundation for authenticated
RevenueCat purchase events and once-only wallet credit. No real products, prices,
provider setup, refund-after-spend rules or production activation are approved.
This is a related registry/verification/fulfillment slice within #142; native
offering/checkout and genuine provider observations remain dependent work.

Use a new commerce backend module and existing account/wallet locking and ledger.
No balance editor, client credit API, user-supplied owner, subscription or Apple
support. No raw provider bodies, headers, personal attributes, token or receipt
data in logs/fixtures/evidence. Tests use wholly generated data.

## Contract and safety

- Configuration: `COIN_PURCHASE_MODE=disabled|test`, default disabled; test requires
  DEBUG and production rejects it. Registry entries bind exact RevenueCat app ID,
  Google application identity, PLAY_STORE, SANDBOX, consumable product ID, positive
  server-owned coins per single unit, store price source, finance-owner role and
  approval reference; synthetic-only. Reject missing, unknown, duplicate or wrong
  scope inputs. Do not infer product values or overwrite historic coin snapshots.
- An authenticated identity operation supplies a server-generated unpredictable
  RevenueCat app-user ID permanently bound to an opaque wallet. Never use Firebase
  UID or client-supplied identity; never reassign a detached wallet after deletion.
- Authenticate callbacks before parsing JSON: constant-time configured Authorization
  AND HMAC-SHA256 signature over timestamp + period + exact raw body, with bounded
  timestamp skew. Bound headers/body and reject ambiguous duplicate JSON keys.
  Retry signatures have fresh timestamps; event IDs persist. Unknown JSON fields
  may be ignored, never persisted. Callback authentication remains independent of
  user/App Check authentication; any exemption must be exact path/method only.
- Normalize only necessary fields. Retain immutable event receipt/fingerprint and
  immutable purchase credit receipt, with safe support UUID/status/reason and the
  chosen registry coin snapshot. Model event identity independently from transaction
  identity: one store application/store/environment/transaction can credit once,
  regardless of changed event ID, product or owner. Conflicts quarantine.
- Fulfill only known `NON_RENEWING_PURCHASE`, PLAY_STORE, SANDBOX consumables, exact
  owned server identity and single-unit purchase (quantity absent or integer 1).
  Subscription, temporary entitlement, TEST, transfer, virtual-currency or pending/
  failed/cancelled events never credit. Unknown/deleted/alias conflict quarantines.
- Serialize lifecycle updates with the account deletion lock and wallet lock.
  Atomically persist verified credit plus its receipt; rollback on any failure.
  Database constraints/guards must prevent duplicate credit and mutation. Retryable
  failures must not be acknowledged as successful fulfillment.
- Refund/cancellation before purchase must block a later purchase credit. After
  credit it produces an unresolved quarantine/reconciliation record, without
  invented compensation or negative balances. No refund resolution activation.
- Native RevenueCat SDK owns store verification/acknowledgement/consumption when
  integrated. Django must not consume or acknowledge Google transactions twice.

## Verification

Tests must cover auth/body tampering/stale timestamps, bounds and duplicate keys;
configuration/product/app/store/environment/owner/quantity rejection; duplicate
event and different-event same-transaction concurrency; rollback; deletion race
and account replacement; refund before/after purchase; historical registry snapshot;
production gate; additive migration and immutable financial history; safe logging.
Generate OpenAPI/client together and run backend/contract checks. Independent
financial/security review is required before PR completion. Keep #142 open for
native/provider lifecycle, approved refund policy, support and release evidence.

## Primary provider references verified 2026-09-08

- [Webhook authorization, signatures and retry behavior](https://www.revenuecat.com/docs/integrations/webhooks)
- [Event types and fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)
- [Identity and alias behavior](https://www.revenuecat.com/docs/customers/identifying-customers)
- [Native purchase ownership](https://www.revenuecat.com/docs/getting-started/making-purchases)

HMAC secret rotation immediately invalidates the old provider secret; no overlap
claim is made. Actual credential/retention/provider approval remains #101/D-020.

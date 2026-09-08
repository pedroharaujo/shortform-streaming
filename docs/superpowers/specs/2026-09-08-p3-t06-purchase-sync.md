# Purchase synchronization contract

Issue #142; P3-T06 prerequisite to native Android checkout. Existing product
approval is D-008's synthetic configurable implementation, with the financial
authority defined in ADR 0006. No new commercial or refund policy is introduced.

The latest main includes #143 (wallet), #145 (wallet/unlock UI), #147 (interrupted
unlock recovery), and #148 (synthetic verified funding). #146 is still separate
staging work and is not included. The old Graphify graph is useful for navigation
but predates these merges; current source and issue #142 determine this slice.

## Design

Before native checkout can safely consume #148, it needs approved product
quantities and a way to distinguish its transaction from unrelated balance
changes. Implement two authenticated POST operations in the existing commerce
module. Both require local DEBUG plus synthetic purchase mode and retain Firebase
and App Check enforcement. Both use no-store responses.

- `/v1/purchases/catalog`: accepts exactly `application_id`, returns bounded
  registered synthetic consumables for that Android application. Return product
  ID, coins, store, environment, product type and store price source; no money,
  approval reference, provider app ID, credentials or identity. A persisted
  application binding that conflicts with configuration makes the catalog
  unavailable. Unknown applications are unavailable. Reads do not bind identities.
- `/v1/purchases/status`: accepts exactly application ID, product ID and store
  transaction ID in the body, never the URL. Hash the transaction using the
  fulfillment namespace (Android application / PLAY_STORE / SANDBOX / hashed
  transaction ID). Require the decision's identity to belong to the freshly
  locked authenticated profile and match the requested product. Return
  `awaiting_verification` for missing, foreign, mismatched and unattributed
  quarantined transactions with zero historical credit and no reference.
  Owned credited decisions return historical credited coins and the decision UUID.
  Any quarantined event on that decision returns `review_required`; subsequent
  successful retries cannot hide review. Otherwise return `credited`.

Status reads remain valid if the product is removed or repriced. They neither
create accounting nor modify quarantine, and cannot grant playback or prove the
current balance. A waiting result does not prove cancellation, absence of charge,
or permission to repurchase. A credited result is historical, not final refund
settlement. Consumers refresh the wallet and current access separately.

## Alternatives and boundary

A wallet difference can misattribute concurrent credits/debits. Exposing webhook
receipts leaks unowned ambiguous claims. Owner-scoped immutable decisions provide
the smallest safe prerequisite. Native SDK/UI and genuine provider reconciliation
remain #142 follow-ups. No migrations, dependencies, real provider traffic,
retained transaction IDs, consumer analytics, refund policy or production changes.

## Acceptance

Integration tests exercise authentication, App Check, exact bounded inputs,
disabled/production gates, read-only behavior, catalog scoping and binding drift,
once-only callback credit, immutable price snapshots, foreign ownership, deletion
and stale sessions, refund/conflict review persistence, and safe response fields.
Generate OpenAPI and TypeScript together. Run backend and repository gates and
independent financial/security review. Genuine native/provider checks stay open;
no financial or privacy safeguard is deferred.

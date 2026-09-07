# ADR 0006: Store Billing, RevenueCat, and a Django Coin Ledger

- **Status:** Accepted subject to release-time regional policy review
- **Date:** 2026-08-23

## MVP timing amendment (2026-09-07)

D-007/D-008/D-015 approve the Android Google Play consumable coin path for MVP. RevenueCat, verified purchase lifecycle, immutable Django coin ledger, persistent balance, atomic coin debit plus episode entitlement, refunds/chargebacks and reconciliation are MVP requirements. This is a timing/scope amendment, not an implementation claim. Subscriptions and Apple/iOS commerce remain post-MVP.

**Historical timing — Superseded:** On 2026-08-27 the founder deferred RevenueCat, store IAP and the coin ledger to P7 and selected rewarded ads alone for MVP. The 2026-09-07 direction supersedes that deferral only for Android coins; the architecture remains accepted.

## Context

The mobile product sells digital subscriptions and virtual currency. Store policies and purchase lifecycles are complex, while coin spending and episode entitlements require first-party transactional authority.

## Decision

Use Apple In-App Purchase and Google Play Billing through RevenueCat for product presentation, receipt lifecycle, subscription entitlements, and webhooks. Use an immutable Django coin ledger and permanent episode entitlements. Credit coins only from verified known store transactions. Debit and entitlement grant happen atomically.

Do not place direct credit-card checkout in the mobile MVP. Rewarded-ad grants use verified provider callbacks and the same entitlement authority.

## MVP lifecycle and authority

- Authenticate the app account before purchasing and map RevenueCat/store identities to that account on the server. Never trust a device-reported purchase success or coin amount.
- Known Google Play consumable products map to approved server coin quantities by environment. Store-provided localized price strings are displayed; pack sizes/prices and episode coin costs remain D-008 decisions.
- Verify lifecycle authenticity, environment, transaction/product/customer identity and final purchase state before idempotent fulfillment. Assign ownership for store acknowledgement/consumption to the provider integration and validate its recovery behavior; never acknowledge by inventing a ledger credit.
- One verified transaction produces at most one credit. Debit and entitlement commit atomically under locking/idempotency after current rights, offer and price checks. All corrections use compensating entries.
- Reconcile pending, interrupted, duplicated, delayed and out-of-order events, including refunds/chargebacks, unknown users/products and account alias/transfer conflicts. Quarantine unresolved ownership rather than granting to another account. D-008 must approve handling of refunds after coins were spent; do not silently confiscate unrelated purchased coins or manufacture negative spendable balances.
- Reinstall/second-device login reloads the server balance and entitlements; consumable recovery never re-credits a fulfilled transaction. Expose safe support references, not receipts/provider payloads.
- Financial authority comes from backend/store/provider records. RevenueCat is not the coin balance ledger and Firebase Analytics cannot mint money or access. Retention/deletion and finance access require D-020/legal review before activation.
- Google Play payments/EUR settlement, coin terms and sandbox purchase/refund/reconciliation evidence are MVP release gates. Apple settlement, subscription restore/renewal/grace and subscription state are later gates.

## Consequences

- Provider events must be authentic, idempotent, replay-safe, order-independent, and reconciled.
- Store-localized pricing is displayed by the client.
- Support tooling uses compensating ledger entries rather than history edits.
- Regional alternative-billing/link programs are separate future policy decisions.

## Reconsider when

Store/regional rules, business economics, or a future web client justify a separately reviewed payment path.

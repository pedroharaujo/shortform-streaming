# ADR 0006: Store Billing, RevenueCat, and a Django Coin Ledger

- **Status:** Accepted subject to release-time regional policy review
- **Date:** 2026-08-23

## Context

The mobile product sells digital subscriptions and virtual currency. Store policies and purchase lifecycles are complex, while coin spending and episode entitlements require first-party transactional authority.

## Decision

Use Apple In-App Purchase and Google Play Billing through RevenueCat for product presentation, receipt lifecycle, subscription entitlements, and webhooks. Use an immutable Django coin ledger and permanent episode entitlements. Credit coins only from verified known store transactions. Debit and entitlement grant happen atomically.

Do not place direct credit-card checkout in the mobile MVP. Rewarded-ad grants use verified provider callbacks and the same entitlement authority.

## Consequences

- Provider events must be authentic, idempotent, replay-safe, order-independent, and reconciled.
- Store-localized pricing is displayed by the client.
- Support tooling uses compensating ledger entries rather than history edits.
- Regional alternative-billing/link programs are separate future policy decisions.

## Reconsider when

Store/regional rules, business economics, or a future web client justify a separately reviewed payment path.

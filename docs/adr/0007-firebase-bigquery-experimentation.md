# ADR 0007: Firebase Analytics and Experiments with BigQuery

- **Status:** Accepted
- **Date:** 2026-08-23

## MVP timing amendment (2026-09-07)

D-016/D-032 move the minimum cohort LTV/CAC measurement path into MVP: typed consent-gated product/commerce events; supported Firebase Analytics export to BigQuery; server/store/provider purchase, ledger, refund, entitlement and ad facts; repeatable private campaign-spend/content-cost imports; versioned SQL definitions; and a reproducible daily report with freshness, uniqueness and reconciliation checks. Use the existing accepted warehouse path without adding a separate data platform.

P4-T02 and P4-T03 own this minimum export/model/reporting slice. P4-T06 owns the simplest reliable source/campaign/creative attribution sufficient for the D-017 capped test. Controlled manual imports are acceptable at initial volume. D-018 remains the MMP decision when spend or ambiguity justifies it; neither an MMP nor ad-network SDKs are automatically required. Advanced deferred deep linking remains post-MVP unless the initial test cannot work without it.

Looker Studio dashboards, Remote Config A/B Testing, experiment/Crashlytics exports beyond core economics, push and advanced reporting stay P7 (split tasks retain original IDs/traceability). No production export or tracking is authorized until D-020 and the exact release's privacy/store approvals pass.

**Historical timing — Superseded:** The 2026-08-27 split required only typed Firebase events for MVP and deferred all BigQuery/Looker/experiment work to P7. On 2026-09-07 the founder superseded the warehouse/measurement deferral required for Android coin and paid-acquisition economics, retaining advanced capabilities as post-MVP.

## Context

The business depends on joining acquisition, content progression, experiments, verified purchases/rewards, retention, and infrastructure/content costs.

## Decision

Collect typed product events with Firebase Analytics. Use Remote Config and A/B Testing for reversible client experiences. Export supported Firebase data to BigQuery and ingest server-authoritative commerce/ad facts. Build version-controlled SQL metric models and first dashboards in Looker Studio.

Use platform-native attribution and canonical campaign/deep-link parameters for small tests. Adopt an MMP only when approved spend or ambiguity crosses a documented threshold.

## Measurement acceptance

Use [the analytics contract](../analytics/README.md) and [cost model](../product/COST_MODEL.md) for canonical events, metric denominators and financial authority. Retain original currency, reporting FX provenance, occurrence and ingestion times, opaque join keys and refund adjustments in restricted records. Never export raw receipts, provider payloads, contract terms, personal identifiers or licensed assets to public Git or client Analytics.

Validate a known synthetic cohort from spend through acquisition, free/ad/coin use, late/refunded purchases, allocated content/infra cost and the daily result. Report D1/D7/D30 cohort maturity, measured/consented coverage, unattributed users, unmatched revenue and projection assumptions. Missing joins and immature retention are unknown, not zero. No LTV:CAC claim or increased spend may depend on unreconciled client events or extrapolation hidden as observed revenue.

## Consequences

- Client purchase/reward events are diagnostic; backend/provider facts drive finance.
- Event/property governance, consent, deletion, partitioning, and cost controls are mandatory.
- Experiment exposure is logged when behavior is used, not merely when configuration is fetched.

## Reconsider when

Export limits, experiment requirements, privacy, attribution reliability, or cost justify another product analytics or MMP provider.

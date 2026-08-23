# ADR 0007: Firebase Analytics and Experiments with BigQuery

- **Status:** Accepted
- **Date:** 2026-08-23

## Context

The business depends on joining acquisition, content progression, experiments, verified purchases/rewards, retention, and infrastructure/content costs.

## Decision

Collect typed product events with Firebase Analytics. Use Remote Config and A/B Testing for reversible client experiences. Export supported Firebase data to BigQuery and ingest server-authoritative commerce/ad facts. Build version-controlled SQL metric models and first dashboards in Looker Studio.

Use platform-native attribution and canonical campaign/deep-link parameters for small tests. Adopt an MMP only when approved spend or ambiguity crosses a documented threshold.

## Consequences

- Client purchase/reward events are diagnostic; backend/provider facts drive finance.
- Event/property governance, consent, deletion, partitioning, and cost controls are mandatory.
- Experiment exposure is logged when behavior is used, not merely when configuration is fetched.

## Reconsider when

Export limits, experiment requirements, privacy, attribution reliability, or cost justify another product analytics or MMP provider.

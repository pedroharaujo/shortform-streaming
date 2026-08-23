# ADR 0002: Django Modular Monolith with REST

- **Status:** Accepted
- **Date:** 2026-08-23

## Context

The MVP needs catalog, rights, playback authorization, commerce, rewards, analytics integration, and Admin. A small team needs transactions and simple operations more than independent service deployment.

## Decision

Use one Django LTS application deployed on Cloud Run. Organize bounded Django apps for accounts, catalog, playback, entitlements, commerce, advertising, experiments, and notifications. Expose versioned REST through Django REST Framework and generate OpenAPI with `drf-spectacular`.

Use PostgreSQL transactions as the authority for ledger and entitlement changes. Use Cloud Tasks/Scheduler only for durable asynchronous or scheduled work.

## Consequences

- One deployment and database simplify consistency, debugging, and recovery.
- Module boundaries and tests must prevent a tangled monolith.
- Mobile consumes a generated TypeScript client.
- No GraphQL, microservices, Kafka, or Kubernetes in MVP.

## Reconsider when

Measurements prove a bounded workload needs independent scaling, failure isolation, compliance, data ownership, or team release cadence.

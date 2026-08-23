# ADR 0004: Managed PostgreSQL with a Supabase-to-Cloud-SQL Path

- **Status:** Accepted with production gate
- **Date:** 2026-08-23

## Context

Django needs relational consistency for rights, ledger, transactions, subscriptions, and entitlements. Early development should minimize fixed cost, while production needs backups and non-pausing availability.

## Decision

Use standard PostgreSQL through Django ORM and migrations. Use Supabase Free for development and, if useful, early staging. Upgrade production to a paid non-pausing plan with appropriate backups/PITR before public launch. Preserve compatibility so GCP Cloud SQL remains a migration option.

The mobile app never connects directly to Supabase or its generated APIs.

## Consequences

- No provider-specific database features without an ADR.
- Connection management must suit Cloud Run.
- Free-tier limits cannot define production reliability.
- Backup/restore drills are mandatory.

## Reconsider when

Region, compliance, support, recovery, performance, connection, or total-cost measurements favor Cloud SQL or another managed PostgreSQL service.

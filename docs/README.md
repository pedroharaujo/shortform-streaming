# Documentation Index

## Authority

Current product and architecture documents below are the source of truth.
`MICRODRAMA_IMPLEMENTATION_PLAN.md` is the delivery plan (task IDs, sequencing,
acceptance). If a plan or historical runbook conflicts with an approved product
brief, decision-register entry, or ADR, the approved document wins.

AI agents start at the root `AGENTS.md`. Operating notes are in
`AI_DEVELOPMENT.md`.

## Product and delivery

- `product/MVP_PRODUCT_BRIEF.md` — thinner MVP: 1 series, ads-only monetization; Public Release Readiness remains open.
- `product/DECISION_REGISTER.md` — authoritative approval status.
- `product/CONTENT_RIGHTS_CHECKLIST.md` — contractual and media gate.
- `product/STORE_COMPLIANCE_MATRIX.md` — commerce, advertising, store, and privacy baseline.
- `product/SDK_DATA_INVENTORY.md` — engineering SDK/data inventory for privacy labels and deletion (P0-T03 remaining slice; P0-T03 is not complete).
- `product/COST_MODEL.md` — unit-cost and contribution formulas.

## Architecture decisions

- `adr/0001-monorepo.md`
- `adr/0002-modular-monolith-rest.md`
- `adr/0003-firebase-identity-mobile-services.md`
- `adr/0004-managed-postgresql.md`
- `adr/0005-gcp-video-pipeline.md` — Bunny Stream default; GCP Cloud CDN fallback
- `adr/0006-store-billing-revenuecat-ledger.md`
- `adr/0007-firebase-bigquery-experimentation.md`

## Architecture diagrams

- `architecture/shortform-streaming.drawio` — system map, monorepo layout, and workflows (home, playback, login, rewarded ads, ingestion, analytics; store payments are P7). Open in draw.io / diagrams.net.

## API

- `api/README.md` — OpenAPI generation, shared conventions, and contract-check commands.
- `api/openapi.yaml` — generated OpenAPI document (do not edit by hand).

## Runbooks

- `runbooks/repository-controls.md` — required `main` ruleset, security settings, and P1-T01 evidence/recovery.
- `runbooks/compatible-dependency-set.md` — Expo SDK 57 / Django 6.1 compatible versions and Dependabot ignore policy (P1-T05A).
- `runbooks/django-container.md` — non-root Django image, gunicorn, collectstatic, migrate-vs-web, Compose evidence (P5-T02). Live staging deploy is P5-T03.
- `runbooks/staging-apply.md` — OpenTofu 1.11.14 install, session project override, state-bucket bootstrap, and staging apply (P5-T01-B).
- `runbooks/access-policy.md` — D-006 defaults, Admin live saves, offers vs authorize, rollback of `0003` then `0002` (P3-T01).

## Future documentation locations

- `analytics/` — event dictionary, metric contracts, and experiment records. `analytics/README.md` is a placeholder until those tasks begin.
- Additional runbooks for deployments, incidents, recovery, payments, rewards, and takedowns.

Create these directories only when the corresponding implementation task produces real content; avoid empty placeholders.

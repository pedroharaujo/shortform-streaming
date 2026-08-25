# Documentation Index

## Product and delivery

- `product/MVP_PRODUCT_BRIEF.md` — proposed MVP and decisions requiring approval.
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

- `architecture/shortform-streaming.drawio` — system map, monorepo layout, and MVP workflows (home, playback, login, payments, rewarded ads, ingestion, analytics). Open in draw.io / diagrams.net.

## API

- `api/README.md` — OpenAPI generation, shared conventions, and contract-check commands.
- `api/openapi.yaml` — generated OpenAPI document (do not edit by hand).

## Runbooks

- `runbooks/repository-controls.md` — required `main` ruleset, security settings, and P1-T01 evidence/recovery.
- `runbooks/compatible-dependency-set.md` — Expo SDK 57 / Django 6.1 compatible versions and Dependabot ignore policy (P1-T05A).

## Future documentation locations

- `analytics/` — event dictionary, metric contracts, and experiment records. `analytics/README.md` is a placeholder until those tasks begin.
- Additional runbooks for deployments, incidents, recovery, payments, rewards, and takedowns.

Create these directories only when the corresponding implementation task produces real content; avoid empty placeholders.

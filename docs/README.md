# Documentation Index

## Product and delivery

- `product/MVP_PRODUCT_BRIEF.md` — proposed MVP and decisions requiring approval.
- `product/DECISION_REGISTER.md` — authoritative approval status.
- `product/CONTENT_RIGHTS_CHECKLIST.md` — contractual and media gate.
- `product/STORE_COMPLIANCE_MATRIX.md` — commerce, advertising, store, and privacy baseline.
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

## Future documentation locations

- `api/` — generated schema guidance and API conventions.
- `analytics/` — event dictionary, metric contracts, and experiment records.
- `runbooks/` — deployments, incidents, recovery, payments, rewards, and takedowns.

Create these directories only when the corresponding implementation task produces real content; avoid empty placeholders.

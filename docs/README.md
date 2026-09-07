# Documentation Index

## Authority

Current product and architecture documents below are the source of truth.
`MICRODRAMA_IMPLEMENTATION_PLAN.md` is the delivery plan (task IDs, sequencing,
acceptance). If a plan or historical runbook conflicts with an approved product
brief, decision-register entry, or ADR, the approved document wins.

AI agents start at the root `AGENTS.md`. Operating notes are in
`AI_DEVELOPMENT.md`.

## Product and delivery

- `product/MVP_PRODUCT_BRIEF.md` — France/Android/English launch configuration, approximately 3–5 titles, rewarded ads plus coins, capped acquisition and contribution LTV/CAC; Public Release Readiness remains open.
- `product/DECISION_REGISTER.md` — authoritative approval status.
- `product/CONTENT_RIGHTS_CHECKLIST.md` — per-title self-owned/licensed provenance, free/ad/coin/paid-promotional rights and media gate; preferred €0 upfront/MG revenue-share strategy.
- `product/STORE_COMPLIANCE_MATRIX.md` — commerce, advertising, store, and privacy baseline.
- `product/SDK_DATA_INVENTORY.md` — engineering SDK/data inventory for privacy labels and deletion (P0-T03 remaining slice; P0-T03 is not complete).
- `product/COST_MODEL.md` — parameterized ad/IAP, revenue-share, infrastructure and acquisition/cohort formulas; historical examples under `archive/`.

## Architecture decisions

- `adr/0001-monorepo.md`
- `adr/0002-modular-monolith-rest.md`
- `adr/0003-firebase-identity-mobile-services.md`
- `adr/0004-managed-postgresql.md`
- `adr/0005-gcp-video-pipeline.md` — Bunny Stream default; GCP Cloud CDN fallback
- `adr/0006-store-billing-revenuecat-ledger.md`
- `adr/0007-firebase-bigquery-experimentation.md`

## Architecture diagrams

- `architecture/shortform-streaming.drawio` — system map, monorepo layout, and workflows (home, playback, login, Google coins, rewarded ads, ingestion, minimal cohort economics; Apple/subscriptions and advanced tools remain P7). Open in draw.io / diagrams.net.

## API

- `api/README.md` — OpenAPI generation, shared conventions, and contract-check commands.
- `api/openapi.yaml` — generated OpenAPI document (do not edit by hand).

## Runbooks

- `runbooks/repository-controls.md` — required `main` ruleset, security settings, and P1-T01 evidence/recovery.
- `runbooks/compatible-dependency-set.md` — Expo SDK 57 / Django 6.1 compatible versions and Dependabot ignore policy (P1-T05A).
- `runbooks/django-container.md` — non-root Django image, gunicorn, collectstatic, migrate-vs-web, Compose evidence (P5-T02). Live staging deploy evidence is P5-T03 follow-up.
- `runbooks/staging-apply.md` — OpenTofu 1.11.14 install, session project override, state-bucket bootstrap, and staging apply (P5-T01-B).
- `runbooks/staging-deploy.md` — GitHub OIDC/WIF, Environment variables, migrate-before-traffic, in-project smoke, fail-smoke, and traffic-only rollback (P5-T03).
- `runbooks/secrets-and-rotation.md` — secret/configuration inventory, numeric version adoption, consumed-secret IAM, rotation/rollback procedure and pending live validation (P5-T04 foundation).
- `runbooks/app-check.md` — Android debug/Play Integrity setup, Django enforcement, redaction, staging validation, and rollback (P5-T05-F3).
- `runbooks/access-policy.md` — current Series free/ad policy, planned per-episode coin/rights extension, and explicitly historical AccessPolicy/rollback evidence.
- `runbooks/catalog-launch-context.md` — server launch settings, distribution and language scope, conservative licensed-right reapproval, publication/ingestion safeguards and migration evidence (P2-T03-F3).
- `runbooks/account-lifecycle.md` — account preferences, recent-auth deletion, provider retries, and privacy-safe rollback (P2-T02).
- `runbooks/rewarded-ads.md` — test-only reward intents, authentic SSV, consent, grant/deletion safety, production gates and validation evidence (P3-T07).
- `runbooks/development-privacy-setup.md` — privacy notice and AdMob setup moved to release blocker #98 (D-028); does not block P3-T07 development completion.
- `runbooks/final-validation.md` — consolidated P6-T03 execution guide and register for device/manual/provider checks deferred under D-029; unchecked items still block applicable release/production enablement.
- `privacy/DEVELOPMENT_PRIVACY_NOTICE_DRAFT.md` — inactive notice draft; not an AdMob policy URL until the operator facts and publication checks are completed.

- `runbooks/mvp-strategy-update-2026-09-07.md` — documentation change record, superseded decisions, moved/split tasks, open gates and validation evidence (P0-T01).
- `archive/2026-08-cost-scenarios.md` — superseded infrastructure-only arithmetic, never a current MVP forecast.

## Future documentation locations

- `analytics/` — event dictionary, metric contracts, and experiment records. `analytics/README.md` distinguishes current schema, historical events and planned MVP commerce/cohort definitions.
- Additional runbooks for deployments, incidents, recovery, payments, rewards, and takedowns.

Create these directories only when the corresponding implementation task produces real content; avoid empty placeholders.

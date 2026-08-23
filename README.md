# Shortform Streaming

Public monorepo for a mobile-first vertical microdrama streaming platform.

The MVP consists of a Django REST backend/Django Admin and one React Native/Expo application for iOS and Android. A consumer web client is explicitly post-MVP.

## Bootstrap checkpoint

P1-T01 establishes the repository layout and its local/CI safety gate. It does not yet bootstrap a runnable Django service, Expo application, database, or cloud infrastructure; those are separate tasks starting with P1-T02 and P1-T03.

A fresh clone reaches the current checkpoint with only Git and Python 3.11 or newer:

```shell
git clone https://github.com/pedroharaujo/shortform-streaming.git
cd shortform-streaming
python scripts/check_repository_foundation.py
```

The command succeeds only when the repository structure, ignore rules, secret scan, scanner regression tests, and AI governance contracts pass. It installs nothing and does not require provider accounts, credentials, licensed media, Node.js, Docker, or cloud access.

## Architecture and repository layout

The target is a modular monorepo with independently deployable backend, mobile, and infrastructure layers:

```text
mobile (Expo) ---- HTTPS ---- backend (Django/DRF) ---- PostgreSQL
      |                              |
      +---- mobile providers         +---- private media authorization
```

- `backend/` is reserved for the Django/DRF modular monolith and backend tests (P1-T02).
- `mobile/` is reserved for the Expo/React Native application (P1-T03).
- `packages/api-client/` will contain the OpenAPI-generated TypeScript client (P1-T04).
- `infra/` holds environment and reusable infrastructure definitions when provisioning begins.
- `docs/` contains product decisions, ADRs, contracts, analytics references, and runbooks.
- `scripts/` and `tests/repository/` contain repository-wide deterministic checks.

Empty runtime scaffolds such as `manage.py`, `package.json`, `compose.yaml`, and infrastructure state are intentionally absent until their owning plan tasks add working implementations and tests.

## Common commands

Run the complete repository-foundation gate:

```shell
python scripts/check_repository_foundation.py
```

Run its components independently:

```shell
python scripts/scan_secrets.py
python -m unittest discover -s tests/repository -p "test_*.py"
python scripts/validate_ai_governance.py
git diff --check
```

The future `pnpm check`, backend, mobile, contract, and infrastructure commands become available only when their corresponding bootstrap tasks commit the required manifests and lockfiles. An unavailable required check is a blocker, never a pass.

## Project status

Implementation has started with Phase 0 product, rights, compliance, architecture, and cost gates. The founder-approved MVP launch scope is the 21 EU countries using EUR listed canonically in decision D-001. The MVP interface and initial microdrama catalog are in English. Customer prices remain localized strings supplied by each user's App Store or Google Play storefront, while EUR is the company's base reporting currency and desired store-settlement currency.

Phase 1 engineering may proceed without company-registration or store-account data. Development and automated tests use only short self-owned, generated, or purpose-made test media and local/emulated/provider-fake integrations; real licensed media and production credentials are not required.

The approved geographic scope is not final launch clearance. Territorial content rights, GDPR/privacy, per-market legal and language review, age/content controls, store compliance, incorporation and registration details of the intended French entity, and verified EUR-compatible Apple/Google organization, payment-profile, and bank configuration remain mandatory release gates. No public distribution or real purchase, subscription, or advertising flow may be enabled before that review passes.

## Source of truth

- [Complete product and implementation plan](./MICRODRAMA_IMPLEMENTATION_PLAN.md)
- [MVP product brief](./docs/product/MVP_PRODUCT_BRIEF.md)
- [Decision register](./docs/product/DECISION_REGISTER.md)
- [Content-rights checklist](./docs/product/CONTENT_RIGHTS_CHECKLIST.md)
- [Store and privacy compliance matrix](./docs/product/STORE_COMPLIANCE_MATRIX.md)
- [Unit-cost model](./docs/product/COST_MODEL.md)
- [Architecture decision records](./docs/adr/)
- [AI-native development workflow](./docs/AI_DEVELOPMENT.md)

## Repository safety

This repository is public. Never commit secrets, real `.env` files, licensed video or artwork, confidential contracts/rates, provider payloads, production data, personal data, store credentials, or signing material.

Keep private inputs under an ignored location such as `sources/`, `licensed-media/`, `contracts/`, `credentials/`, or `private/`. The repository safety gate scans tracked and non-ignored local files and reports only the rule and location of a suspected secret, never its value.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and the [repository controls runbook](./docs/runbooks/repository-controls.md) before making changes.

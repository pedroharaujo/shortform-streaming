# Shortform Streaming

Public monorepo for a mobile-first vertical microdrama streaming platform.

The MVP consists of a Django REST backend/Django Admin and one React Native/Expo application for iOS and Android. A consumer web client is explicitly post-MVP.

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

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md) before making changes.

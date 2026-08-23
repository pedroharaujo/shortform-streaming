# Shortform Streaming

Public monorepo for a mobile-first vertical microdrama streaming platform.

The MVP consists of a Django REST backend/Django Admin and one React Native/Expo application for iOS and Android. A consumer web client is explicitly post-MVP.

## Project status

Implementation has started with Phase 0 product, rights, compliance, architecture, and cost gates. The MVP interface language is English. Customer prices are localized by each user's App Store or Google Play storefront, while EUR is the company's base reporting currency and desired store-settlement currency. Distribution countries and payment-profile eligibility still require approval.

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

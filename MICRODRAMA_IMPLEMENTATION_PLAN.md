# Microdrama Platform — Product and Implementation Plan

**Document status:** Implementation-ready baseline  
**Language:** English  
**Last reviewed:** 2026-08-27  
**Repository:** `pedroharaujo/shortform-streaming` (public monorepo)  
**MVP clients:** iOS and Android only; Django Admin is the only web interface

---

## 1. How to Use This Plan

This file is the delivery plan: phases, task IDs, sequencing, and per-task acceptance. Codex and Cursor start from `AGENTS.md`. If this plan conflicts with `docs/product/MVP_PRODUCT_BRIEF.md`, `docs/product/DECISION_REGISTER.md`, or an accepted ADR, those documents win.

Execution rules:

1. Implement one task per focused change or pull request unless two tasks are explicitly coupled.
2. Read the task objective, dependencies, acceptance criteria, and validation before coding.
3. Do not mark a task complete until its automated tests and stated integration test pass.
4. Record evidence in the pull request: commands run, screenshots where relevant, migration impact, and rollback notes.
5. Keep API, analytics, and entitlement behavior backward-compatible. Use migrations and feature flags for risky changes.
6. Prefer vertical slices that leave a usable path working end to end.
7. Do not add a consumer web frontend during the MVP.
8. Do not serve video bytes through Django.
9. Do not trust the mobile client for purchases, coin balances, rewarded-ad grants, or entitlements.
10. Recheck provider prices and app-store policies before production launch; they change over time.

### Definition of Done for Every Task

- Acceptance criteria are demonstrably satisfied.
- New behavior has automated tests at the appropriate level.
- Existing test suites, linting, type checks, and builds pass.
- Security, privacy, analytics, accessibility, and localization impacts are considered.
- Documentation and environment examples are updated.
- No secrets, real user data, or licensed media are committed.

---

## 2. Product Summary

Build a mobile-first streaming platform for licensed vertical microdramas. Users discover a series, watch short episodes in a vertical player, and continue through a hardcoded free window plus verified rewarded-ad unlocks. Coin unlocks and an all-access subscription remain in the accepted architecture and ship in P7, not at MVP launch.

The first business goal is not to become a large streaming catalog. It is to validate a repeatable acquisition and monetization loop:

> Creative/campaign → acquired user → series → episode progression → monetization → cohort LTV → contribution margin.

Launch with **one** licensed (or self-owned/generated test) series. The catalog data model still supports N series. Expand the catalog, produce owned IP, and offer distribution services only after ads-only unit economics are validated — or after a P7 IAP test if ads cannot carry UA.

### Business layers and long-term sequence

1. **Platform first:** license content, acquire viewers, learn what monetizes.
2. **Studio second:** produce owned content based on validated demand signals.
3. **Distributor later:** license owned and third-party catalogs to other platforms.

### MVP hypothesis

> Can rewarded-ad LTV on one series beat capped Meta/TikTok CAC?

The ads-only MVP is viable when selected acquired cohorts can achieve projected contribution LTV greater than CAC after content revenue share, refunds where applicable, ad costs, infrastructure, and taxes. If the ads-only test fails, that is evidence ads cannot carry UA — **not** that microdrama is dead. P7 IAP is the next test.

---

## 3. MVP Scope and Product Decisions

### Included in MVP

- iOS and Android mobile apps built from one React Native/Expo TypeScript codebase.
- Django REST API and Django Admin.
- Catalog (data model supports N series; launch catalog is 1 title), series detail, episode list, vertical adaptive-streaming player, autoplay next, and watch progress.
- Anonymous browsing and free playback; account required before the first monetized unlock (rewarded ad) or cross-device sync.
- Email/password, Apple, and Google sign-in through Firebase Authentication.
- Episode access policy for MVP: free vs rewarded ad only (hardcoded / admin-configured free window).
- Rewarded ads through Google AdMob, with server-side verification.
- Server-authoritative entitlements for ad grants.
- Thin Firebase Analytics typed events, crash reporting, and campaign/deep-link IDs.
- Content ingestion, rights metadata, media processing, signed playback access, and basic editorial curation.
- Staging and production deployment, CI/CD, observability, privacy controls, and account deletion.

### Explicitly excluded from MVP

- Consumer web streaming client.
- User-generated content, comments, social feed, chat, creator uploads, and profiles visible to other users.
- Offline downloads.
- Live streaming.
- Multiple profiles per account and household sharing.
- Smart-TV apps.
- Recommendation machine learning; MVP recommendations are editorial/rule-based.
- Microservices, Kubernetes, Kafka, Elasticsearch, GraphQL, and a custom admin frontend.
- Custom DRM unless a content license contract requires it.
- Direct credit-card checkout inside mobile apps for digital goods.
- Store IAP, subscriptions, coin packs, and RevenueCat until P7 (deferred, not deleted).
- Push notifications and lifecycle campaigns until P7 (deferred, not deleted).
- BigQuery/Looker metric models, Remote Config experiments, and MMP until P7 (deferred, not deleted).

### Default access and monetization rules

- The MVP user interface and all default product copy are in English.
- Decision D-001 canonically enumerates the founder-approved MVP distribution scope: 21 EU countries using EUR. Each storefront remains gated by territorial rights and local legal/language requirements.
- Customer prices and billing periods come from store-localized product metadata for the active App Store or Google Play storefront when P7 IAP ships. The app never infers currency from language or builds monetary strings manually. Although every approved MVP market uses EUR, localized price presentation, VAT treatment, and national requirements can still vary. MVP has no IAP.
- EUR is the company's base reporting currency and desired settlement currency. Production setup must validate the Apple bank-account currency and Google payments-profile/bank eligibility for EUR payouts before P7 IAP.
- The number of free episodes is hardcoded / admin-configured; the seed is the first five episodes (D-006). Remote Config / experiment cohorts wait for P7.
- A free episode requires no login.
- At a locked episode, the server returns the rewarded-ad offer (the only MVP unlock method).
- Access precedence is: existing episode entitlement → free policy → locked (rewarded-ad offer). Subscription and coin precedence wait for P7.
- A successful verified rewarded ad grants one persistent episode entitlement to the authenticated account. This is the only MVP monetization path (D-007).
- Coin unlock, coin ledger, and subscription access remain accepted architecture and ship in P7 (D-008, D-009, D-015).
- Rewarded ads are always opt-in, clearly state the reward, and never interrupt playback.
- Use interstitial ads only after a later experiment proves they improve contribution without damaging retention.
- Store purchase restoration and subscription resynchronization are mandatory in P7; they are not MVP launch requirements.

### Content and rights decisions

- The initial catalog consists of English-language microdramas.
- Launch with **one** licensed (or self-owned/generated test) series. The catalog data model still supports N series (D-004).
- Every series must record licensor, territories, platforms, languages, start/end dates, exclusivity, revenue-share rules, takedown status, and source-contract reference.
- The API must hide expired, out-of-territory, unpublished, or takedown content.
- Originals and subtitles are private assets. Public bucket access is prohibited.
- Signed access reduces casual sharing but is not DRM. A contract requiring Widevine/FairPlay changes the video-provider decision before ingestion.

### Initial success metrics

Primary business metric (MVP ads-only):

- **Cohort contribution margin:** verified rewarded-ad revenue − CAC − content royalties/revenue share − variable infrastructure − applicable taxes. Store IAP/subscription revenue joins this formula in P7. An ads-only LTV>CAC miss must not be read as killing IAP.

Core product metrics (MVP-required):

- Install-to-first-play conversion.
- Episode 1 start and completion rates.
- Episode N continuation curve and lock reach.
- Rewarded-ad offer acceptance and verified reward rate.
- Ad ARPDAU and CAC versus verified ad revenue.
- D1, D7, and D30 retention.
- D7/D30 cohort LTV from ad yield.
- Playback start time, rebuffer ratio, completion rate, and playback error rate.
- CAC and LTV/CAC by creative, campaign, country, and the launch series.

Paywall view-to-purchase conversion, trial-to-paid, subscription renewal/churn, and IAP payer conversion are P7 metrics.

Launch gates should be set after the first controlled distribution countries/storefronts are chosen. Do not invent universal thresholds before baseline data exists.

---

## 4. Technology and Local Setup

Install stable supported releases and commit lockfiles. Avoid pinning this planning document to transient version numbers.

### Required developer tools

- Git and a GitHub account.
- Docker Desktop with Docker Compose.
- Python, managed with `uv`; use the current stable Python supported by the selected Django LTS.
- Node.js current LTS, Corepack, and `pnpm`.
- Android Studio, Android SDK, and an emulator or physical Android device.
- EAS CLI and an Expo account.
- Google Cloud CLI.
- Firebase CLI.
- OpenTofu or Terraform CLI.
- Optional: PostgreSQL client, Bruno/Insomnia, and Maestro CLI.
- For local iOS builds: macOS and Xcode. On Windows/Linux, use EAS cloud builds for iOS.

### Accounts required before beta

- Public GitHub repository.
- Google Cloud billing account and separate staging/production projects.
- Firebase staging/production projects.
- Supabase organization and database projects.
- Expo/EAS project.
- Apple Developer Program and App Store Connect.
- Google Play Console.
- Google AdMob. RevenueCat is **not** required for MVP beta; it is required before P7 IAP.
- A transactional email provider for production auth email if Firebase requires customization.
- DNS/domain provider.
- Sentry is optional if Firebase Crashlytics plus Cloud Error Reporting is sufficient.
- Meta and TikTok advertiser accounts only when acquisition testing starts.

### Selected stack

**Monorepo and tooling**

- `pnpm` workspace for JavaScript/TypeScript.
- `uv` for Python dependencies and virtual environments.
- Docker Compose for local PostgreSQL and service parity.
- Ruff for Python lint/format; mypy or pyright for type checking.
- ESLint, Prettier, and strict TypeScript for mobile.
- Pre-commit hooks for fast local checks.

**Backend**

- Django LTS, Django REST Framework, and `drf-spectacular` OpenAPI.
- Gunicorn in production.
- PostgreSQL.
- `pytest`, `pytest-django`, Factory Boy, and coverage.
- Modular monolith with bounded Django apps, not microservices.
- Cloud Tasks and Cloud Scheduler for durable asynchronous/scheduled work where needed.

**Mobile**

- React Native with Expo and TypeScript.
- Expo Router.
- Expo development builds; Expo Go is not sufficient for AdMob and native Firebase modules. Store purchases wait for P7.
- TanStack Query for server state; a small Zustand store only for transient UI/session state.
- `expo-video` for HLS playback, subject to an early proof-of-concept.
- React Hook Form and Zod for forms and client validation.
- React Native Testing Library and Jest; Maestro for end-to-end device tests.

**Identity and mobile platform services**

- Firebase Authentication for email/password, Google, and Apple sign-in.
- Firebase Analytics and Crashlytics in MVP; App Check remains MVP-facing. Remote Config, A/B Testing, and Cloud Messaging wait for P7 (ADR 0003 timing). Performance Monitoring may land with observability or wait for P7.
- Django verifies Firebase ID tokens and owns application profiles and authorization.

**Database**

- Supabase managed PostgreSQL for development and early staging because its free tier is useful for prototyping.
- Upgrade production to a paid Supabase plan before public launch; the free plan has pausing, backup, resource, and SLA limitations.
- Keep standard PostgreSQL and Django migrations so migration to GCP Cloud SQL remains straightforward.
- The mobile app never connects directly to Supabase.

**Video**

- Bunny Stream is the default: upload a vertical master, encode ABR HLS (for example 360p, 540p, and 720p) plus thumbnails, and deliver from Bunny’s CDN with short-lived token access.
- Django issues playback authorization only after entitlement and territory checks, then returns an HLS URL the app plays in `expo-video` (not Bunny’s web player).
- Keep a `VideoProvider` boundary. The documented fallback is private GCS → Google Transcoder → Cloud CDN signed access; activate it only if Bunny fails P2-T05, a license/residency/support constraint forbids Bunny, or measured cost/reliability is worse. D-019 may still require a DRM-capable provider.
- Do not run both pipelines in production. Video delivery is a paid variable cost; free tiers are not a realistic streaming business model at scale.

**Monetization**

- Google AdMob rewarded ads in MVP, using test ad units outside production and server-side verification in production.
- RevenueCat SDK/webhooks for store product presentation, receipt lifecycle, and subscription entitlements — **P7**, accepted architecture (ADR 0006).
- Apple In-App Purchase and Google Play Billing for mobile digital subscriptions and coin packs — **P7**.
- Django coin ledger for currency balance and episode unlocks — **P7**.

**Analytics and experimentation**

- Firebase Analytics typed event collection in MVP.
- Firebase Remote Config and A/B Testing for paywall position, free-episode count, coin price, ad offer, and messaging — **P7**.
- BigQuery export for raw event analysis and cohort joins — **P7**.
- Looker Studio for the first dashboards — **P7**.
- Platform-native attribution plus campaign/deep-link parameters for the one launch series in MVP; select an MMP such as Adjust or AppsFlyer before material paid acquisition if native attribution cannot answer cohort economics reliably (P7 / D-018).

**Infrastructure and operations**

- Cloud Run for Django API/Admin.
- Artifact Registry for container images.
- Secret Manager for secrets.
- Cloud Logging, Monitoring, Trace/Error Reporting, and uptime checks.
- GitHub Actions with Google Workload Identity Federation; no long-lived GCP service-account keys.
- OpenTofu/Terraform for reproducible GCP resources.

---

## 5. Target Architecture

```text
                         Internal staff
                              |
                         Django Admin
                              |
iOS / Android ---- HTTPS ---- Cloud Run: Django API/Admin
     |                        |       |        |
     |                        |       |        +-- Cloud Tasks/Scheduler
     |                        |       +----------- Supabase PostgreSQL
     |                        +------------------- Firebase token verification
     |
     +-- Firebase Auth / Analytics / Crashlytics / App Check   (MVP)
     +-- AdMob rewarded ad                                      (MVP)
     +-- Firebase Remote Config / FCM                           (P7)
     +-- RevenueCat -> Apple IAP / Google Play Billing          (P7)
     |
     +-- authorized HLS request
            |
        Bunny Stream CDN (token, expiring access)
            ^
            |
      Bunny encode <- staff upload via Django
            |
      fallback (only if activated): GCS -> Transcoder -> Cloud CDN
```

### Trust boundaries

- Mobile input is untrusted.
- Firebase authenticates identity; Django authorizes every business action.
- AdMob callbacks are untrusted until signature/authenticity and idempotency checks pass. RevenueCat callbacks follow the same rule in P7.
- Database transactions are the authority for permanent episode entitlements. The coin ledger is the authority for coin balance in P7.
- Firebase Analytics is not the financial ledger.
- CDN URLs are bearer credentials and must be short-lived and excluded from logs/analytics.

### Proposed monorepo

```text
shortform-streaming/
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── catalog/
│   │   ├── playback/
│   │   ├── entitlements/
│   │   ├── commerce/
│   │   ├── advertising/
│   │   ├── experiments/
│   │   └── notifications/
│   ├── tests/
│   ├── manage.py
│   └── pyproject.toml
├── mobile/
│   ├── app/
│   ├── src/
│   │   ├── api/
│   │   ├── features/
│   │   ├── components/
│   │   ├── analytics/
│   │   └── test/
│   ├── app.config.ts
│   ├── eas.json
│   └── package.json
├── packages/
│   └── api-client/              # generated from OpenAPI
├── infra/
│   ├── modules/
│   └── environments/
├── docs/
│   ├── adr/
│   ├── api/
│   ├── analytics/
│   ├── runbooks/
│   └── product/
├── scripts/
├── .github/workflows/
├── compose.yaml
├── pnpm-workspace.yaml
├── .env.example
├── CONTRIBUTING.md
└── README.md
```

### Core domain model

- `UserProfile`: Firebase UID, locale, country, consent state, timestamps, deletion state.
- `Series`: localized metadata, artwork, genre, status, editorial rank.
- `Season`: optional grouping; model now even if MVP normally has one.
- `Episode`: order, localized metadata, duration, publication window, policy reference.
- `ContentRight`: licensor, territories, languages, platforms, dates, exclusivity, contract reference, takedown.
- `MediaAsset`: source/output locations, rendition state, checksum, codec, aspect ratio, captions, processing status.
- `AccessPolicy`: free/ad configuration for MVP; coin/subscription fields remain in the model for P7 and experiment-safe defaults later.
- `EpisodeEntitlement`: user, episode, source, granted/expiry/revocation metadata.
- `Wallet`: one per user and currency namespace (**P7**).
- `CoinLedgerEntry`: immutable credit/debit/adjustment with idempotency key and running audit fields (**P7**).
- `StoreTransaction`: store/provider transaction identity, product, state, raw-event reference, user, timestamps (**P7**).
- `SubscriptionState`: provider entitlement, status, expiry, grace/billing-retry state (**P7**).
- `RewardClaim`: ad network transaction, user, episode/reward, verification state, idempotency key.
- `WatchProgress`: user/device, episode, position, completion, last watched.
- `ExperimentExposure`: optional server record only for financially material server-side decisions; Firebase remains the primary assignment system.
- `NotificationPreference` and `PushToken`.

Critical constraints:

- Unique episode order within a season.
- Unique permanent entitlement per user/episode/source semantics.
- Unique external store transaction ID.
- Unique rewarded-ad transaction ID.
- Ledger entries are immutable; corrections are compensating entries.
- Coin debit and entitlement grant happen in one database transaction with row locking.
- Rights and publication checks are evaluated server-side at catalog and playback time.

---

## 6. API and Event Contracts

### Initial REST surface

- `GET /v1/config/bootstrap`
- `GET /v1/catalog/home`
- `GET /v1/series/{id}`
- `GET /v1/episodes/{id}`
- `POST /v1/playback/{episode_id}/authorize`
- `PUT /v1/progress/{episode_id}`
- `GET /v1/me`
- `DELETE /v1/me`
- `GET /v1/me/wallet` (**P7**)
- `GET /v1/me/entitlements`
- `GET /v1/offers/{episode_id}`
- `POST /v1/unlocks/coins` (**P7**)
- `POST /v1/rewards/intents`
- `GET /v1/rewards/{id}`
- `POST /v1/webhooks/revenuecat` (**P7**)
- `GET /v1/webhooks/admob/ssv` or the provider-required verified callback form
- `POST /v1/push/register` (**P7**)
- `DELETE /v1/push/register/{token}` (**P7**)
- `GET /health/live` and `GET /health/ready`

Rules:

- Cursor pagination for lists that can grow.
- Stable opaque public IDs; never expose sequential database IDs as an assumption.
- Consistent error envelope with code, safe message, correlation ID, and field errors.
- `Idempotency-Key` required on wallet-changing client commands (**P7**). Reward-intent creation is idempotent in MVP.
- OpenAPI is generated in CI; the TypeScript client is generated from it.
- Version breaking changes under a new API prefix; additive changes are preferred.

### Canonical analytics events

MVP (thin measurement; P4-T01):

- `app_open`, `sign_up`, `login`, `account_deleted`
- `home_viewed`, `series_impression`, `series_opened`
- `episode_started`, `episode_progress`, `episode_completed`, `playback_error`
- `locked_episode_viewed` (lock_shown), `offer_presented` (ad_offer), `offer_selected`
- `rewarded_ad_loaded`, `rewarded_ad_started`, `rewarded_ad_completed`, `reward_granted` (ad_rewarded), `reward_failed`

P7 (deferred from MVP 2026-08-27; issue #52):

- `coin_pack_viewed`, `purchase_started`, `purchase_succeeded`, `purchase_failed`, `purchase_restored`
- `coins_spent`, `episode_unlocked`
- `subscription_started`, `subscription_renewed`, `subscription_cancelled`, `subscription_expired`
- `push_permission_prompted`, `push_permission_result`, `notification_opened`
- `experiment_exposure`

Common properties:

- `event_id`, anonymous/app-instance ID, authenticated user ID where consent permits.
- App version/build, platform, locale, country, timestamp, and session ID.
- Series/episode IDs and episode number.
- Offer ID, access method, campaign, ad set, creative, source, medium, and deep-link target where available.
- Coin price, store product ID, and experiment ID/variant are P7 properties.

Never send email, auth token, signed video URL, full IP address, payment receipt, contract reference, or free-form error payload to analytics.

---

## 7. Delivery Roadmap and Tasks

The sequence below is dependency-ordered and keeps high-risk proofs early. Estimates should be added only after one engineer has completed the first vertical slice and calibrated velocity.

Two decision classes apply throughout the roadmap:

- **Required for architecture/coding:** must be approved before implementing the affected behavior. The accepted technical ADR baseline is sufficient to begin Phase 1 now.
- **Required before public release:** company registration and organization-account details, banking/payout verification, final rights/legal review, store configuration, and launch approvals may be completed later, but public production activation/traffic promotion, storefront distribution, licensed-media publication, and real commerce/advertising remain disabled until they pass. Isolated production-candidate provisioning and test-data validation may proceed earlier under P5-T08.

### Phase 0 — Product, Rights, and Delivery Foundations

#### P0-T01 — Approve MVP product brief and launch configuration

**Description:** Maintain one brief that separates the approved development baseline from Public Release Readiness decisions covering distribution, customer-localized pricing, EUR reporting/settlement, legal entity and registration details, target audience, content rating, catalog, and success/stop criteria.

**Objective:** Allow approved architecture and bootstrap work to proceed while preventing release or real monetization with unresolved legal, rights, financial, or store requirements.

**Dependencies:** None.

**Acceptance criteria:**

- [x] English is approved as the MVP product language.
- [x] Storefront-localized customer prices and EUR reporting/desired settlement are approved.
- [x] Decision D-001 approves 21 EU/EUR countries as the MVP distribution scope, and D-024 records France as the intended legal-entity country.
- [x] Phase 1 may start with local/emulated/fake services, generated test data, and self-owned/generated test media without real credentials.
- [ ] Before ads-only public release, the French entity's legal name/form, incorporation, registered address, D-U-N-S where required, organization accounts, and AdMob production configuration are approved and verified. Store IAP EUR-compatible Apple/Google bank configuration is required before P7 IAP, not before ads-only launch.
- [x] MVP inclusions/exclusions and monetization defaults are approved (ads-only, hardcoded free window, guest boundary, 1 series; 2026-08-27).
- [ ] KPI definitions, ads-only UA budget ceiling, and stop/go review date are documented. Experiment guardrails belong to P4-T05 / P7, not this remaining P0-T01 closer.

**Validation and integration tests:**

- [ ] Product, engineering, growth, and legal/content owners review the same brief.
- [ ] Trace every MVP screen and backend domain in this plan to at least one approved user journey.

#### P0-T02 — Complete content-rights and media-requirements checklist

**Description:** Define the contractual metadata and technical delivery package required from each future licensor. Development uses only self-owned, generated, or purpose-made test media and does not require a commercial license package.

**Objective:** Ensure every published asset is legally and technically distributable.

**Dependencies:** Approved decisions D-001, D-002, and D-023. Remaining P0-T01 Public Release Readiness items are not dependencies.

**Acceptance criteria:**

- [ ] Checklist covers territories, platforms, languages, dates, exclusivity, edits, advertising rights, promotion clips, royalties, takedown SLA, DRM, subtitles, and age rating.
- [ ] Media specification covers vertical aspect ratio, codecs, audio, captions, posters, episode numbering, checksums, and source quality.
- [ ] No title can be marked publishable without required rights records.

**Validation and integration tests:**

- [ ] Run the checklist against one sample licensing package and record gaps.
- [ ] Legal/content owner signs off before any real media reaches production.

#### P0-T03 — Create product policy and store-compliance matrix

**Description:** For ads-only MVP, map rewarded ads, account deletion, privacy, consent, and age rating to Apple, Google Play, AdMob, GDPR, and the national requirements of the 21 approved MVP markets. IAP/coin/subscription disclosures, store billing, restore, and storefront EUR settlement are **P7 policy** and do not close this task. UK GDPR review is a gate for a future United Kingdom expansion and is outside MVP scope.

**Objective:** Avoid building ads, privacy, and deletion flows that stores or regulators reject. Do not wait on P7 IAP finance to document the ads-only path.

**Dependencies:** Approved decisions D-001, D-002, D-021, and the approved business target in D-022. D-005 through D-007 are founder-approved for MVP ads (2026-08-27). D-008 and D-009 remain Proposed and are required only before P7 IAP, not before ads-only MVP behavior. Store IAP EUR settlement (D-022 financial setup) is required before P7 IAP, not before this ads-only P0-T03 slice.

**Acceptance criteria:**

- [ ] Rewarded-ad consent, reward disclosure, SSV/grant authority, and account deletion are documented for ads-only MVP.
- [ ] Privacy policy, terms, content policy, support contact, and data-deletion process have owners and deadlines for the ads-only binary.
- [ ] IAP/coin/subscription disclosures, store billing default, restore, and EUR store settlement remain **P7 policy**; they do not close P0-T03 for ads-only MVP.

**Validation and integration tests:**

- [ ] Compliance reviewer walks through free, locked, rewarded-ad, and deletion screens against the matrix. Coin, subscription, and restore walkthroughs wait for P7.
- [ ] Store review notes template explains the ads-only business model and test account path.

#### P0-T04 — Establish architecture decision records and cost model

**Description:** Record the decisions in this plan as ADRs and build a unit-cost model for database, API, video processing, CDN egress, analytics, ads, and store commissions.

**Objective:** Make technical tradeoffs and contribution economics explicit.

**Dependencies:** Accepted technical decisions D-010 through D-013, D-015, and D-016, plus approved pricing/reporting decisions D-021/D-022. D-014 is accepted as Bunny Stream default with GCP Cloud CDN fallback; P0-T04 records that ADR and a provisional cost baseline. P2-T05 **Android** proved Bunny (2026-08-26, D-026); iOS play deferred; **production video-provider configuration still waits** (credentials, D-019, public-release gates). P0-T01, P0-T02, and P0-T03 may proceed in parallel.

**Acceptance criteria:**

- [x] ADRs exist for monorepo, modular monolith, Firebase Auth, Supabase PostgreSQL, video delivery (Bunny default / GCP CDN fallback), RevenueCat, and Firebase analytics/experimentation.
- [x] The video ADR records D-014 as Bunny Stream default with GCP Cloud CDN fallback; completing P0-T04 requires a `VideoProvider` boundary and provisional cost assumptions for both paths. P2-T05 remains the on-device proof for Bunny.
- [x] Cost sheet supports minutes watched, renditions, egress, MAU, purchases, and ad revenue inputs.
- [x] Thresholds for reconsidering Supabase, CDN, transcoder, and MMP are documented.

**Validation and integration tests:**

- [x] Model one small beta, target launch, and 10× scenario.
- [x] Confirm infrastructure variable cost flows into cohort contribution margin.

### Checkpoint 0 — Public-release feasibility (not a Phase 1 gate)

- [ ] Launch configuration, rights checklist, policy matrix, and cost model are approved.
- [ ] A sample content package can meet the proposed ingestion contract.
- [ ] Any mandatory DRM requirement for licensed release content is known before licensed-media ingestion or production provider selection/configuration; D-019 does not block local fixtures or the self-owned/generated test-media proof-of-concept.

Phase 1 may begin before Checkpoint 0 passes. Checkpoint 0 remains mandatory before licensed media, production configuration, or public release.

---

### Phase 1 — Repository, Local Development, and Continuous Integration

#### P1-T01 — Create and protect the public monorepo

**Description:** Create `shortform-streaming`, add the agreed directory structure, ownership rules, issue/PR templates, contribution guide, and branch protection.

**Objective:** Provide one auditable home for backend, mobile, infrastructure, and documentation.

**Dependencies:** None. Accepted architecture decisions D-010 through D-013 provide the bootstrap baseline; unfinished legal/entity/store work and P0 cost/right refinements are not dependencies.

**Acceptance criteria:**

- [ ] Repository is public, the default branch is protected, and pull requests require passing checks.
- [ ] `sources/`, real media, environment files, keys, and credentials are ignored.
- [ ] README explains setup, architecture, and common commands.

**Validation and integration tests:**

- [ ] Fresh clone on a clean machine reaches the documented bootstrap checkpoint.
- [ ] A deliberate secret-pattern test is blocked by scanning without committing a real secret.

#### P1-T02 — Bootstrap backend and local PostgreSQL

**Description:** Create the Django project, settings split, health endpoints, local Compose database, and Python quality/test configuration.

**Objective:** Produce a repeatable, production-shaped backend foundation.

**Dependencies:** P1-T01.

**Acceptance criteria:**

- [ ] Django starts locally from documented commands and connects to PostgreSQL.
- [ ] Settings fail fast when required production configuration is absent.
- [ ] Live and readiness endpoints distinguish process health from database readiness.

**Validation and integration tests:**

- [ ] Ruff, type check, migration check, and pytest pass.
- [ ] Readiness returns success with PostgreSQL available and failure when it is unavailable.

#### P1-T03 — Bootstrap Expo mobile application

**Description:** Create the strict TypeScript Expo app with Expo Router, development-build configuration, environment handling, linting, tests, and a minimal API health screen.

**Objective:** Prove mobile-to-local-backend connectivity early.

**Dependencies:** P1-T01, P1-T02.

**Acceptance criteria:**

- [ ] App runs in an Android development build and is structured by feature.
- [ ] Environment selection is explicit and no secret is embedded in the JavaScript bundle.
- [ ] A screen displays backend availability using the typed client layer.

**Validation and integration tests:**

- [ ] Type check, lint, Jest, and Expo configuration validation pass.
- [ ] Android emulator calls the local health endpoint successfully; document iOS equivalent.

#### P1-T04 — Establish OpenAPI contract and generated client

**Description:** Generate the REST schema from Django and generate a TypeScript client package consumed by mobile.

**Objective:** Detect backend/mobile contract drift automatically.

**Dependencies:** P1-T02, P1-T03.

**Acceptance criteria:**

- [ ] Error envelope, pagination, auth, and public ID conventions are represented in OpenAPI.
- [ ] Generated client is reproducible and not manually edited.
- [ ] CI fails when generated artifacts differ from the schema.

**Validation and integration tests:**

- [ ] Contract generation produces no diff on a clean checkout.
- [ ] Mobile health call compiles and passes against a running backend.

#### P1-T05 — Build baseline CI workflows

**Description:** Add path-aware GitHub Actions for backend, mobile, schema generation, container build, and dependency/security checks.

**Objective:** Make every pull request independently verifiable.

**Dependencies:** P1-T02, P1-T03, P1-T04.

**Acceptance criteria:**

- [ ] Backend CI runs lint, types, migration drift, unit/integration tests, and coverage.
- [ ] Mobile CI runs lint, types, unit tests, config validation, and a production JavaScript bundle check.
- [ ] Container build and OpenAPI drift checks run without cloud credentials.

**Validation and integration tests:**

- [ ] A known failing test blocks merge in a temporary branch.
- [ ] A documentation-only change avoids unnecessary expensive jobs while required checks remain valid.

#### P1-T05A — Align Dependabot drift to latest compatible versions

**Description:** Follow-up to P1-T05. Restore the Expo SDK 57 and Django 6.1 mutually compatible dependency set after overlapping Dependabot merges, add ignore rules for known-incompatible majors, and restore Jest 29 after Dependabot PR #35 bumped Jest 30 (incompatible with jest-expo 57 / expo-doctor). Record the compatible set in `docs/runbooks/compatible-dependency-set.md`. Do not rewrite ADR 0002.

**Objective:** Land one compatible set, keep Application CI Mobile green, and stop Dependabot from immediately reopening Expo/RN/ESLint/Jest-incompatible bumps.

**Dependencies:** P1-T05.

**Acceptance criteria:**

- [ ] Manifests and lockfiles describe the Expo SDK 57 table (RN 0.86.x, React 19.2.3, ESLint 9.x, TypeScript 6.x, jest ~29.7 / @types/jest 29.5.14).
- [ ] Django 6.1 with matching stubs; CI and Docker Python 3.14.
- [ ] Dependabot ignores prevent immediate reopen of incompatible majors, including jest and @types/jest >=30.
- [ ] The compatible set is recorded in `docs/runbooks/compatible-dependency-set.md`. ADR 0002 is not rewritten.

**Validation and integration tests:**

- [ ] Frozen lock install, repository foundation, expo-doctor, and mobile lint/types/tests/config/bundle checks pass.

### Checkpoint 1 — Engineering foundation

- [ ] A new developer can clone, bootstrap, run API and mobile, and execute all checks.
- [ ] Mobile calls Django locally through a generated client.
- [ ] Pull requests cannot merge with a failing required check.

---

### Phase 2 — Identity, Catalog, and First Playable Vertical Slice

#### P2-T01 — Integrate Firebase Authentication with Django

**Description:** Implement mobile email/password auth first, Firebase ID-token attachment, Django token verification, and idempotent profile creation. Add Apple/Google providers after the base flow works.

**Objective:** Establish trusted identity without building an auth system.

**Dependencies:** P1-T04, P1-T05.

**Acceptance criteria:**

- [ ] Anonymous catalog use works; protected endpoints require a valid token.
- [ ] Django maps Firebase UID to one local profile and never trusts client-supplied user IDs.
- [ ] Token expiry/revocation paths produce consistent unauthorized responses.

**Validation and integration tests:**

- [ ] Unit tests cover missing, malformed, expired, and valid tokens with emulator/mocked verification.
- [ ] Device signs up, calls `/v1/me`, signs out, signs in again, and receives the same profile.

**P2-T01-F1** (GitHub issue #50) wires native `@react-native-firebase/auth` on the Android development build against the Auth emulator. Jest and CI keep `createLocalMockFirebaseAuth` / `FIREBASE_AUTH_MODE=mock`. Missing `GoogleService-Info.plist` must not fail Android or CI JavaScript export (D-027). Do not commit `google-services.json`.

**P2-T01-F2** (GitHub issue #85) adds Android Google Sign-In on the same native Auth path; Jest/CI remain mock; iOS Apple/Google observation is a later D-026 ship pass.

**P2-T01-F3** (GitHub issue #89) is **deferred under D-027** (ads-only MVP is Android / Google Play only). Apple Sign-In is still required before any iOS public storefront / TestFlight-quality pass; it is not N/A and is not an ads-only MVP blocker.

#### P2-T02 — Implement account lifecycle, consent, and deletion

**Description:** Add locale/country/consent state, profile API, logout behavior, data export request placeholder, and a verifiable deletion workflow spanning Django and Firebase.

**Objective:** Provide privacy-safe account control from the beginning.

**Dependencies:** P2-T01, P0-T03 ads/privacy/deletion slice. IAP/coin/subscription disclosures and store EUR settlement are P7 policy and do not block this task.

**Acceptance criteria:**

- [x] User can initiate deletion in-app with reauthentication where required.
- [x] Personal profile and push identifiers are deleted or irreversibly anonymized; financial audit records retain only legally necessary pseudonymous fields.
- [x] Deletion is idempotent and has an auditable status.

**Validation and integration tests:**

- [x] Integration test creates an account with progress/entitlements, deletes it, and verifies inaccessible/anonymized data.
- [x] Repeating the deletion command does not recreate or corrupt the account.

Evidence (2026-08-31, P2-T02): preferences and opt-in defaults, same-account
password/Google reauthentication, recent-auth deletion, local cascading, durable
Firebase cleanup/retry, and an explicit export-unavailable placeholder. The
Android development build on Pixel_9 completed synthetic signup → preference
save → password reauthentication → deletion against isolated PostgreSQL and the
Firebase Auth emulator. Profile/progress/entitlement and Firebase user counts
were zero afterward; the completed receipt erased its raw UID. Full `pnpm check`
and Android JS export pass. See `docs/runbooks/account-lifecycle.md` for exact
checks, operational follow-ups, retention gates, and rollback restrictions.
Push identifiers and financial audit models are not implemented yet; their
processor-specific deletion/retention integration is required before they ship.

#### P2-T03 — Implement catalog, rights, localization, and Django Admin

**Description:** Add Series, Season, Episode, Genre, ContentRight, localized text, publication state, artwork, and usable admin screens with validations and filters.

**Objective:** Let staff manage a rights-aware catalog without a custom web product.

**Dependencies:** P1-T02. Implement and test the rights-aware model with generated metadata and self-owned/generated test media; P0-T02 is required before real licensed media is admitted.

**Acceptance criteria:**

- [ ] Admin supports ordered episodes, inline rights visibility, draft/published states, and search/filtering.
- [ ] Rights and publication validation prevent invalid windows and missing required metadata.
- [ ] API returns only content eligible for request territory, platform, language, and time.

**Validation and integration tests:**

- [ ] Model/admin tests cover invalid rights, duplicate ordering, and publish restrictions.
- [ ] Seed two territories and verify each API client sees only its eligible title.

#### P2-T04 — Build home catalog and series-detail mobile screens

**Description:** Implement editorial rails, loading/error/empty states, series cards, detail page, episode list, and locked/free indicators.

**Objective:** Deliver the discovery path from app open to an episode selection.

**Dependencies:** P2-T03, P1-T04.

**Acceptance criteria:**

- [ ] Home and detail screens work anonymously and respect localization.
- [ ] Images are responsive, cached appropriately, accessible, and have fallbacks.
- [ ] UI never infers entitlement solely from episode number; it displays API access state.

**Validation and integration tests:**

- [ ] Component tests cover loading, error, empty, published, and locked states.
- [ ] Maestro opens the app, selects a series, and selects a free episode against seeded staging/local data.

#### P2-T05 — Prove Bunny Stream playback (GCP Cloud CDN fallback)

**Description:** Spike the default path: upload a test vertical master through the `VideoProvider` to Bunny Stream, encode ABR HLS, and play it on an Android development build with a short-lived token. iOS development-build play is deferred to D-026 (required before iOS public storefront / TestFlight-quality pass, not for this PR). If Bunny fails this spike, a license/residency/support constraint forbids it, or measured cost/reliability is worse, spike the documented GCP fallback (private GCS → Transcoder → Cloud CDN signed access) before continuing.

**Objective:** Retire the highest technical and cost risk on the chosen default before building the full player.

**Dependencies:** P1-T03 plus the video ADR and provisional video-cost baseline from P0-T04. P2-T05 proves or rejects Bunny Stream as the production default; it does not re-open D-014 unless Bunny fails. Use only self-owned, generated, or purpose-made test media; commercial licensing is not a proof-of-concept dependency.

**Acceptance criteria:**

- [x] 9:16 test media produces ABR HLS and thumbnails with correct rotation, audio, duration, and captions on Bunny Stream (live 2026-08-25: 1080×1920, 3.0s, audio, captions, 3 thumbnails; renditions 240p/360p/480p/720p/1080p). Plan “360/540/720” is an example ABR ladder; this library’s default had **no 540p**, with 360p and 720p present — not a failed spike.
- [x] An Android development build plays adaptive HLS through expiring token access using `expo-video` (not Bunny’s web player) (Pixel emulator, 2026-08-26, `/playback-spike`). iOS development-build play is deferred to D-026 and remains required before iOS ship; it is not N/A forever.
- [x] Unsigned and expired token access fail (403); Django remains the authorizer; cost per source minute is recorded (0.05 min, USD 0 encode). Hotlink / empty-referrer blocking was intentionally off so native `expo-video` can play (Stream **Block Direct URL File Access** off); token auth still denies unsigned/expired.
- [x] Bunny did not fail this spike; GCP Cloud CDN fallback was not activated; D-014 was not reopened.

**Validation and integration tests:**

- [x] Android device notes recorded (2026-08-26 Pixel emulator): normal local network; startup to play succeeded on `/playback-spike`; constrained-network / rebuffer instrumentation was not run on a 3s clip; seek and background/foreground were not separately timed.
- [ ] iOS Maestro/device E2E remains a ship / iOS-pass item under D-026, not a P2-T05 close-out gate.
- [x] Bunny met requirements; GCP fallback spike not activated; D-014 not reopened.

#### P2-T06 — Implement production media ingestion workflow

**Description:** Add MediaAsset state machine, checksum/deduplication, signed staff upload, Bunny Stream (default `VideoProvider`) job submission/status reconciliation, caption validation, thumbnail output, and admin retry/takedown that also expires/deletes the provider asset. Keep a GCP Transcoder adapter unplugged unless the fallback is activated. Develop with provider fakes and self-owned/generated test media; real licensed media is admitted only after P0-T02 review.

**Objective:** Make ingestion repeatable, auditable, and safe for licensed media.

**Dependencies:** P2-T03, P2-T05.

**Acceptance criteria:**

- [x] States cover pending upload, uploaded, processing, ready, failed, blocked, and removed.
- [x] Duplicate callbacks/retries are idempotent and failures expose safe admin diagnostics.
- [x] An episode cannot publish until a ready media asset and valid rights exist.

**Validation and integration tests:**

- [x] Integration test runs a short self-owned/generated fixture through upload → job → ready using a provider fake and a non-production smoke test against Bunny Stream (or the GCP fallback if that path is active); no production provider credential is required for local checks.
- [x] Corrupt upload, checksum mismatch, failed job, retry, and takedown paths pass.

Evidence (2026-08-27): PR #56 merged; Fake CI ingest tests; optional Bunny smoke reached ready; D-014 not reopened; production signed PUT is #55.

#### P2-T07 — Implement entitlement-aware playback authorization

**Description:** Create the server policy evaluator and playback authorization endpoint that checks publication, rights, territory, auth, episode entitlement, and free policy before signing playback access. Subscription evaluation waits for P7.

**Objective:** Centralize content authorization and keep storage private.

**Dependencies:** P2-T01, P2-T03, P2-T06.

**Acceptance criteria:**

- [x] Response grants only eligible playback and otherwise returns machine-readable lock reasons/offers.
- [x] Signed access is short-lived, HTTPS-only, and never persisted in analytics or logs.
- [x] Authorization decisions are consistent under concurrent requests and clock boundaries.

**Validation and integration tests:**

- [x] Decision-table tests cover free, entitled, expired rights, wrong territory, unpublished, takedown, and anonymous cases. Subscription cases wait for P7.
- [x] Integration test confirms a granted URL plays and the same path fails after expiry or rights removal.

Evidence (2026-08-28): P2-T07 / #68; Fake provider decision-table authorize tests; D-006 hardcoded `Episode.order` 1–5 per season; optional Firebase on authorize; no AccessPolicy/offers/AdMob.

#### P2-T08 — Build vertical player, progress, and autoplay

**Description:** Implement the full-screen 9:16 player, controls, captions, next episode, resume progress, progress heartbeats, completion, error recovery, and accessibility.

**Objective:** Deliver the core viewing loop before monetization complexity.

**Dependencies:** P2-T04, P2-T07.

**Acceptance criteria:**

- [x] Playback handles buffering, interruption, background/foreground, seek, orientation lock, and next-episode transition (full-screen 9:16 `expo-video` player, native controls, portrait lock, AppState pause/resume, autoplay next only after a second authorize grant).
- [x] Progress writes are throttled and idempotent; completion is server-recorded (`WatchProgress` + `GET`/`PUT /v1/progress/{episode_id}`).
- [x] Player exposes safe error states and does not reveal signed URLs.

**Validation and integration tests:**

- [x] Unit tests cover progress thresholds and resume logic.
- [x] Android emulator/development-build observation: free play, mid-watch resume, completion, autoplay next on grant, locked season order 6 does not play and does not mint (P2-T08-F1 / #82; Pixel_9, anonymous FR, local Django + non-production Bunny). Maestro/iOS is not a close-out gate (D-026 iOS ship pass).

Evidence (P2-T08 / #78): anonymous device-scoped progress without `UserProfile`; authenticated profile subject ignores `X-Device-Id`; lock is HTTP 403 and never mints; autoplay next is a second authorize; Harbor Lights seed episodes 1–6. On-device (#82): completed episodes replay from 0; mid-watch still resumes.

### Checkpoint 2 — First playable product

- [ ] Staff can ingest and publish a rights-valid test series.
- [ ] Anonymous user discovers and watches free episodes end to end.
- [ ] Signed playback, territory restrictions, progress, and takedown are verified.
- [ ] Playback performance baseline and cost per watch-hour are recorded.

---

### Phase 3 — Rewarded ads and episode unlock

#### P3-T01 — Implement access-policy and offer configuration

**Description:** Model per-series/episode access methods for MVP: free versus rewarded-ad lock, hardcoded/admin-configured free count (D-006), and ad availability, with safe server defaults. Do not require coin or subscription offer types for MVP (those remain P7 with IDs P3-T02–T06).

**Objective:** Change free-window and ad availability without treating the client as authoritative.

**Dependencies:** P2-T07, P0-T03 ads/privacy slice. IAP/coin/subscription disclosures and store EUR settlement are P7 policy and do not block this task.

**Acceptance criteria:**

- [x] `/offers/{episode}` returns only currently legal/available methods with display metadata. MVP methods are existing entitlement, free policy, or rewarded-ad lock.
- [x] Invalid combinations are rejected in admin and server defaults work without Remote Config.
- [x] Published policy changes are auditable.

**Validation and integration tests:**

- [x] Decision-table tests cover free versus rewarded-ad lock and failure fallback. Coin and subscription offer types are not required.
- [x] Changing free count in staging updates the lock screen without an app release and cannot bypass server checks.

Evidence (2026-08-28): P3-T01 / #84; AccessPolicy + `GET /v1/offers/{episode_id}`; D-006 defaults when no row; authorize ignores client free-window; anonymous locked offers omit rewarded-ad (D-005).

#### P3-T07 — Implement rewarded-ad intent and verified reward grant

**Development complete (founder-approved scope, 2026-08-31, D-028):** Test-only
backend/Android implementation and independent reviews completed; full repository
gate passes (280 backend, 90 mobile, 49 repository tests), Android native build
and JS export pass. Production remains disabled. Operator identity, privacy
contact, published consent configuration and genuine provider → entitlement →
device playback evidence are deployment/release gates, not P3-T07/PR #97 merge
or subsequent MVP coding prerequisites. The unobserved journey is not a pass.
See `docs/runbooks/rewarded-ads.md` for exact evidence.
Release work transferred from #96 to
[P6-T05A / #98](https://github.com/pedroharaujo/shortform-streaming/issues/98).

**Description:** Create a server reward intent bound to user/episode, show an AdMob rewarded ad with custom data, verify server-side callbacks, and grant one idempotent episode entitlement.

**Objective:** Monetize non-payers without allowing fabricated client rewards.

**Dependencies:** P3-T01, P2-T08.

**Acceptance criteria:**

- [x] User explicitly opts in and sees the exact reward before the ad starts: tests and Android demo-device observation.
- [x] Implemented server grant path requires a valid, unused, unexpired intent and authentic provider callback; client completion only polls status and cannot grant. Verified by signed integration tests; production enablement is separate release work.
- [x] Duplicate, mismatched, expired, and forged callbacks cannot grant access: cryptographic and transaction/race tests.

**Validation and integration tests:**

- [x] Test-only configuration and native demo Test Ad verified; publisher requests require a local Android development emulator and SDK test-device configuration. Production and unsupported publisher contexts fail closed.
- [x] Automated reward/API/client, consent, replay/forgery, entitlement and fresh-authorization controls pass; independent reviews complete. No provider end-to-end result is inferred from these checks.

**Deferred release acceptance (D-028):** #98 requires the actual operator/contact,
final notice/UMP setup, a completed test ad → genuine signed callback → one
entitlement → authorized Android playback, and production activation review.
Setup prerequisites still apply before any publisher-owned ad test. P6-T04,
P6-T05A and the final launch checklist carry these gates; P3-T08 development may
proceed with production ads disabled.

#### P3-T08 — Build locked-episode offer sheet (ads-only)

**Development complete (founder-approved deferral, 2026-08-31, D-029):** The mobile offer sheet,
current-access refresh, playback authorization, and login/preferences return
navigation are implemented and independently reviewed. `pnpm check` passes
(280 backend, 104 mobile, 49 repository tests); Android JS export passes.
The required Maestro attempt could not run in the implementation environment
(CLI unavailable, no connected Android device); it is **deferred, not passed**, to
the consolidated P6-T03 final validation pass. Genuine provider success and
release setup remain #98/D-028/P6-T05A. P3-T08-F1 / #99 adds account-bound,
sanitized cross-remount/restart recovery without persisting provider bindings or
playback URLs. See `docs/runbooks/rewarded-ads.md` for evidence.

**Description:** Present the rewarded-ad unlock offer from the API, including loading, accessibility, errors, and post-success transition to playback. Coin and subscription offers wait for P7.

**Objective:** Create one coherent ads-only monetization surface for MVP.

**Dependencies:** P3-T01, P3-T07, P2-T08.

**Acceptance criteria:**

- [x] Only server-authorized methods appear. MVP shows rewarded-ad unlock when locked.
- [x] Repeated taps and remount/restart recovery reuse the account-bound idempotency request; a known pending intent is status-only (P3-T08-F1 / #99).
- [x] Every success refreshes authoritative entitlement state before playback.

**Validation and integration tests:**

- [x] Component tests cover the ad offer, unavailable ads, offline, and success.
- [ ] Maestro validates the ad unlock path from a locked episode. **Deferred to P6-T03 under D-029; required before release/production enablement.**

### Checkpoint 3 — Ads-only integrity

- [ ] Rewarded-ad unlock works on real test devices and converges on server entitlements (SSV, unused intent, authentic callback).
- [ ] Concurrency, replay, mismatched, expired, and forged reward-grant tests pass.
- [ ] No mobile request can directly set entitlement.
- [ ] Store-policy checklist for IAP/restore moves with P7 IAP tasks; it is not an MVP checkpoint.

---

### Phase 4 — Thin measurement for UA validation

#### P4-T01 — Implement analytics governance and event SDK

**Foundation in progress (P4-T01-F1 / #104):** The canonical event dictionary,
typed mobile schemas, deterministic event IDs, prohibited-value filtering and a
provider-independent client are implemented first with collection disabled by
default. Firebase transport, consent/identity lifecycle, screen instrumentation,
backend boundary and DebugView evidence remain the ordered F2–F4 slices in #104;
this foundation alone does not mark P4-T01 complete or authorize collection.

**Consent lifecycle implemented (P4-T01-F2a/F2b / #104):** The matching native
Firebase Analytics module is added with collection, automatic screen reporting,
advertising identifiers and advertising consent disabled by default. A tested
process-wide controller cleans old identity/data before a current server-confirmed,
analytics-consented profile may be enabled and fails closed on stale sessions or
provider errors. Sign-in, preference updates, sign-out, session replacement and
account deletion now drive that controller. F3/F4 still own product event triggers;
production processing remains blocked on D-020/privacy/store approval and P6
clearance.

**Discovery instrumentation implemented (P4-T01-F3a / #104):** A process-wide
runtime now injects allowlisted app/session context, checks the current consent
controller at send time, and deduplicates accepted logical events across remounts
and retries. It owns cold/foreground `app_open`, successfully rendered
`home_viewed`, ordered `series_impression`, and eligible `series_opened` triggers.
Tests prove an ordered consented discovery trail and zero transport events before
consent. F3b still owns playback start/progress/complete, lock display, and
safe-coded playback errors; F4 owns reward/backend diagnostics. Production
transport remains hard-disabled pending the existing approvals.

**Description:** Publish event dictionary, property schemas, ownership, retention, consent rules, and a typed mobile/backend analytics wrapper with deterministic event IDs for MVP events: `app_open`/campaign, episode start/complete, `lock_shown`, `ad_offer`, `ad_rewarded`, and `playback_error`. Coin, subscription, push, and experiment events wait for P7.

**Objective:** Produce decision-grade events for the ads-only loop instead of inconsistent ad hoc tracking.

**Dependencies:** P2-T08, P3-T08, P0-T03 ads/privacy slice. IAP/coin/subscription disclosures and store EUR settlement are P7 policy and do not block this task.

**Acceptance criteria:**

- [ ] Canonical MVP events in Section 6 have definitions, trigger timing, required properties, and data classification.
- [ ] Debug validation rejects unknown events/properties and production strips prohibited sensitive values.
- [ ] Anonymous-to-authenticated identity linking is documented and consent-aware.

**Validation and integration tests:**

- [ ] Analytics contract tests validate representative MVP events against schemas.
- [ ] Execute free and rewarded-ad journeys and verify one correctly ordered event trail per journey in Firebase DebugView. Coin and subscription journeys wait for P7.

#### P4-T06 — Implement campaign attribution and deferred deep linking baseline

**Description:** Capture install/referrer/deep-link campaign parameters, preserve first and last touch, and route users to the one launch series while respecting privacy choices and platform attribution frameworks. This is not an MMP integration (P4-T07 / D-018 remain P7).

**Objective:** Connect creative spend to content consumption and verified ad revenue.

**Dependencies:** P4-T01, P2-T04.

**Acceptance criteria:**

- [ ] Campaign/ad set/creative identifiers persist with documented attribution windows.
- [ ] Deep link opens the one eligible launch series or a safe fallback after install/login.
- [ ] iOS privacy prompts and Android referrer handling follow current platform/policy requirements.

**Validation and integration tests:**

- [ ] Test direct, organic, and campaign links across installed, fresh-install, logged-out, and unavailable-content cases.
- [ ] Synthetic campaign joins through to verified reward and cohort LTV from ad yield.

### Checkpoint 4 — Thin measurement for UA

- [ ] Campaign parameters persist and the deep link opens the one series or a safe fallback.
- [ ] Typed MVP events fire for free and rewarded-ad journeys.
- [ ] Warehouse models, Looker dashboards, Remote Config experiments, MMP, and push remain P7.

---

### Phase 5 — Production Infrastructure, Security, and Observability

#### P5-T01 — Provision staging infrastructure as code

**Description:** Define staging Cloud Run, Artifact Registry, Secret Manager (including Bunny Stream credentials), Storage buckets for non-video artifacts, Tasks/Scheduler, DNS, budgets, and least-privilege IAM with OpenTofu/Terraform. Provision GCS + Cloud CDN + Transcoder only if the D-014 GCP fallback is activated.

**Objective:** Create a reproducible environment without console-only drift.

**Dependencies:** P2-T05, P1-T05.

**Acceptance criteria:**

- [ ] Plan is reviewable and apply is repeatable with remote encrypted state.
- [ ] Non-video buckets are private, public access prevention is enforced, and lifecycle/CORS rules are minimal. GCS HLS origin/CDN exist only if the GCP video fallback is active.
- [ ] Budget alerts and labels identify product, environment, owner, and cost center.

**Validation and integration tests:**

- [ ] Apply to an empty staging project, run smoke tests, and run a second plan with no unexpected diff.
- [ ] IAM negative tests prove app/runtime identities cannot administer unrelated resources.

#### P5-T02 — Containerize and harden Django deployment

**Description:** Build a small non-root container, static-file handling for Admin, migrations release step, connection pooling strategy, timeouts, concurrency, and zero-downtime-compatible startup.

**Objective:** Run Django safely and economically on Cloud Run.

**Dependencies:** P5-T01, P1-T02.

**Acceptance criteria:**

- [ ] Image is deterministic, non-root, scanned, and contains no build secrets.
- [ ] Migrations are serialized and separate from request startup.
- [ ] Readiness prevents traffic before dependencies and migrations are ready.

**Validation and integration tests:**

- [ ] Container integration tests exercise Admin/API, static assets, shutdown, and database connection recovery.
- [ ] Deploy a backward-compatible migration and rollback application revision without schema corruption.

#### P5-T03 — Implement secure CI/CD with workload identity

**Description:** Authenticate GitHub Actions to GCP using OIDC Workload Identity Federation, deploy immutable images to staging automatically, and require approval for production.

**Objective:** Make deployments repeatable without long-lived cloud keys.

**Dependencies:** P5-T01, P5-T02.

**Acceptance criteria:**

- [ ] Trust is restricted to the exact repository/branch/environment and least-privilege deploy identity.
- [ ] Staging deploy runs migrations, smoke tests, and records image digest/commit.
- [ ] Production has approval, concurrency lock, rollback command, and deployment audit trail.

**Validation and integration tests:**

- [ ] Untrusted branch/fork cannot obtain deploy credentials.
- [ ] Deploy a staging revision, fail a smoke test intentionally, and verify traffic does not promote.

#### P5-T04 — Establish secrets, configuration, and key rotation

**Description:** Inventory secrets and signing keys, store them in Secret Manager/provider vaults, document owners/rotation, and prevent secrets in logs, images, analytics, or EAS updates.

**Objective:** Reduce credential compromise risk and support incident response.

**Dependencies:** P5-T01, P5-T03.

**Acceptance criteria:**

- [ ] Each environment has distinct database, Firebase, AdMob, CDN, and Django secrets. RevenueCat secrets are required before P7 IAP; staging can exist without RevenueCat for MVP.
- [ ] Runtime identities can access only needed secret versions.
- [ ] Rotation supports overlap where external callbacks/signing require it.

**Validation and integration tests:**

- [ ] Rotate a staging key/secret without downtime and revoke the old value.
- [ ] Secret scanning tests detect representative fake patterns and logs remain redacted.

#### P5-T05 — Implement application security baseline

**Description:** Apply OWASP ASVS/MASVS-informed controls: secure storage, TLS, validation, authorization, rate limiting, CORS/CSRF, admin hardening, App Check signals, dependency scanning, and abuse controls.

**Objective:** Protect accounts, licensed content, commerce, and operational interfaces.

**Dependencies:** P3-T07, P5-T04. Full commerce reconciliation (P3-T09) remains P7; MVP security covers ad-grant integrity.

**Acceptance criteria:**

- [ ] Mobile tokens use platform secure storage and are absent from logs/backups where controllable.
- [ ] Admin has MFA/SSO-compatible access, restricted exposure, session security, and role separation.
- [ ] Rate/abuse controls cover auth, playback authorization, progress, unlock, reward, and webhook endpoints.

**Validation and integration tests:**

- [ ] Authorization matrix and OWASP checklist are executed against staging.
- [ ] Automated tests cover IDOR, replay, mass assignment, injection, rate limits, CSRF on Admin, and webhook forgery.

#### P5-T06 — Add backend and mobile observability

**Description:** Configure structured correlated logs, metrics, traces, errors/crashes, performance spans, uptime checks, dashboards, and alerts with privacy-safe context.

**Objective:** Detect and diagnose failures before they erase revenue or trust.

**Dependencies:** P5-T02, P4-T01.

**Acceptance criteria:**

- [ ] Correlation ID links mobile/API errors without exposing tokens or signed URLs.
- [ ] Dashboards cover API latency/error, DB saturation, tasks, webhooks, transcoding, CDN, playback, app crashes, and commerce mismatch.
- [ ] Alerts have severity, owner, actionable threshold, and runbook link.

**Validation and integration tests:**

- [ ] Trigger controlled API error, mobile crash, failed webhook, and playback failure; verify capture and redaction.
- [ ] Uptime and business-critical synthetic checks alert and recover through the documented path.

#### P5-T07 — Create backups, recovery, and incident runbooks

**Description:** Define backup/restore, media durability, RPO/RTO, incident roles, rollback, compromised key, payment mismatch, takedown, and provider outage procedures.

**Objective:** Make failures recoverable by a small team.

**Dependencies:** P5-T04, P5-T06.

**Acceptance criteria:**

- [ ] Production database plan includes automated backups and point-in-time recovery appropriate to launch risk.
- [ ] Runbooks cover API outage, database issue, CDN/video failure, auth outage, purchase/reward discrepancy, rights takedown, and data incident.
- [ ] Provider dependencies and fallback user messaging are documented.

**Validation and integration tests:**

- [ ] Restore a staging backup into an isolated environment and reconcile ledger/entitlements.
- [ ] Run one tabletop incident and one rollback drill; record time, gaps, and actions.

#### P5-T08 — Provision isolated production-candidate infrastructure

**Description:** Apply the reviewed infrastructure to an isolated production-candidate environment, upgrade the database from free tier, and configure domain/TLS, quotas, budgets, retention, and operational access. Provisioning and validation use generated test data and non-licensed test media only.

**Objective:** Validate a launchable environment with backups and predictable blast radius without prematurely activating public production.

**Dependencies:** P5-T01 through P5-T07.

**Acceptance criteria:**

- [ ] Production is isolated from staging with separate credentials, projects, data, and media.
- [ ] Candidate region choices are documented against D-001, latency, rights, privacy, and provider constraints; D-020 approval is required before public activation.
- [ ] Cost alerts, quota alerts, backup/PITR, audit logs, and break-glass access are enabled.
- [ ] Before Public Release Clearance, the environment cannot receive public traffic and contains no live store products/ad units, licensed media, production user data, or commercial organization/payout credentials.

**Validation and integration tests:**

- [ ] Full production-candidate smoke test uses non-licensed test content and test accounts only, with public ingress and commercial integrations disabled.
- [ ] Security, recovery, observability, and cost-control checklists are signed off.

**Public activation dependency:** P6-T05A Public Release Clearance. Infrastructure may be provisioned and validated in isolation before that task; traffic promotion and commercial configuration may not.

### Checkpoint 5 — Operational readiness

- [ ] Staging and production are reproducible from code.
- [ ] CI/CD uses short-lived identity and tested rollback.
- [ ] Security test, restore drill, incident exercise, alert exercise, and cost review pass.
- [ ] Production database is not on a pausing/no-backup hobby configuration.

---

### Phase 6 — Mobile Quality, Beta, and Store Launch

#### P6-T01 — Complete mobile design system, accessibility, and localization

**Description:** Standardize typography, color, spacing, safe areas, motion, skeletons, errors, accessibility, locale formatting, translated strings, and RTL readiness.

**Objective:** Deliver a coherent product that can expand across markets.

**Dependencies:** P3-T08.

**Acceptance criteria:**

- [ ] Core screens meet WCAG-informed contrast/touch-target expectations and support dynamic text/screen readers where practical for video UI.
- [ ] No user-facing string is hard-coded outside localization. Store price strings wait for P7 IAP.
- [ ] Long translations and small supported screens do not block primary actions.

**Validation and integration tests:**

- [ ] Run automated accessibility checks plus manual TalkBack and VoiceOver passes on core journeys.
- [ ] Screenshot tests cover launch locales, long strings, and representative device sizes.

#### P6-T02 — Harden offline, degraded, and update behavior

**Description:** Define cached catalog behavior, offline messaging, retries, maintenance mode, forced/minimum version, API compatibility, and EAS Update runtime-version policy. Min-version and kill switch may be build-config or a server flag without a Remote Config experiment layer (P4-T04 is P7).

**Objective:** Fail gracefully under real mobile conditions.

**Dependencies:** P5-T06.

**Acceptance criteria:**

- [ ] No purchase/debit/reward action is presented as successful without server confirmation.
- [ ] Last-known catalog can render with clear offline state; playback and monetization fail safely.
- [ ] Kill switch and minimum-version path do not trap users without store guidance.

**Validation and integration tests:**

- [ ] Test airplane mode and network loss during playback, rewarded-ad unlock, auth, progress, and config fetch. Store purchase paths wait for P7.
- [ ] Verify compatible EAS update applies and incompatible runtime update is rejected.

#### P6-T03 — Build full regression and device matrix

**Description:** Define supported OS/device/network matrix and automate critical paths in Maestro, with manual coverage for store dialogs, ads, captions, accessibility, and background behavior. Maintain the consolidated, step-by-step deferred-validation register in `docs/runbooks/final-validation.md`; every D-029 deferral must identify prerequisites, exact commands/actions, expected evidence, owner, and the release/enablement gate it blocks.

**Objective:** Make releases repeatable across the riskiest combinations.

**Dependencies:** All MVP feature tasks.

**Acceptance criteria:**

- [ ] Automated suite covers anonymous free viewing, login at lock, progress, rewarded-ad unlock, deletion, takedown, and campaign deep link. Coin, subscription, store restore, and push are P7 regression.
- [ ] Matrix includes low/mid/high Android, supported iPhones, poor network, and current/oldest supported OS.
- [ ] Flaky tests have owners and cannot silently pass via unlimited retries.
- [ ] Every D-029 deferral is present in the consolidated runbook and is either passed with evidence or remains an explicit blocker; P3-T08 Android Maestro and #98 genuine provider validation are included.

**Validation and integration tests:**

- [ ] Release candidate passes the full suite twice from clean app state.
- [ ] Run exploratory session focused on money, entitlements, privacy, and playback interruptions.

#### P6-T04 — Prepare store listings, privacy declarations, and review package

**Description:** Create store metadata, screenshots, preview, age rating, privacy labels/data safety, support/privacy URLs, review notes, and test account/content. IAP descriptions and store product review paths wait for P7.

**Objective:** Submit a transparent, reviewable ads-only product.

**Dependencies:** P0-T03 ads/privacy/deletion slice, P6-T01, P6-T03. IAP/coin/subscription disclosures and store EUR settlement are P7 policy and do not block this task.

**Acceptance criteria:**

- [ ] Listings disclose that some episodes require a rewarded ad and match actual functionality. IAP/subscription metadata waits for P7.
- [ ] Privacy declarations match SDK/data inventory and consent behavior.
- [ ] Actual public operator identity, monitored privacy contact, final notice URL and app-specific UMP setup are verified before the applicable ad test/distribution; deferred P3-T07 setup is tracked in #98 (D-028).
- [ ] Reviewer can access representative free, locked, and rewarded-ad flows with provided instructions. Test ad units only.

**Validation and integration tests:**

- [ ] Independent reviewer follows the submission package without developer assistance.
- [ ] Compare binary SDK inventory, network observations, and data map to store declarations.

#### P6-T05 — Run closed beta and resolve launch blockers

**Description:** Distribute through TestFlight and Google Play closed testing, recruit representative users, monitor quality/funnels, and triage findings by severity.

**Objective:** Validate the complete system with real devices before paid acquisition.

**Dependencies:** P5-T08, P6-T03, P6-T04.

**Acceptance criteria:**

- [ ] Beta has agreed minimum devices/users and includes both stores.
- [ ] Beta uses AdMob test ad units only; no live commercial product, ad, payout, or acquisition configuration is enabled. Store sandbox products wait for P7 IAP.
- [ ] No open severity-1/2 issue, commerce mismatch, rights leak, or unexplained critical funnel break remains.
- [ ] Playback, crash-free use, monetization, retention baseline, and support burden are reviewed.

**Validation and integration tests:**

- [ ] Reconcile every beta reward with server records. Store transaction reconciliation waits for P7.
- [ ] Repeat regression and rollback drill on the final release candidate.

#### P6-T05A — Obtain Public Release Clearance

**Description:** Assemble one signed ads-only release record proving product, rights, ads/privacy/deletion policy, ads-path cost, entity, AdMob production, security, and launch decisions are complete for the exact binary, catalog, configuration, and markets to be released. Store IAP finance, EUR settlement, and D-018 are not part of this ads-only record.

**Objective:** Provide one auditable hard gate between isolated validation and public distribution or real commercial activity.

**Dependencies:** P0-T01, P0-T02, P0-T03 ads/privacy/deletion slice, P0-T04, P5-T08, P6-T04, and P6-T05; every ads-only release-applicable Decision Register entry must be approved, including D-007 (approved 2026-08-27), D-017 before any paid acquisition, D-020 before public production activation, and D-025 before organization/store/payout activation. D-008 and D-009 are **not** required for ads-only public release; they are required before P7 IAP. D-018 is **not** required for ads-only public release; it is required before P4-T07 / material MMP. Do not silently approve D-017, D-018, D-019, D-020, or D-025.

**Acceptance criteria:**

- [ ] P0-T01 through P0-T04 have current owner approvals and evidence for the ads-only release candidate; no proposal is silently treated as approval. P0-T03 IAP/coin/subscription/EUR-settlement rows are P7 and do not block this clearance.
- [ ] The exact catalog passes territorial rights/provenance, DRM/protection, age/content, and promotional-use review for every enabled D-001 market.
- [ ] GDPR/privacy-by-design, consent, account deletion, security, accessibility, store policy/declarations, national legal/language requirements, support, incident response, and rollback checks pass.
- [ ] The French entity and required registration/organization data are verified; AdMob production configuration is approved for activation. Store IAP products and store IAP EUR settlement wait for P7.
- [ ] Release blocker #98 is closed with genuine completed test-ad → signed Google callback → one entitlement → fresh authorized Android playback evidence and independently reviewed production enablement. P3-T07 development completion does not satisfy this gate (D-028).
- [ ] D-017 defines the paid-acquisition ceiling and D-020 defines approved production data residency/retention before those activities start. D-018 is not an ads-only public-release gate. All other decisions applicable to the ads-only release are Approved rather than Proposed or Decision required.

**Validation and integration tests:**

- [ ] An independent reviewer traces every clearance item to dated evidence, named owner, release revision, enabled market list, and rollback/expiry condition.
- [ ] A release dry run with test accounts and non-licensed test media proves that public traffic, real products/ads, paid acquisition, and licensed-media publication remain disabled until the clearance approval is recorded.

#### P6-T06 — Launch with controlled rollout and daily command center

**Description:** Submit and release gradually by platform/market, monitor technical and business guardrails, and hold daily go/hold/rollback reviews during the first launch window.

**Objective:** Limit blast radius while establishing real unit-economics data.

**Dependencies:** P6-T05, Checkpoint 5, and P6-T05A Public Release Clearance. D-017 must be Approved before any paid-acquisition campaign is enabled.

**Acceptance criteria:**

- [ ] Rollout stages, owners, halt thresholds, support coverage, and rollback options are documented.
- [ ] Rights availability, ads, Firebase DebugView, AdMob earnings versus ads-manager spend, alerts, and budgets are checked immediately before release. Store prices/products and Looker dashboards wait for P7.
- [ ] Paid acquisition begins only within the D-017 approved cap, using traceable creative IDs.

**Validation and integration tests:**

- [ ] Production synthetic journey verifies catalog, free playback, lock, and non-financial health after each rollout stage.
- [ ] First rewards are manually reconciled and first campaign cohort is traceable end to end. First store purchases wait for P7.

### Checkpoint 6 — MVP launched

- [ ] Both apps are approved and released in the chosen market.
- [ ] Licensed catalog is available only within contractual rights.
- [ ] Daily contribution, quality, and funnel reporting is operating (Firebase DebugView and AdMob versus ads-manager spend; Looker is P7).
- [ ] Rollout decisions follow documented technical and business guardrails.

---

### Phase 7 — First phase after MVP launch: IAP, experiments, push, and growth platform

Phase 7 is the first phase after ads-only MVP launch. Relocated IAP, warehouse analytics, experiments, MMP, and push tasks keep their original IDs. Existing optimization tasks P7-T01–T04 remain after them and stay post-MVP.

#### P3-T02 — Implement immutable coin wallet and atomic episode unlock

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Build Wallet, immutable CoinLedgerEntry, balance calculation, idempotent debit command, and permanent episode entitlement grant in one transaction.

**Objective:** Prevent double spend and make virtual currency auditable.

**Dependencies:** P3-T01, P2-T01.

**Acceptance criteria:**

- [ ] Balance changes only through ledger entries; entries cannot be edited/deleted through normal admin.
- [ ] Debit and entitlement grant are atomic with row locking and idempotency.
- [ ] Insufficient balance, duplicate request, and price-change races return deterministic outcomes.

**Validation and integration tests:**

- [ ] Concurrent test submits duplicate and competing unlocks; no negative balance or duplicate charge occurs.
- [ ] Ledger reconciliation equals wallet balance and each successful debit maps to one entitlement.

#### P3-T03 — Configure store products and RevenueCat environments

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Define non-production and production product IDs, coin-pack consumables, subscription group/entitlement, offerings, webhook credentials, and product catalog ownership.

**Objective:** Align Apple, Google, RevenueCat, backend, analytics, and UI identifiers.

**Dependencies:** P0-T03 P7 IAP policy slice, P3-T01.

**Acceptance criteria:**

- [ ] Product matrix states type, base price tier, store-localized customer currency behavior, EUR settlement/reconciliation behavior, entitlement effect, and environment.
- [ ] Sandbox/test products are visible through RevenueCat in both platform builds.
- [ ] Secrets are environment-specific and stored outside source control.

**Validation and integration tests:**

- [ ] Automated configuration check detects missing/unknown product IDs.
- [ ] Sandbox devices fetch offerings from Apple and Google paths and display store-provided localized prices for test accounts in at least two currencies per platform; the app and backend never construct the price string.

#### P3-T04 — Implement RevenueCat webhook ingestion and subscription state

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Verify RevenueCat webhooks, store raw-event references safely, process idempotently, map customer identity, and maintain subscription state including renewal, grace, billing retry, cancellation, expiry, refund, and transfer.

**Objective:** Make server access reflect store lifecycle rather than client claims.

**Dependencies:** P3-T03, P2-T01.

**Acceptance criteria:**

- [ ] Webhook authenticity, replay protection, idempotency, and unknown-user quarantine exist.
- [ ] Subscription state changes are auditable and playback evaluator consumes them.
- [ ] Out-of-order and duplicate events converge to the correct current state.

**Validation and integration tests:**

- [ ] Replay recorded sandbox lifecycle events in different orders and verify final state.
- [ ] Active subscription authorizes a locked episode; expiry/refund removes subscription access but preserves separately unlocked episodes.

#### P3-T05 — Implement mobile subscription purchase and restore

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Build a transparent subscription paywall using store-localized products, purchase handling, restore/sync, manage-subscription link, and resilient pending/error states.

**Objective:** Allow compliant all-access subscription purchase on both stores.

**Dependencies:** P3-T04, P2-T08.

**Acceptance criteria:**

- [ ] Paywall clearly shows price, period, renewal, trial conditions, terms, privacy, and restore.
- [ ] Client waits for validated entitlement state and handles cancellation/pending/failure without false access.
- [ ] Same authenticated account restores eligible access on another device.

**Validation and integration tests:**

- [ ] Apple sandbox and Google license-tester purchase, renewal/expiry simulation, cancellation, and restore are executed.
- [ ] Maestro opens a locked episode, subscribes in test mode, synchronizes, and plays it.

#### P3-T06 — Implement coin-pack purchase fulfillment

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Purchase consumable coin packs through RevenueCat/store billing, credit the Django ledger from verified provider events, and handle retries/refunds according to the approved policy.

**Objective:** Sell coins without trusting the device or double-crediting transactions.

**Dependencies:** P3-T02, P3-T03, P3-T04.

**Acceptance criteria:**

- [ ] One verified store transaction creates at most one ledger credit.
- [ ] Client cannot choose the credited amount; backend maps known product ID to coins.
- [ ] Pending, cancelled, duplicate, delayed webhook, refund, and account-transfer cases are defined.

**Validation and integration tests:**

- [ ] Replay the same purchase/webhook repeatedly and confirm one credit.
- [ ] Sandbox purchase credits coins, coin unlock debits them, app reinstall restores server balance after login.

#### P3-T09 — Add commerce reconciliation and support tools

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Add scheduled reconciliation, quarantined-event review, safe admin views, compensating adjustments, and a user-facing purchase support identifier.

**Objective:** Operate real money and rewards without direct database edits.

**Dependencies:** P3-T04, P3-T06, P3-T07.

**Acceptance criteria:**

- [ ] Reconciliation detects provider/ledger/subscription mismatches without silently changing money.
- [ ] Authorized support staff can inspect history and create reasoned compensating entries, never edit history.
- [ ] Every action is audit logged with actor and reason.

**Validation and integration tests:**

- [ ] Seed missing, duplicate, delayed, refunded, and quarantined events; reconciliation reports expected cases.
- [ ] Role tests prove normal staff cannot issue adjustments or view sensitive provider payloads.

#### P4-T02 — Link Firebase data to BigQuery and build metric models

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Export Analytics/Crashlytics/Remote Config data, ingest server commerce/ad facts, and create version-controlled SQL models for funnels, retention, LTV, revenue, and playback quality.

**Objective:** Join behavior and authoritative financial outcomes in one analysis layer.

**Dependencies:** P4-T01, P3-T09.

**Acceptance criteria:**

- [ ] Dataset location, retention, partitioning, access, and cost controls are documented.
- [ ] Revenue models use verified server facts; client purchase events are diagnostic only.
- [ ] Definitions exist for net revenue, payer, active subscriber, ad revenue, CAC, LTV, and contribution.

**Validation and integration tests:**

- [ ] Seed a synthetic cohort with known outcomes and verify every metric exactly.
- [ ] Cost guardrails include partition filters, query limits, and budget alerts.

#### P4-T03 — Build launch dashboards and data-quality monitors

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Create Looker Studio dashboards for acquisition, content funnel, monetization, retention, playback, and experiment results; add freshness/volume/uniqueness monitors.

**Objective:** Make product and unit-economics decisions observable daily.

**Dependencies:** P4-T02.

**Acceptance criteria:**

- [ ] Dashboard filters include date, country, platform, app version, campaign, creative, series, episode, and experiment.
- [ ] Revenue and entitlement dashboards trace to authoritative records.
- [ ] Alerts detect missing exports, event collapse/spikes, duplicate transaction IDs, and broken funnels.

**Validation and integration tests:**

- [ ] Compare dashboard totals with database/provider samples for a controlled day.
- [ ] Stop a synthetic data feed and verify freshness alert reaches the documented channel.

#### P4-T04 — Implement Remote Config and experiment safety layer

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Integrate fetched/activated Remote Config with typed defaults, exposure logging, kill switches, minimum app versions, and server validation for financially material parameters.

**Objective:** Run experiments without creating unsafe or client-authoritative behavior.

**Dependencies:** P3-T01, P4-T01.

**Acceptance criteria:**

- [ ] App has last-known-good/default behavior when Firebase is unavailable or values are invalid.
- [ ] Experiment exposure logs once at actual use, not merely at config fetch.
- [ ] Server enforces allowed ranges and current price/access policy.

**Validation and integration tests:**

- [ ] Test malformed config, offline start, variant persistence, kill switch, and incompatible app version.
- [ ] Attempt client tampering with coin price/free count and confirm server rejects the bypass.

#### P4-T05 — Create experiment operating procedure and first experiments

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Define hypothesis template, primary metric, guardrails, sample-size check, duration, exposure, segmentation, stopping rules, and decision record. Queue free-episode count, offer order, coin price, and paywall copy experiments. Experiment guardrails formerly listed on remaining P0-T01 AC live here (P7), not as an ads-only launch closer.

**Objective:** Turn experimentation into a disciplined product process.

**Dependencies:** P4-T03, P4-T04.

**Acceptance criteria:**

- [ ] Every experiment has one primary decision metric and retention/playback/refund guardrails.
- [ ] Overlapping experiments with interacting parameters are prevented or explicitly designed.
- [ ] Results include practical effect size and cohort economics, not significance alone.

**Validation and integration tests:**

- [ ] Run an A/A or internal-only experiment to validate assignment and exposure joins.
- [ ] Reproduce experiment totals between Firebase and BigQuery within an explained tolerance.

#### P4-T07 — Decide and integrate an MMP at the paid-acquisition gate

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Before material ad spend, compare native attribution with Adjust/AppsFlyer or another approved MMP on required networks, SKAN/AdAttributionKit, fraud controls, cost, privacy, raw export, and BigQuery integration.

**Objective:** Buy reliable attribution only when its value exceeds cost and native limitations.

**Dependencies:** P4-T03, P4-T06.

**Acceptance criteria:**

- [ ] Decision memo defines the spend/ambiguity threshold that triggers adoption.
- [ ] If adopted, SDK is consent-gated, data-minimized, and mapped to canonical campaign dimensions.
- [ ] Network and MMP totals have a documented reconciliation method.

**Validation and integration tests:**

- [ ] Run controlled test campaigns with known links and compare attribution sources.
- [ ] Verify opt-out behavior and that deletion requests propagate where contractually required.

#### P4-T08 — Implement push notifications and lifecycle campaigns

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Add permission education, FCM/APNs token management, preferences, deep links, delivery/open analytics, quiet hours, and initial transactional/editorial campaigns.

**Objective:** Improve retention without spam or privacy violations.

**Dependencies:** P2-T01, P4-T01, P4-T06.

**Acceptance criteria:**

- [ ] Prompt occurs contextually; denial does not block the app.
- [ ] Tokens rotate, deduplicate, detach on logout/deletion, and are never shared between accounts.
- [ ] Campaigns respect preferences, locale, territory, content availability, and frequency caps.

**Validation and integration tests:**

- [ ] Test opt-in/out, token rotation, multi-device, logout/login, deletion, deep link, and expired content.
- [ ] Send staging notification to a controlled cohort and verify delivery/open events and correct routing.

#### P7-T01 — Operate the content and growth cadence

**Description:** Establish weekly catalog, creative, cohort, experiment, and rights reviews; prioritize by expected contribution impact.

**Objective:** Make the platform a learning system, not a feature factory.

**Dependencies:** P6-T06.

**Acceptance criteria:**

- [ ] Each series and campaign has a continue/iterate/stop decision with evidence.
- [ ] Experiment backlog is ranked by reach, impact, confidence, effort, and guardrail risk.
- [ ] Rights expiries and takedowns have proactive alerts and owners.

**Validation and integration tests:**

- [ ] Audit one monthly decision back to reproducible queries and experiment records.
- [ ] Simulate upcoming rights expiry and verify catalog/playback/push suppression.

#### P7-T02 — Add rule-based personalization and search only when justified

**Description:** Introduce editorial/rule-based ranking, continue-watching, genre rails, and simple PostgreSQL search after catalog size and user behavior justify them.

**Objective:** Improve discovery without premature ML/search infrastructure.

**Dependencies:** P7-T01.

**Acceptance criteria:**

- [ ] Baseline and target metrics are defined before implementation.
- [ ] Ranking remains explainable, territory-safe, and has a fallback.
- [ ] No separate search service is added until PostgreSQL measurements show need.

**Validation and integration tests:**

- [ ] Offline evaluation and A/B test compare against editorial baseline.
- [ ] Rights-ineligible or unpublished items never appear in results/recommendations.

#### P7-T03 — Execute infrastructure scale gates

**Description:** Use measured saturation/cost to decide on database upgrade/migration, cache, read replicas, CDN/provider negotiation, async worker separation, and API scaling.

**Objective:** Scale only proven bottlenecks.

**Dependencies:** P5-T06, P7-T01.

**Acceptance criteria:**

- [ ] Each change has measurement, threshold, expected benefit, rollback, and cost impact.
- [ ] Standard PostgreSQL compatibility and modular boundaries are preserved.
- [ ] Load test represents real playback-authorization, catalog, progress, and webhook traffic.

**Validation and integration tests:**

- [ ] Run current and 10× load profiles; document bottleneck and headroom.
- [ ] Disaster-recovery and reconciliation tests pass after infrastructure changes.

#### P7-T04 — Add owned-content production workflow

**Description:** After profitable content patterns emerge, extend rights/provenance metadata for commissioned or AI-assisted originals, production assets, approvals, disclosures, and licensing.

**Objective:** Improve margin and build owned IP using validated demand.

**Dependencies:** Sustained evidence from P7-T01, legal approval.

**Acceptance criteria:**

- [ ] Greenlight uses cohort evidence and a production budget/recoup model.
- [ ] IP ownership, contributor releases, model/tool licenses, likeness/voice rights, provenance, and disclosure requirements are recorded.
- [ ] Originals use the same ingestion, quality, localization, and analytics pipeline.

**Validation and integration tests:**

- [ ] Rights audit traces every production component to an approved source/license.
- [ ] Pilot original publishes and reports through the same end-to-end metrics without special-case code.

---

### Phase 8 — Future Consumer Web Client (Not MVP)

The backend is intentionally client-neutral. Do not start this phase until mobile product-market evidence, business priority, and store/payment policy review justify it.

#### P8-T01 — Approve web-client business and policy model

**Description:** Decide whether web is a marketing surface, authenticated reader/streaming client, or full commerce client; review cross-platform entitlement and store-linking rules by market.

**Objective:** Avoid accidentally undermining mobile compliance or economics.

**Dependencies:** P7-T01 and current legal/store review.

**Acceptance criteria:**

- [ ] Web goals, markets, SEO needs, payment model, entitlement portability, and support implications are approved.
- [ ] Mobile messaging about web purchases is separately policy-approved by storefront/region.
- [ ] Threat and video-compatibility review is complete.

**Validation and integration tests:**

- [ ] Written journey covers web purchase → mobile access and mobile purchase → web access, including refunds/expiry.
- [ ] Financial model includes payment fees, taxes, fraud, support, and cannibalization.

#### P8-T02 — Create web application in the monorepo

**Description:** Add `web/` using Next.js/React TypeScript, generated API client, Firebase Auth, design tokens, and HLS playback; reuse API contracts, not mobile UI code.

**Objective:** Add an independently deployable consumer web client without splitting repositories.

**Dependencies:** P8-T01, stable API contract.

**Acceptance criteria:**

- [ ] Web consumes existing versioned REST API and server entitlements.
- [ ] CDN authorization supports browser-safe signed access and CORS.
- [ ] Web has separate build/deploy pipeline and does not affect mobile releases.

**Validation and integration tests:**

- [ ] Cross-client contract suite passes for catalog, auth, playback, progress, and entitlements.
- [ ] Supported browsers play HLS/fallback correctly and rights/takedown restrictions match mobile.

#### P8-T03 — Add web payments and unified entitlement reconciliation

**Description:** If approved, integrate Stripe or an appropriate web payment provider, tax handling, fraud controls, webhooks, subscription lifecycle, and cross-platform entitlement mapping.

**Objective:** Monetize web while preserving one auditable access model.

**Dependencies:** P8-T01, P8-T02.

**Acceptance criteria:**

- [ ] Web payment facts are idempotently recorded and mapped to the same subscription/entitlement policy.
- [ ] Store and web subscriptions have defined precedence, duplicate-subscription prevention, refund, cancellation, and support rules.
- [ ] Tax, invoices, chargebacks, SCA, privacy, and terms are implemented for approved distribution countries.

**Validation and integration tests:**

- [ ] Provider test lifecycle covers success, SCA, renewal, failure, refund, dispute, cancellation, and replay.
- [ ] Same account receives correct access on web/iOS/Android after every lifecycle event.

---

## 8. Cross-Cutting Test Strategy

### Test pyramid

- **Backend unit tests:** domain policy, rights, ledger, webhook ordering, reward verification, analytics schemas.
- **Backend integration tests:** PostgreSQL transactions/locks, API auth, migrations, tasks, provider adapters.
- **Mobile unit/component tests:** state, rendering, analytics triggers, paywall branches, offline/error handling.
- **Contract tests:** generated OpenAPI client against Django and provider webhook fixtures.
- **Device E2E:** Maestro on Android and iOS development/release candidates.
- **Cloud smoke tests:** real staging Firebase, Supabase, Cloud Run, Bunny Stream (or GCS/CDN/Transcoder if the fallback is active), and AdMob test ads. RevenueCat sandbox waits for P7.
- **Security tests:** authorization matrix, webhook forgery/replay, rate limits, dependency/container scans, OWASP checklist.
- **Performance tests:** API load, playback authorization latency, catalog response, database concurrency, HLS startup/rebuffer.
- **Recovery tests:** database restore, deploy rollback, key rotation, provider event replay/reconciliation.

### Required MVP release regression journeys

1. Anonymous install → campaign deep link → series → free episode → progress/resume.
2. Sign up at locked episode → continue same journey.
3. Rewarded ad → verified entitlement → playback.
4. Offline/network-loss cases during free playback and rewarded-ad unlock.
5. Account deletion removes/anonymizes data and detaches tokens.
6. Rights takedown immediately removes catalog/playback access.

### Required P7 regression journeys (deferred from MVP 2026-08-27)

4. Coin pack purchase → verified credit → atomic debit → playback.
5. Subscription purchase → server sync → catalog access → expiry/refund behavior.
6. Restore on second device.
7. Offline/network-loss cases during every IAP monetization path.
8. Push opens eligible series/episode; expired content falls back safely.

### Test data rules

- Use generated users and short self-owned, generated, or purpose-made test videos in automated/local/staging tests; record provenance and permitted test use.
- Never copy production personal data into staging.
- Real licensed media is not required for development. Keep licensed masters out of Git, fixtures, screenshots, and public test builds, and do not admit them to staging or production before rights review.
- Provider payload fixtures must be redacted and immutable.

---

## 9. Security, Privacy, and Abuse Checklist

- TLS everywhere; HSTS on public web endpoints.
- Firebase ID token verified on server; authorization is object-level and server-side.
- No direct mobile access to PostgreSQL or private media buckets.
- Short-lived CDN authorization, private origins, key rotation, and safe cache rules.
- Secure token storage; no tokens/receipts/signed URLs in logs or analytics.
- Idempotency and replay protection for all money/reward actions.
- Immutable ledger, compensating corrections, transaction uniqueness, and reconciliation.
- Webhook authenticity verification, body-size limits, timeouts, quarantine, and audit trail.
- Rate limiting and anomaly detection for auth, playback tokens, ads, unlocks, progress, and purchases.
- Admin least privilege, MFA, audit logs, protected access, and no shared accounts.
- Secret Manager/provider vaults; no long-lived GCP keys in CI.
- Dependency updates, lockfiles, SBOM/container scanning, secret scanning, SAST, and patch cadence.
- Privacy data inventory, minimization, consent, retention, export/deletion, processor agreements, and SDK review.
- Age rating and content warnings match catalog and acquisition creatives.
- Fraud/abuse signals may block rewards or require review but must not silently confiscate purchased coins.
- Incident and takedown channels are staffed for the launch window.

---

## 10. CI/CD and Branching Policy

- Trunk-based development with short-lived branches and pull requests.
- Conventional commit or equivalent consistent change descriptions.
- Required checks: backend, mobile, contract drift, container, security, and relevant infrastructure plan.
- Every merge to main deploys staging after checks.
- Production deploy uses a tagged/release commit, environment approval, immutable image digest, migration gate, smoke test, and progressive traffic.
- Database migrations follow expand/migrate/contract; destructive contract steps are separate releases.
- EAS Update only ships changes compatible with the build's runtime version; native dependency/config changes require a new binary.
- Rollbacks reverse application traffic first. Never blindly reverse a destructive migration.

---

## 11. Environment and Configuration Matrix

Use three logical environments:

- **Local:** Docker PostgreSQL, Firebase emulators/mocks where practical, provider fakes, and self-owned/generated test video. Local bootstrap and its automated checks require no real cloud, store, advertising, payout, or organization-account credentials.
- **Staging:** isolated real cloud integrations, AdMob test units, non-licensed media. RevenueCat sandbox/store testers wait for P7.
- **Production:** isolated paid database, real ad units (public-release gate), licensed media, strict access and audit. Real store products wait for P7 IAP.

Configuration categories:

- Public mobile build configuration: API base URL, Firebase public app config, environment name, non-secret product/ad identifiers.
- Backend secrets: Django key, database URL, Firebase server credentials or workload identity, webhook auth, CDN signing material.
- CI deploy identity: short-lived Workload Identity Federation only.
- EAS credentials/signing: managed through EAS/Apple/Google systems, never `.env`.

Include `.env.example` with names and descriptions but no usable values.

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation / decision gate |
|---|---|---|
| Content license does not permit mobile territory, ads, clips, or required protection | Critical | Rights checklist and publish-time enforcement; DRM gate before ingestion |
| LTV does not exceed CAC | Critical | Ads-only test on one series with capped acquisition. A miss means ads cannot carry UA — **not** that microdrama or P7 IAP is dead. Explicit stop/cap on ads spend; next test is P7 IAP. |
| CDN egress destroys contribution margin | High | Watch-hour cost model, adaptive bitrates, caching, regional measurement, provider negotiation/abstraction |
| Store rejection or policy change | High | Ads-only MVP listings; store billing by default when P7 IAP ships; transparent disclosures; policy matrix reviewed before every submission |
| Fraudulent reward grants | High | Verified SSV, unused intent, authentic callback, idempotency, replay protection, anomaly detection |
| Fraudulent coin/IAP grants | High | P7: server ledger, verified webhooks, idempotency, replay protection, anomaly detection |
| Free database pauses or lacks recovery | High | Free only for development/early staging; paid production with backups/PITR |
| Expo native-module incompatibility | High | Development-build spike for video, Firebase, and AdMob before UI expansion; RevenueCat spike before P7 IAP |
| Attribution is too weak for growth decisions | High | Campaign IDs and Firebase events first; MMP still a spend gate (P7 / D-018) |
| Analytics numbers conflict | High | Server reward facts in MVP; P7 adds warehouse models, metric contracts, synthetic cohorts, reconciliation/data-quality alerts |
| Signed URLs are shared | Medium | Short TTL/prefix access, private origin, abuse monitoring; DRM/provider if contracts or leakage demand it |
| Webhooks arrive late/out of order | High | P7 IAP: immutable events, idempotent state reducers, reconciliation, quarantine, support tooling. MVP ads use SSV replay protection. |
| Small team operational overload | High | Managed services, modular monolith, runbooks, alerts with owners, no premature infrastructure |
| Privacy/SDK overcollection | High | Data inventory, consent, minimization, SDK review, deletion propagation, store declaration audit |
| Vendor lock-in | Medium | Standard PostgreSQL, provider adapters, OpenAPI, exportable analytics, ADR thresholds |
| Catalog is too small for retention | Medium | Validate acquisition/monetization first, then expand only evidence-backed genres |

---

## 13. Decisions Required for Coding vs. Public Release

### Required before coding the affected behavior

These do not all block Phase 1. Resolve each before implementing the feature that depends on it:

- Product/app name, visual brand, and repository organization owner before final branded UI/assets.
- Initial series/free-episode baseline and guest-to-account conversion point before their catalog/auth UX behavior. D-004–D-007 approved 2026-08-27.
- Rewarded-ad grant model before P3-T07 (approved 2026-08-27, D-007).
- Coin pack sizes, episode prices, subscription period/price, and trial choice before **P7 IAP**, not before MVP ads.
- Data residency and retention behavior before production-shaped retention/deletion automation.
- Technical DRM/provider choice if the proof-of-concept or a future contract requires it.

### Required before public release (ads-only MVP)

These are deferred from the Phase 1 coding path but remain hard ads-only release gates. They do **not** include P7 IAP, store EUR settlement, Looker/BigQuery models, Remote Config A/B, push, or MMP adoption:

- French entity legal name and form, incorporation, registered address, D-U-N-S where required, tax/organization enrollment data, and store-account countries.
- Actual public operator identity and monitored privacy contact, published notice/UMP setup, and genuine rewarded-ad release validation (#98, D-028). These do not block MVP coding or PR #97; required consent setup still precedes any publisher-owned ad test.
- Per-market territorial rights, GDPR/privacy review, national legal/language requirements, age rating, allowed content categories, store declarations, and consent behavior for the 21 approved launch countries.
- Final license terms, commercial-media provenance, protection/DRM obligations, and approval of every title before it enters staging or production.
- AdMob production configuration before real advertising.
- Initial acquisition budget (D-017), support owners, incident-response owners, ads-only launch guardrails, and stop/go review date. D-017 remains **Decision required** until the founder approves it.

### Required before Phase 7 IAP / growth platform (not ads-only launch)

- Verified Apple bank-account currency and Google payments profile/bank configuration for **store IAP** EUR settlement.
- Coin pack sizes, subscription period/price, IAP disclosures, and restore/sync policy (D-008/D-009 remain Proposed).
- MMP adoption threshold (D-018) before P4-T07 / material MMP. D-018 remains **Decision required**; it is not an ads-only public-release gate.

No public production activation/traffic promotion, storefront distribution, licensed-media publication, paid acquisition, or real advertising may be enabled until every applicable **ads-only** Public Release Readiness gate is approved and verified. Real purchase/subscription stays disabled until the Phase 7 IAP gates pass. Isolated production-candidate provisioning and test-data validation remain permitted under P5-T08.

Already approved by the founder:

- The MVP user interface is in English.
- The initial catalog consists of English-language microdramas.
- Launch catalog is 1 licensed (or self-owned/generated test) series (D-004, 2026-08-27).
- Guest browse/watch free episodes anonymously; login required before rewarded-ad unlock (D-005, 2026-08-27).
- Initial free window is the first five episodes, hardcoded / admin-configured (D-006, 2026-08-27).
- One verified rewarded ad permanently unlocks one episode; this is the only MVP monetization path (D-007, 2026-08-27).
- Decision D-001 defines the approved MVP distribution scope of 21 EU countries using EUR.
- France is the intended legal-entity country; incorporation and legal/finance validation remain pending.
- Customer monetary prices use the localized currency and price string supplied by the active App Store or Google Play storefront (applies when P7 IAP ships).
- EUR is the company reporting currency and desired payout currency; actual settlement depends on eligible store-account, payments-profile, legal-entity, and bank configuration.

---

## 14. Suggested First 12 Implementation Moves

The accepted technical baseline permits this sequence now; Public Release Readiness work continues in parallel:

1. P1-T01 (S) — Complete/protect the repository and safety rules.
2. P1-T02 (M) — Bootstrap local Django/PostgreSQL and health checks.
3. P1-T03 (M) — Bootstrap the Expo development build against the local API.
4. P1-T04 (M) — Establish OpenAPI and the generated client.
5. P1-T05 (M) — Establish credential-free baseline CI.
6. P0-T02/P0-T03/P0-T04 (S–M each) — Continue rights, compliance, ADR, and cost readiness in parallel; do not block Phase 1 on company/store registration data.
7. P2-T03 (M) — Build the rights-aware catalog using generated metadata and self-owned/generated test media.
8. P2-T04 (M) — Build anonymous home/detail screens against local seeded data.
9. P2-T05 (M) — Prove Bunny Stream HLS (GCP Cloud CDN fallback only if Bunny fails) using only approved test media.
10. P2-T01 (M) — Add identity with emulator/mocked verification while preserving anonymous catalog access.
11. P2-T06/P2-T07 (M each) — Exercise ingestion and playback authorization with provider fakes and non-production credentials only where a smoke test requires them.
12. P2-T08 (M) — Complete anonymous discovery-to-free-play, progress, resume, and autoplay.

Do not start rewarded ads until Checkpoint 2 passes. Coins and subscriptions wait for P7.

---

## 15. Reference Links and Assumption Notes

These are primary sources used to validate changeable decisions. Recheck them at implementation and release time.

- Supabase pricing and free-plan limits: https://supabase.com/pricing
- Google Cloud Run pricing/free tier: https://cloud.google.com/run/pricing
- Google Cloud Storage pricing/free tier: https://cloud.google.com/storage/pricing
- Bunny Stream pricing and docs: https://bunny.net/pricing/ and https://docs.bunny.net/docs/stream-http-api
- Google Cloud CDN pricing (fallback): https://cloud.google.com/cdn/pricing
- Google Transcoder API overview and pricing (fallback): https://cloud.google.com/transcoder/docs and https://cloud.google.com/transcoder/pricing
- Cloud CDN signed access (fallback): https://cloud.google.com/cdn/docs/authenticate-content
- Firebase pricing: https://firebase.google.com/pricing
- Firebase Authentication: https://firebase.google.com/docs/auth
- Firebase A/B Testing: https://firebase.google.com/docs/ab-testing
- Firebase to BigQuery export: https://firebase.google.com/docs/projects/bigquery-export
- BigQuery free usage/sandbox: https://cloud.google.com/bigquery/docs/sandbox
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- RevenueCat with Expo: https://www.revenuecat.com/docs/getting-started/installation/expo
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple storefront pricing: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple banking and proceeds: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/ and https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play local-currency pricing and payments-profile settlement: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google Play merchant bank requirements: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en
- AdMob rewarded ads and server-side verification entry point: https://developers.google.com/admob/ios/rewarded
- GCP Workload Identity Federation for deployment pipelines: https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- OWASP Mobile Application Security/MASVS: https://owasp.org/www-project-mobile-app-security/ and https://mas.owasp.org/MASVS/

### Current cost/policy assumptions reviewed on 2026-08-23

- Supabase Free is appropriate for prototypes but can pause after inactivity and lacks production-grade backup/SLA features; public production should be paid.
- Cloud Run has an always-free allowance, but network and dependent services can still incur costs.
- Bunny Stream bills storage plus CDN delivery; encoding is included. GCP Cloud CDN plus Transcoder remains the fallback cost model.
- Cloud Storage has limited free usage in specified US regions; Cloud CDN is usage-priced if the fallback is active.
- Transcoder is pay-per-output-minute and each rendition affects cost if the GCP fallback is active.
- Firebase Analytics, A/B Testing, Crashlytics, and several engagement tools have no-cost allowances, but quotas/pricing can change; Remote Config pricing changes begin in September 2026.
- Apple and Google generally require their purchase systems for in-app digital content and virtual currency, subject to evolving regional programs and legal exceptions. The conservative default is store billing.
- Customer price currency and developer payout currency are separate: storefronts localize customer prices, while Apple pays in the configured bank-account currency and Google pays in the payments-profile currency. The business target is EUR settlement, subject to account and bank eligibility.
- RevenueCat and AdMob require native modules, so Expo development builds are required. AdMob is an MVP beta requirement; RevenueCat is required before P7 IAP.
- Rewarded ads are user-initiated exchanges for a stated reward; production rewards should use provider verification and idempotent server grants.

---

## 16. Public Release Readiness and Final MVP Completion Checklist

This is a hard publication gate, not a prerequisite for Phase 1 or isolated production-candidate validation. Until every applicable **ads-only** item is independently verified, production-candidate environments remain isolated and must not enable public traffic, storefront distribution, licensed media, paid acquisition, or real advertising. Real purchase/subscription stays off until the Phase 7 checklist passes.

### Ads-only MVP launch

When every item in this subsection is satisfied, the platform is suitable for ads-only real-market validation (rewarded-ad LTV versus capped UA). It does **not** wait on P7 coin/IAP/subscription, BigQuery/Looker models, Remote Config A/B, MMP, or push.

- [ ] Product, rights, ads/privacy/deletion policy, architecture, and ads-path cost decisions approved. IAP/coin/subscription/EUR-settlement policy remains P7.
- [ ] P6-T05A Public Release Clearance is independently approved for the exact ads-only revision, catalog, markets, and production configuration.
- [ ] Public protected monorepo and full CI operational, with no secrets, licensed media, or confidential contracts committed.
- [ ] Rights-aware catalog and Django Admin operational.
- [ ] Firebase auth and account deletion operational.
- [ ] Bunny Stream HLS pipeline and tokenized playback operational (GCP Cloud CDN fallback documented and unused unless activated).
- [ ] Vertical player, progress, and free episode journey operational.
- [ ] Rewarded-ad intent, SSV, and ad-grant entitlements operational (MVP ads path).
- [ ] MVP reward path is server-verified, idempotent, and supportable; #98 provides genuine provider/device evidence, operator/privacy setup and production approval (D-028).
- [ ] Thin Firebase Analytics events and campaign IDs operational (Firebase DebugView; AdMob earnings versus ads-manager spend).
- [ ] Staging/production IaC, secure CI/CD, backups, observability, security controls, and runbooks operational.
- [ ] Accessibility, localization, regression matrix, beta, and ads-only store compliance complete.
- [ ] Licensed launch catalog (1 series) and campaign creatives pass rights review.
- [ ] Controlled rollout and daily ads-only unit-economics review are ready.

### Phase 7 — IAP, warehouse analytics, experiments, MMP, and push

These items keep their original task IDs. They are the first post-MVP phase. Completing them is **not** required before ads-only market validation.

- [ ] Coin ledger/unlock, store coin packs, subscription, and restore operational.
- [ ] Full IAP commerce reconciliation operational.
- [ ] Store IAP EUR settlement, IAP disclosures, and restore/sync policy approved (D-008/D-009 remain Proposed until then).
- [ ] BigQuery models, Looker dashboards, Remote Config experiments, and push operational.
- [ ] MMP adopted or explicitly declined at the D-018 spend/ambiguity threshold (P4-T07). D-018 stays Decision required until that gate.

The platform is not yet a studio, distributor, consumer web service, or mature recommendation platform; those expansions depend on evidence from the mobile acquisition and monetization loop.

# Microdrama Platform — Product and Implementation Plan

**Document status:** Founder strategy updated; new MVP work planned, release readiness open
**Language:** English  
**Last reviewed:** 2026-09-07
**Repository:** `pedroharaujo/shortform-streaming` (public monorepo)  
**MVP client:** Android / Google Play only; Django Admin is the only web interface. iOS is post-MVP (D-027).

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

### Strategy amendment and task traceability (P0-T01, 2026-09-07)

D-032 changes the MVP business hypothesis to contribution LTV versus CAC. D-007/D-008/D-015 bring Android coins into MVP; D-016 brings minimum economics measurement forward. This is a documentation/planning update only. Prior completed evidence remains valid for its original slice, not for newly added acceptance. Historical decisions and the 2026-08-27 P7 move are preserved in the decision register; this amendment supersedes their affected timing.

| Original task | Current MVP scope / sequence | Retained post-MVP scope |
|---|---|---|
| P2-T03, P3-T01 | Follow-ups P2-T03-F3 and P3-T01-F1: launch configuration, rights permissions, per-episode access | Additional market/language rollout UX |
| P3-T02 | Phase 3: immutable wallet, atomic coin unlock | None of the required Android coin integrity deferred |
| P3-T03 | Phase 3: Google Play coin products/RevenueCat setup | P3-T03-P7: Apple products and subscription setup |
| P3-T04 | Phase 3: verified coin purchase/webhook lifecycle | P3-T04-P7: subscription state/renewal/grace/expiry |
| P3-T06 | Phase 3: Android coin-pack fulfillment | Apple fulfillment with later iOS phase |
| P3-T08 | Existing rewarded-ad foundation; P3-T08-F2 adds configured coin/both options | Subscription offer UX with P3-T05 |
| P3-T09 | Phase 3: Android purchase/ledger/refund/reward reconciliation/support | Subscription reconciliation with P3-T04-P7/P3-T05 |
| P4-T01 | Existing events; P4-T01-F5 adds commerce and acquisition schemas/facts | Subscription/push/experiment events |
| P4-T02 | Phase 4: minimum Firebase→BigQuery, financial/spend/cost joins, SQL economics | P4-T02-P7: expanded exports/experiment models |
| P4-T03 | Phase 4: reproducible daily report and required data-quality checks | P4-T03-P7: Looker/advanced dashboards |
| P4-T06 | Phase 4: minimum reliable source/campaign/creative cohort attribution | P4-T06-P7: advanced deferred deep linking unless required for the first test |
| P4-T07 | Conditional D-018 decision if initial attribution is insufficient | Full MMP integration only when justified; no default SDK |

Dependency order for the next development phase: P2-T03-F3 → P3-T01-F1 → P3-T02 and P3-T03 → P3-T04 → P3-T06 → P3-T08-F2/P3-T09. Then P4-T01-F5 and P4-T06 feed P4-T02 → P4-T03 → P6-T03/T04/T05/T05A → capped launch. Independent foundational work may proceed in parallel; product prices, private license approvals, privacy and D-017 spend approval remain gates for their dependent production behavior. No extra worktrees are required.

P2-T03-F3, P3-T01-F1 and P3-T02 merged in PRs #139, #140 and #143. The local
Android wallet/coin-choice slice of P3-T08-F2 is implemented under #142; full
P3-T08-F2 remains open. Next, P3-T03/T04/T06 must connect known Google Play products
to verified server credits, and #144 must safely resolve ambiguous unlocks.
Commercial prices and production activation remain separate approvals.

### Definition of Done for Every Task

- Acceptance criteria are demonstrably satisfied.
- New behavior has automated tests at the appropriate level.
- Existing test suites, linting, type checks, and builds pass.
- Security, privacy, analytics, accessibility, and localization impacts are considered.
- Documentation and environment examples are updated.
- No secrets, real user data, or licensed media are committed.

---

## 2. Product Summary

Build an Android-first microdrama app to answer: **Can we acquire users profitably? Can contribution LTV become greater than CAC for acquired users in our initial market and target audience?** Engagement and retention alone are insufficient; MVP includes real rewarded-ad and purchased-coin monetization plus a small capped paid-acquisition test.

> Campaign/creative → acquired user → series → free episodes → configured ad or coin unlock → continued viewing → reconciled cohort contribution.

Launch with approximately **3–5 independently approved series**, France, English and one defined target audience (selection pending D-035). Prefer €0 upfront license cost, €0 minimum guarantee where possible, revenue share and non-exclusive agreements where possible. This commercial target does not restrict supported contract structures; private percentages, terms, suppliers and assets stay outside public Git.

**Build the platform so it can grow, but validate the business with the smallest possible market scope.** France/Android/English/one audience are launch configuration, not permanent domain assumptions. Additional markets/languages/clients require later activation approval, but market/rights/localization/segment dimensions must not require a core-domain redesign.

### Business layers and long-term sequence

1. Clear approximately 3–5 titles and their acquisition creatives independently.
2. Validate engagement, retention, real monetization and acquisition economics in the narrow approved test.
3. Expand catalog, markets and distribution only on evidence and new approvals.

## 3. MVP Scope and Product Decisions

### Included in MVP

- Android / Google Play React Native/Expo app; Django/DRF modular monolith and Django Admin.
- Independently approved English self-owned/licensed catalog in France, vertical HLS player, discovery, captions, autoplay and progress.
- Anonymous free viewing; Firebase email/password and Google Sign-In (D-030); account required before purchases, monetized unlocks and cross-device sync.
- Server/Admin per-episode policy: free, rewarded-ad, coin, or both ad and coin methods. First five episodes remain an initial free default, not a permanent hardcoded rule.
- Opt-in AdMob rewards verified by SSV; no interstitials or forced mid-episode ads.
- Google Play consumable coin packs via RevenueCat, immutable Django ledger, persistent balance, idempotent credit, atomic debit plus entitlement, refunds/chargebacks and reconciliation.
- Typed consent-gated product/commerce events and minimum Firebase→BigQuery/server/provider/spend/cost joins, SQL models and daily reporting for contribution LTV/CAC.
- Simplest reliable campaign/creative attribution for the D-017 capped acquisition test, with privacy/coverage limitations explicit.
- Fail-closed rights/publication/window/territory/language/platform/protection/takedown checks, private media, staging/production, CI, security, observability, consent and deletion.

### Explicitly excluded from MVP

- iOS/Apple commerce and release work, subscriptions, consumer web, additional-market/language rollout UX.
- Recommendation ML, automated royalty accounting, public contracts/rates/suppliers/media.
- UGC, social/chat, offline downloads, live streaming, household profiles, TV apps.
- Microservices, Kubernetes, Kafka, Elasticsearch, GraphQL, custom Admin or custom DRM.
- Direct credit-card checkout for mobile digital goods.
- Remote Config A/B experiments, Looker dashboards, push/lifecycle campaigns, expanded warehouse exports.
- Full MMP unless D-018 justifies it; advanced deferred deep linking unless necessary for the initial paid test.

### Default access and monetization rules

- Treat launch territory, client/storefront and language as server-controlled configuration, with generalized localized metadata and audience/content segment dimensions (D-034). Clients cannot widen eligibility by supplying headers/profile locale or market values.
- Check rights, publication, takedown, availability window, territory/platform/language, age/content restrictions and protection before any playable media or monetized grant. Existing entitlements never bypass ineligibility.
- Within eligible content: valid existing entitlement → configured free access → locked with only operator-configured, license-permitted methods. Revalidate method, server coin price and eligibility during debit/grant, including concurrent policy/takedown changes.
- Operators may set early episodes free, later ad-enabled or both, and particular cliffhangers coin-only. No automatic cliffhanger detection.
- Rewarded ads stay opt-in, state the reward and occur between episodes. One verified reward can grant the configured persistent episode entitlement.
- Coin packs and episode costs are configurable; D-008 commercial sizes/prices/terms remain open. Never infer coin balance, purchase verification or entitlement from client success.
- Use store-provided localized Google Play monetary strings in MVP. Preserve original financial currency; report in EUR with traceable FX. Verify Google settlement before real IAP. Apple settlement remains later.
- Reinstall/second Android device loads the server balance and entitlements. Reconcile consumables without duplicate fulfillment; subscription restore remains P7.

### Content rights decisions

- Every MVP licensed title must permit France streaming, Android/Google Play, required English originals/subtitles/dubs, free episodes, rewarded ads, coin transactional access and paid acquisition using cleared clips/trailers/posters/stills/likenesses (D-031).
- Record private revenue-share/reporting, windows, takedown/termination, exclusivity and protection obligations. €0 upfront/MG does not eliminate content cost.
- Only opaque private references and synthetic non-confidential enforcement fixtures enter public Git. No contracts, suppliers, rates, production payloads, personal data or licensed media.
- Missing, mismatched, expired, taken-down or unsupported-DRM rights fail closed. Future territories/languages and monetization permissions remain separate grant dimensions.

### Initial success metrics

Primary: **contribution LTV / CAC**, with observed contribution and explicit projection assumptions. No universal pass/fail threshold is approved. D-017 must approve budget and business guardrails before spend.

- Acquisition: spend, installs/acquired users, CAC, source/campaign/creative and unmatched coverage.
- Engagement: first play, episode completion/continuation, lock reach, D1/D7/D30 retention.
- Advertising: rewarded-ad acceptance, verified impressions/rewards, net ad revenue/user.
- Commerce: payer conversion, coin-pack purchase conversion/sales, ARPPU, IAP revenue/user, refunds/chargebacks.
- Business: blended net revenue/user, revenue-share and other content cost, contribution LTV, LTV:CAC, series and practical campaign/creative economics.
- Quality: playback startup/rebuffer/error, crashes/API reliability and financial/entitlement mismatches.

[Analytics definitions](docs/analytics/README.md) and [COST_MODEL.md](docs/product/COST_MODEL.md) own denominators, source authority, cohort maturity, consent coverage and cost/revenue allocation. Do not equate MAU, installs, accounts and deduplicated acquired users.

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
- Post-MVP iOS development will require a separate macOS/Xcode/EAS setup; it is not an MVP prerequisite.

### Accounts required before beta

- Public GitHub repository.
- Google Cloud billing account and separate staging/production projects.
- Firebase staging/production projects.
- Supabase organization and database projects.
- Expo/EAS project.
- Apple Developer Program and App Store Connect only for later iOS work.
- Google Play Console.
- Google AdMob and RevenueCat/Google Play license-tester setup for MVP beta; production configuration remains separately gated.
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
- Expo development builds; Expo Go is not sufficient for AdMob and native Firebase modules. Google Play coin purchases require the RevenueCat native module in MVP.
- TanStack Query for server state; a small Zustand store only for transient UI/session state.
- `expo-video` for HLS playback, subject to an early proof-of-concept.
- React Hook Form and Zod for forms and client validation.
- React Native Testing Library and Jest; Maestro for end-to-end device tests.

**Identity and mobile platform services**

- Firebase Authentication with email/password and Google Sign-In for the Android MVP (D-030).
- Firebase Analytics and Crashlytics in MVP; App Check remains MVP-facing. Remote Config, A/B Testing, and Cloud Messaging wait for P7 (ADR 0003 timing). Performance Monitoring may land with observability or wait for P7.
- Django verifies Firebase ID tokens and owns application profiles and authorization.

**Database**

- Supabase managed PostgreSQL for development and early staging because its free tier is useful for prototyping.
- Upgrade production to a paid Supabase plan before public launch; the free plan has pausing, backup, resource, and SLA limitations.
- Keep standard PostgreSQL and Django migrations so migration to GCP Cloud SQL remains straightforward.
- The mobile app never connects directly to Supabase.

**Video**

- Bunny Stream is the default: staff start a self-owned master upload in Django Admin; the existing ingestion workflow validates it, submits it to Bunny, and reconciles ready metadata.
- Django issues playback authorization only after publication/takedown and entitlement checks, then returns a short-lived HLS URL the app plays in `expo-video` (not Bunny’s web player).
- Keep a `VideoProvider` boundary. The documented fallback is private GCS → Google Transcoder → Cloud CDN signed access; activate it only if Bunny fails P2-T05, a license/residency/support constraint forbids Bunny, or measured cost/reliability is worse. D-019 may still require a DRM-capable provider.
- Do not run both pipelines in production. Video delivery is a paid variable cost; free tiers are not a realistic streaming business model at scale.

**Monetization**

- Google AdMob rewarded ads in MVP, using test ad units outside production and server-side verification in production.
- RevenueCat Android SDK/webhooks for coin product presentation and verified purchase lifecycle in **MVP**; subscription state is **P7** (ADR 0006).
- Google Play Billing consumable coin packs in **MVP**. Apple IAP and all subscriptions remain **P7**.
- Immutable Django coin ledger for persistent virtual-coin balance and atomic episode unlocks — **MVP**.

**Analytics and experimentation**

- Firebase Analytics typed event collection in MVP.
- Firebase Remote Config and A/B Testing for paywall position, free-episode count, coin price, ad offer, and messaging — **P7**.
- Minimum supported Firebase Analytics export, server/store/ad facts, private spend/cost imports and cohort LTV/CAC SQL — **MVP**.
- Looker Studio for the first dashboards — **P7**.
- P4-T06 implements minimum source/campaign/creative attribution (Google Play Install Referrer where needed) and spend joins for MVP. Advanced deferred deep linking remains P7 unless essential; MMP is conditional on D-018.

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
Android --------- HTTPS ---- Cloud Run: Django API/Admin
     |                        |       |        |
     |                        |       |        +-- Cloud Tasks/Scheduler
     |                        |       +----------- Supabase PostgreSQL
     |                        +------------------- Firebase token verification
     |
     +-- Firebase Auth / Analytics / Crashlytics / App Check   (MVP)
     +-- AdMob rewarded ad                                      (MVP)
     +-- Firebase Remote Config / FCM                           (P7)
     +-- RevenueCat -> Google Play coin Billing                (MVP)
     +-- Apple IAP / subscriptions                             (P7)
     +-- consented Analytics -> BigQuery <- server/store/ad facts
                                    ^
                         private spend/cost imports -> LTV:CAC
     |
     +-- authorized HLS request
            |
        Bunny Stream CDN (token, expiring access)
            ^
            |
      Bunny encode <- Django Admin ingestion workflow
            |
      fallback (only if activated): GCS -> Transcoder -> Cloud CDN
```

### Trust boundaries

- Mobile input is untrusted.
- Firebase authenticates identity; Django authorizes every business action.
- AdMob and RevenueCat callbacks are untrusted until authenticity, identity, environment and idempotency checks pass in MVP.
- Database transactions are the authority for permanent episode entitlements. The immutable coin ledger is the authority for persistent coin balance in MVP.
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
- `Series`: language-independent identity, localized metadata, artwork, genres/content segments, publication/takedown state, private provenance and editorial defaults. English is the active locale.
- `Season`: optional grouping; model now even if MVP normally has one.
- `Episode`: stable identity/order, localizable metadata, duration, publication/window state and editorial access configuration.
- `ContentRight`: territory allow/deny, platform/storefront, original/subtitle/dub language, free/ad/coin/subscription and promotional permissions, windows/exclusivity/takedown/protection plus opaque private references. Absent/invalid grants fail closed. P2-T03-F3 owns planned evolution from current fixed context and dormant translations.
- `MediaAsset`: ready provider asset ID, captions, thumbnails, duration, renditions, and removed state. Django stores no video bytes.
- Launch configuration selects active markets/storefronts/languages/segments; per-episode policy overrides series defaults and intersects rights. Current `Series` free/ad fields and dormant `AccessPolicy` rows are implementation history; P3-T01-F1 selects an expand/migrate path without destructive contraction.
- `EpisodeEntitlement`: user, episode, source, granted/expiry/revocation metadata.
- `Wallet`: persistent account balance in a virtual-coin namespace (**MVP**), never a cash/FX balance.
- `CoinLedgerEntry`: immutable credit/debit/adjustment with idempotency key and running audit fields (**MVP**).
- `StoreTransaction`: verified store/provider transaction identity, product/environment, state, restricted private-event reference, owner, original currency/amount and timestamps (**MVP**); no raw payloads in Git/Analytics.
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

This is the target surface, not a claim that each endpoint/event is implemented. Runtime/OpenAPI changes follow their owning task; this update edits documentation only.

### Initial REST surface

- `GET /v1/config/bootstrap`
- `GET /v1/catalog/home`
- `GET /v1/series/{id}`
- `GET /v1/episodes/{id}`
- `POST /v1/playback/{episode_id}/authorize`
- `PUT /v1/progress/{episode_id}`
- `GET /v1/me`
- `DELETE /v1/me`
- `GET /v1/me/wallet` (**planned MVP**)
- `GET /v1/me/entitlements`
- `GET /v1/offers/{episode_id}`
- `POST /v1/unlocks/coins` (**planned MVP**)
- `POST /v1/rewards/intents`
- `GET /v1/rewards/{id}`
- `POST /v1/webhooks/revenuecat` (**planned MVP**, coin lifecycle)
- `GET /v1/webhooks/admob/ssv` or the provider-required verified callback form
- `POST /v1/push/register` (**P7**)
- `DELETE /v1/push/register/{token}` (**P7**)
- `GET /health/live` and `GET /health/ready`

Rules:

- Cursor pagination for lists that can grow.
- Stable opaque public IDs; never expose sequential database IDs as an assumption.
- Consistent error envelope with code, safe message, correlation ID, and field errors.
- `Idempotency-Key` required on wallet-changing client commands in MVP. Reward-intent creation remains idempotent.
- OpenAPI is generated in CI; the TypeScript client is generated from it.
- Version breaking changes under a new API prefix; additive changes are preferred.

### Canonical analytics events

Current P4-T01 schemas contain `app_open`, `sign_up`, `login`, `account_deleted`, `episode_started`, `episode_completed`, `playback_error`, `locked_episode_viewed`, `rewarded_ad_started`, `reward_granted`, `reward_failed`. Earlier discovery/progress/offer/ad-lifecycle events were removed in the 2026-09-02 narrowing; their prior completion notes below remain historical. Restore only the exposure/selection and engagement measurements needed for MVP under P4-T01-F5.

Planned MVP extension (P4-T01-F5): `coin_pack_viewed`, `purchase_started`, `purchase_completed`, `purchase_failed`, `purchase_refunded`, `coins_credited`, `coins_spent`, `episode_unlocked`. `locked_episode_viewed` is the paywall/lock-view concept; `offer_presented` means the configured unlock options were actually shown. Use one canonical name per concept: the older planned `purchase_succeeded` name maps to `purchase_completed`, not a second counted event.

Common allowed dimensions: stable event ID/time, consented opaque installation/profile join keys, session, app version/build, platform, locale, active market, series/episode, server-provided access/unlock method, safe outcome; coin/product quantities only where appropriate. Acquisition source/campaign/creative IDs are bounded and consent/retention-reviewed. Financial records separately preserve original currency/amount, verified transaction and adjustment identity, occurrence/ingestion time and FX provenance. Client events diagnose the funnel; only verified backend/store/provider records determine purchase completion, refunds, credits, spends, entitlements and revenue. Full definitions and authority: [analytics contract](docs/analytics/README.md).

P7 only: subscription lifecycle, push and experiment exposure. No email, UID, tokens, signed media URLs, full IP, receipts, raw provider callbacks, contracts/rates or free-form errors in Analytics. No raw acquisition URL/referrer containing personal data; recover only approved bounded attribution dimensions.

---

## 7. Delivery Roadmap and Tasks

The sequence below is dependency-ordered and keeps high-risk proofs early. Estimates should be added only after one engineer has completed the first vertical slice and calibrated velocity.

Two decision classes apply throughout the roadmap:

- **Required for architecture/coding:** must be approved before implementing the affected behavior. The accepted technical ADR baseline is sufficient to begin Phase 1 now.
- **Required before public release:** company registration and organization-account details, banking/payout verification, per-series provenance or licensed-rights clearance, France-specific legal/privacy review, Google Play/RevenueCat/AdMob configuration, Google IAP settlement, coin terms and launch approvals may be completed later, but public production activation, traffic promotion, storefront distribution, real purchases/advertising/paid spend, and uncleared media remain disabled until they pass. Isolated production-candidate provisioning and synthetic/test-data validation may proceed earlier under P5-T08.

### Phase 0 — Product, Content, and Delivery Foundations

#### P0-T01 — Approve MVP product brief and launch configuration

**Description:** Maintain one brief that separates the approved development baseline from Public Release Readiness decisions covering distribution, customer-localized pricing, EUR reporting/settlement, legal entity and registration details, target audience, content rating, catalog, and success/stop criteria.

**Objective:** Allow approved architecture and bootstrap work to proceed while preventing release or real monetization with unresolved legal, content-rights, financial, privacy, or store requirements.

**Dependencies:** None.

**Acceptance criteria:**

- [x] English is approved as the MVP product language.
- [x] Storefront-localized customer prices and EUR reporting/desired settlement are approved.
- [x] Decision D-001 approves France-only Google Play distribution, and D-024 records France as the intended legal-entity country (scope narrowed 2026-09-01).
- [x] Phase 1 may start with local/emulated/fake services, generated test data, and self-owned/generated test media without real credentials.
- [ ] Before public commercial release, verify French entity/registration/organization accounts, AdMob and Google Play/RevenueCat production configuration, Google IAP finance and EUR settlement; Apple setup remains post-MVP.
- [x] Founder strategy approved 2026-09-07: France/Android/English as launch configuration, approximately 3–5 approved titles, ads plus coins, configured episode access, guest boundary and contribution LTV/CAC experiment. Implementation is not claimed.
- [ ] Founder approves one audience (D-035), D-008 commercial coin values/terms, D-017 budget, business guardrails and stop/go review date. Metric definitions include contribution LTV/CAC; Remote Config experimentation remains P7.

**Validation and integration tests:**

- [ ] Product, engineering, growth, and legal/content owners review the same brief.
- [ ] Trace every MVP screen and backend domain in this plan to at least one approved user journey.

#### P0-T02 — Confirm per-series content rights and media requirements

**Description:** For every candidate series, record ownership/component provenance or complete the private licensor, contract, royalty, territory-window, and protection package, then validate its technical delivery package.

**Objective:** Ensure every MVP asset is owned or licensed for the intended use, suitable for France/Google Play promotion, and technically publishable.

**Dependencies:** Approved decisions D-001, D-002, D-004, and D-023. Remaining P0-T01 Public Release Readiness items are not dependencies.

**Acceptance criteria:**

- [ ] Each self-owned series has private provenance covering scripts, music, voices, likenesses, artwork, clips, stock assets, locations, and AI tools/models; each licensed series has an approved private D-031 rights package.
- [ ] Media specification covers vertical aspect ratio, codecs, audio, captions, posters, episode numbering, checksums, and source quality.
- [ ] Each candidate series is approved for France/Google Play, English localization, free episodes, rewarded ads, coin transactional access and paid acquisition clips/trailers/posters/stills/likenesses; rating, windows, takedown, reporting, exclusivity and protection recorded privately. Target approximately 3–5 independent approvals with D-033 preferred terms.

**Validation and integration tests:**

- [ ] Run the applicable checklist path against every actual launch package and record gaps.
- [ ] Founder/content owner signs off before a self-owned production master is published; legal/content approval of the private rights package is required before a licensed master is ingested or published.

#### P0-T03 — Create product policy and store-compliance matrix

**Description:** Map the France/Android ad-plus-coin product, capped acquisition, privacy/deletion, consent, age/content, Google Play consumables, refunds, persistent balance, store pricing and EUR settlement to the actual binary/data flows. Apple and subscriptions remain post-MVP.

**Objective:** Make the new MVP reviewable before commercial release.

**Dependencies:** D-001/D-002/D-005–D-008/D-015/D-021/D-022 approved directions. D-008 commercial values/terms, D-020 and owner finance/legal approvals remain open where applicable.

**Acceptance criteria:**

- [ ] Matrix covers ad consent/SSV and coin purchases/unlocks/refunds/reconciliation, store-provided prices and Google settlement.
- [ ] Privacy/terms/support/deletion/data inventory and notices have owners; include RevenueCat, minimal attribution and warehouse data, retention and processor cleanup.
- [ ] No subscription, Apple or unnecessary MMP requirement is introduced into MVP.

**Validation and integration tests:**

- [ ] Reviewer walks free, ad-only, coin-only, both-method, pending/refund/reinstall and deletion journeys against matrix; release declarations match observed Android SDK/network behavior.
- [ ] Review notes explain the actual ads-plus-coins business model and deterministic Google Play tester paths.

#### P0-T04 — Establish architecture decision records and cost model

**Description:** Record the decisions in this plan as ADRs and build a unit-cost model for database, API, video processing, CDN egress, analytics, ads, and store commissions.

**Objective:** Make technical tradeoffs and contribution economics explicit.

**Dependencies:** Accepted technical decisions D-010 through D-013, D-015, and D-016, plus approved pricing/reporting decisions D-021/D-022. D-014 is accepted as Bunny Stream default with GCP Cloud CDN fallback; P0-T04 records that ADR and a provisional cost baseline. P2-T05 **Android** proved Bunny (2026-08-26, D-026). Production provider configuration still waits for credentials and public-release gates. D-019 permits tokenized HLS only for titles whose ownership/license package allows it; DRM-required titles remain ineligible. P0-T01, P0-T02, and P0-T03 may proceed in parallel.

**Acceptance criteria:**

- [x] ADRs exist for monorepo, modular monolith, Firebase Auth, Supabase PostgreSQL, video delivery (Bunny default / GCP CDN fallback), RevenueCat, and Firebase analytics/experimentation.
- [x] The video ADR records D-014 as Bunny Stream default with GCP Cloud CDN fallback; completing P0-T04 requires a `VideoProvider` boundary and provisional cost assumptions for both paths. P2-T05 remains the on-device proof for Bunny.
- [x] Cost sheet supports minutes watched, renditions, egress, MAU, purchases, and ad revenue inputs.
- [x] Thresholds for reconsidering Supabase, CDN, transcoder, and MMP are documented.

**Validation and integration tests:**

- [x] Historical infrastructure-only beta/launch/10× arithmetic was recorded before 2026-09-07; it is not approval of the new business economics.
- [ ] Review the updated parameterized beta, paid-launch and 10× ads-plus-coins models with content share, fees/taxes/refunds, infrastructure and acquisition; replace pending private inputs before claiming LTV:CAC.
- [x] Confirm infrastructure variable cost flows into cohort contribution margin.

### Checkpoint 0 — Public-release feasibility (not a Phase 1 gate)

- [ ] Launch configuration, per-series rights/media checklist, policy matrix, and cost model are approved.
- [ ] A sample content package can meet the proposed ingestion contract.
- [x] D-019 allows tokenized HLS only for approved self-owned or licensed titles that permit it; DRM-required titles fail closed until a compliant provider path is approved.

Phase 1 may begin before Checkpoint 0 passes. Checkpoint 0 remains mandatory before public content/monetization release and paid acquisition in France. Licensed-content clearance is per series and does not block unrelated cleared titles.

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
- [ ] Android emulator calls the local health endpoint successfully. iOS setup is post-MVP.

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

**Description:** Keep the validated Android email/password and Google Firebase sign-in flows, Firebase ID-token attachment, Django token verification, and idempotent profile creation.

**Objective:** Establish trusted identity without building an auth system.

**Dependencies:** P1-T04, P1-T05.

**Acceptance criteria:**

- [ ] Anonymous catalog use works; protected endpoints require a valid token.
- [ ] Django maps Firebase UID to one local profile and never trusts client-supplied user IDs.
- [ ] Token expiry/revocation paths produce consistent unauthorized responses.

**Validation and integration tests:**

- [ ] Unit tests cover missing, malformed, expired, and valid tokens with emulator/mocked verification.
- [ ] Device signs in with email/password and Google, calls `/v1/me`, signs out, signs in again, and receives the same profile for each account.

**P2-T01-F1** (GitHub issue #50) wires native `@react-native-firebase/auth` email/password authentication on the Android development build against the Auth emulator. Jest and CI keep `createLocalMockFirebaseAuth` / `FIREBASE_AUTH_MODE=mock`. Do not commit `google-services.json`.

**P2-T01-F2** (GitHub issue #85) adds Android Google Sign-In on the same native Auth path; Jest/CI remain mock; iOS Apple/Google observation is a later D-026 ship pass.

**P2-T01-F3** (GitHub issue #89) is **deferred under D-027** (MVP is Android / Google Play only). Apple Sign-In is still required before any iOS public storefront / TestFlight-quality pass; it is not N/A and is not an Android MVP blocker.

#### P2-T02 — Implement account lifecycle, consent, and deletion

**Description:** Add locale/country/consent state, profile API, logout behavior, and a same-provider reauthentication and deletion workflow for both retained login methods spanning Django and Firebase. Account export is post-MVP and has no placeholder endpoint.

**Objective:** Provide privacy-safe account control from the beginning.

**Dependencies:** P2-T01 and the P0-T03 privacy/deletion matrix for the implemented foundation. Planned MVP coin/attribution/warehouse integration must extend deletion and approved financial retention before P3/P4 release; subscriptions remain P7.

**Acceptance criteria:**

- [x] User can initiate deletion in-app with reauthentication where required.
- [x] Implemented personal profile/progress/entitlement cleanup passes the historical P2-T02 tests.
- [ ] Planned MVP coin financial audit retention and new RevenueCat/attribution/warehouse cleanup must be integrated and tested before shipping; push remains P7. No financial-retention completion is claimed by the existing deletion evidence.
- [x] Deletion is idempotent and has an auditable status.

**Validation and integration tests:**

- [x] Integration test creates an account with progress/entitlements, deletes it, and verifies inaccessible/anonymized data.
- [x] Repeating the deletion command does not recreate or corrupt the account.

Evidence (2026-08-31, P2-T02): preferences and opt-in defaults, same-account
password or Google reauthentication, recent-auth deletion, local cascading, and durable
Firebase cleanup/retry. The unused export-placeholder surface was removed by the
2026-09-02 MVP simplification; validated password authentication was retained. The Android development build
must complete both email/password and Google sign-in → preference save → same-provider reauthentication → deletion against isolated PostgreSQL and the
Firebase Auth emulator. Profile/progress/entitlement and Firebase user counts
were zero afterward; the completed receipt erased its raw UID. Full `pnpm check`
and Android JS export pass. See `docs/runbooks/account-lifecycle.md` for exact
checks, operational follow-ups, retention gates, and rollback restrictions.
Push identifiers and financial audit models are not implemented yet; their
processor-specific deletion/retention integration is required before they ship.

#### P2-T03 — Implement catalog, rights, publication controls, localization, and Django Admin

**Historical implementation scope:** Checked evidence below describes the earlier free/rewarded-ad, fixed-launch-context slice. D-034/P2-T03-F3 and P3-T01-F1/P3-T08-F2 add new MVP requirements; those are unchecked and are not satisfied by this historical completion.

**Description:** Add Series, Season, Episode, Genre, direct English text, publication/takedown state, self-owned provenance or licensed ContentRight grants, artwork, and usable Admin screens. The completed slice evaluates the fixed France/Android/English context; P2-T03-F3 makes it active configuration with generalized dimensions.

**Objective:** Let staff manage an independently approved self-owned or licensed catalog without a custom web product.

**Dependencies:** P1-T02. Implement and test with generated metadata and self-owned/generated test media. P0-T02 provenance/media sign-off is required for self-owned publication; the D-031 private rights package and media acceptance are required before each licensed-series ingestion/publication.

**Acceptance criteria:**

- [x] Admin supports ordered episodes, provenance/licensed-right visibility, draft/published/takedown states, and search/filtering.
- [x] Publication validation prevents missing self-owned provenance or a structurally valid licensed grant, promotional approval where applicable, English metadata, or ready media.
- [x] API returns only published English series with valid fixed France/Android eligibility; clients cannot supply market context.

**Validation and integration tests:**

- [x] Model/admin tests cover self-owned and licensed publication metadata, missing/mismatched/expired/DRM-required/taken-down grants, duplicate ordering, and publish restrictions.
- [x] Seed synthetic self-owned content only; tests create synthetic licensed-right metadata and verify ineligible titles remain hidden.

Evidence (2026-09-02): P2-T03-F2 restored the surviving `ContentRight` model validation and Admin surfaces, fixed France/Android/English query enforcement, episode availability windows, and catalog/playback regression coverage. No real contract, rate, provider payload, personal data, or licensed media fixture is included.

#### P2-T03-F3 — Configure launch context and preserve generalized rights/domain dimensions

**Description:** Follow D-034 from the fixed-context P2-T03-F2 implementation: active server launch configuration for France/Android/English, stable content identity, localized metadata, audience/content-segment associations and territory/platform/language/monetization grants. Retain or evolve existing models instead of replacing generalized dimensions with launch constants. Add the minimum permission metadata needed for D-031 free/ad/coin/promotion admission; keep confidential rights/finance records private.

**Objective:** Add another approved market or segment later without core-domain/API redesign, while keeping MVP UX narrow and eligibility fail-closed.

**Dependencies:** P2-T03/P2-T07, D-031/D-034 approved direction. Synthetic fixtures only; no new country rollout or legal approval is implied.

**Acceptance criteria:**

- [x] Active market/storefront/language configuration is resolved by the server. Profile locale, request headers and client targeting cannot widen access.
- [x] Stable domain IDs and separate localized metadata/segment associations support future values without destructive redesign; generalized territory/license and store-currency dimensions survive.
- [x] Per-series rights include required free/ad/coin/paid-promotion grants; no grant means no permission. Admin ingestion/publication review and catalog/playback rechecks preserve window/takedown/DRM/age/authorization safeguards.
- [x] Migration plan is expand/migrate, with conservative backfill: unknown rights do not become approved. Destructive contraction is a separate release.

**Validation and integration tests:**

- [x] Backend decision-table tests use synthetic additional-market/language/segment grants and inactive configurations to prove dimensions work without enabling new public scope; spoofed client context fails to widen eligibility.
- [x] Existing France/self-owned/licensed regression and no-secret/private-media tests pass; OpenAPI/client updated together with `pnpm contract:check` for any API changes.

Evidence (2026-09-07): 323 backend tests passed, including real upload-right
revocation, same-grant captions, client spoofing, entitlement/reward rechecks,
assigned ISO-code validation, and additive migration preservation. Backend static
and migration checks, repository foundation, and generated contract checks passed.
Task-scoped independent reviews passed after corrections. Configuration, private
license reapproval, safe rollback, and exact verification are recorded in
[`catalog-launch-context.md`](docs/runbooks/catalog-launch-context.md); final
whole-branch review and CI results belong to the implementation PR. This evidence
does not authorize a new market, production rollout, or an automatic merge.

Implementation PR: [#139](https://github.com/pedroharaujo/shortform-streaming/pull/139).

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

**Description:** Spike the default path with a test vertical master uploaded directly to Bunny Stream, encode ABR HLS, and play it on an Android development build with a short-lived token. iOS is outside the MVP and will require a separate implementation and validation phase if it is later approved. If Bunny fails this spike, a license/residency/support constraint forbids it, or measured cost/reliability is worse, spike the documented GCP fallback (private GCS → Transcoder → Cloud CDN signed access) before continuing.

**Objective:** Retire the highest technical and cost risk on the chosen default before building the full player.

**Dependencies:** P1-T03 plus the video ADR and provisional video-cost baseline from P0-T04. P2-T05 proves or rejects Bunny Stream as the production default; it does not re-open D-014 unless Bunny fails. Use only self-owned, generated, or purpose-made test media; commercial licensing is not a proof-of-concept dependency.

**Acceptance criteria:**

- [x] 9:16 test media produces ABR HLS and thumbnails with correct rotation, audio, duration, and captions on Bunny Stream (live 2026-08-25: 1080×1920, 3.0s, audio, captions, 3 thumbnails; renditions 240p/360p/480p/720p/1080p). Plan “360/540/720” is an example ABR ladder; this library’s default had **no 540p**, with 360p and 720p present — not a failed spike.
- [x] An Android development build plays adaptive HLS through expiring token access using `expo-video` (not Bunny’s web player) (Pixel emulator, 2026-08-26, using a temporary proof route that has since been removed).
- [x] Unsigned and expired token access fail (403); Django remains the authorizer; cost per source minute is recorded (0.05 min, USD 0 encode). Hotlink / empty-referrer blocking was intentionally off so native `expo-video` can play (Stream **Block Direct URL File Access** off); token auth still denies unsigned/expired.
- [x] Bunny did not fail this spike; GCP Cloud CDN fallback was not activated; D-014 was not reopened.

**Validation and integration tests:**

- [x] Android device notes recorded (2026-08-26 Pixel emulator): normal local network; startup to play succeeded on the temporary proof route; constrained-network / rebuffer instrumentation was not run on a 3s clip; seek and background/foreground were not separately timed. The temporary route was removed after the proof.
- [x] Bunny met requirements; GCP fallback spike not activated; D-014 not reopened.

#### P2-T06 — Implement production media ingestion workflow

**Description:** Use the existing MediaAsset state machine, checksum/deduplication, signed staff upload, Bunny Stream job submission/status reconciliation, caption validation, thumbnail output, and Admin retry/takedown that also expires/deletes the provider asset. Automated/local fixtures remain self-owned or generated; production ingestion accepts only independently cleared self-owned or licensed media.

**Objective:** Make ingestion repeatable, auditable, and safe for every approved series.

**Dependencies:** P2-T03, P2-T05.

**Acceptance criteria:**

- [x] States cover pending upload, uploaded, processing, ready, failed, blocked, and removed.
- [x] Duplicate completions/retries are idempotent and failures expose safe Admin diagnostics.
- [x] An episode cannot publish until ready media and the applicable self-owned or licensed publication gate passes.

**Validation and integration tests:**

- [x] Tests cover staff-only upload, checksum mismatch, failed processing, retry, and successful/failed provider takedown.

Evidence (2026-08-27): PR #56 merged; Fake CI ingest tests; optional Bunny smoke reached ready; D-014 not reopened; production signed PUT is #55.

#### P2-T07 — Implement entitlement-aware playback authorization

**Historical implementation scope:** Checked evidence below describes the earlier free/rewarded-ad, fixed-launch-context slice. D-034/P2-T03-F3 and P3-T01-F1/P3-T08-F2 add new MVP requirements; those are unchecked and are not satisfied by this historical completion.

**Description:** Create the server policy evaluator and playback authorization endpoint that checks fixed-market self-owned or licensed publication/takedown eligibility, auth, episode entitlement, and the series free count before signing playback access. Subscription evaluation waits for P7.

**Objective:** Centralize content authorization and keep storage private.

**Dependencies:** P2-T01, P2-T03, P2-T06.

**Acceptance criteria:**

- [x] Response grants only eligible playback and otherwise returns machine-readable lock reasons/offers.
- [x] Signed access is short-lived, HTTPS-only, and never persisted in analytics or logs.
- [x] Authorization decisions are consistent under concurrent requests and clock boundaries.

**Validation and integration tests:**

- [x] Decision-table tests cover free, entitled, unpublished, takedown, missing/not-ready media, and anonymous cases. Fixed-market licensed-rights coverage is restored under P2-T03-F2; multi-market routing and subscription cases remain post-MVP.
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

- [ ] Staff can ingest and publish every independently cleared self-owned or licensed launch series.
- [ ] Anonymous user discovers and watches free episodes end to end.
- [ ] Signed playback, France/Android launch availability, progress, and takedown are verified. Additional-market rollout/device validation is post-MVP; synthetic generalized-config/rights tests are required by P2-T03-F3.
- [ ] Playback performance baseline and cost per watch-hour are recorded.

---

### Phase 3 — Rewarded ads, Android coins and episode access

#### P3-T01 — Implement access-policy and offer configuration

**Historical implementation scope:** Checked evidence below describes the earlier free/rewarded-ad, fixed-launch-context slice. D-034/P2-T03-F3 and P3-T01-F1/P3-T08-F2 add new MVP requirements; those are unchecked and are not satisfied by this historical completion.

**Description:** Store the free episode count and rewarded-ad kill switch directly on `Series`. This completed slice did not model per-episode overrides or coins; P3-T01-F1 adds them for MVP. Subscriptions remain post-MVP.

**Objective:** Change free-window and ad availability without treating the client as authoritative.

**Dependencies:** P2-T07, the historical P0-T03 ads/privacy slice; the new coin follow-up depends on the updated MVP policy matrix.

**Acceptance criteria:**

- [x] `/offers/{episode}` returns only currently legal/available methods with display metadata. MVP methods are existing entitlement, free policy, or rewarded-ad lock.
- [x] Admin changes update offers without a client release and server defaults work without Remote Config.

**Validation and integration tests:**

- [x] Decision-table tests cover free versus rewarded-ad lock and failure fallback. Coin and subscription offer types are not required.
- [x] Changing free count in staging updates the lock screen without an app release and cannot bypass server checks.

Evidence updated 2026-09-02: `GET /v1/offers/{episode_id}` reads `Series.free_episode_count` and `Series.rewarded_ads_enabled`; authorize ignores client free-window; anonymous locked offers omit rewarded-ad (D-005). Legacy `AccessPolicy` rows are dormant until schema contraction.

#### P3-T01-F1 — Add editorial episode methods and license-aware offers

**Description:** Extend the completed Series free/ad defaults to operator-configured per-episode free, ad, coin or both access, preserving entitlement authority and private rights boundaries. No automated cliffhanger detection or Remote Config dependency.

**Dependencies:** P3-T01, P2-T03-F3, updated P0-T03 MVP policy; D-008 price fields configurable with synthetic test values until business approval.

**Acceptance criteria:**

- [x] Eligibility precedes entitlement/free access; locked offers intersect configured methods, current license permissions and enabled provider capability. Server controls coin price and policy version; unavailable methods stay disabled/fail-closed.
- [x] Existing ad-only behavior migrates safely; per-episode overrides support free/ad/coin/both and licensed permission changes take effect at offer and grant/debit time.
- [x] Admin edits are authorized/auditable and cannot silently grant missing rights; existing grants never bypass takedown or expiry.

**Validation and integration tests:**

- [x] One backend decision table covers all methods, anonymous/login boundary, invalid grants, stale price/policy, takedown/expiry races and disabled provider paths. Test schema/data migration and generated client together; no duplicate screen tests for the same policy outcome.

Implementation evidence (2026-09-07, feature branch): per-episode overrides,
server-owned price/version, bounded Admin history, and version-bound reward
intents are implemented. PostgreSQL transaction tests cover current rights/policy
changes, expiry while waiting, and Admin segment mutation at grant commit. Existing
segment identifiers cannot be renamed or deleted through Admin. Additive migrations
also verify inserts from historical models after expansion. Coin methods remain
unavailable until the P3-T02 debit service and P3-T08-F2 offer flow are implemented;
this task neither debits coins nor activates commerce.

`pnpm check` passed before the final Admin correction (351 backend tests, 177 mobile
tests, 50 repository tests, contract and static checks); the complete affected
`pnpm backend:check` then passed with 355 tests. Expo Doctor passed 21/21 and the
Android production JavaScript bundle passed. Independent task reviews and the
final whole-branch review passed after corrections. See
[`docs/runbooks/access-policy.md`](docs/runbooks/access-policy.md) and the
[execution evidence](docs/superpowers/plans/2026-09-07-p3-t01-f1-episode-access.md).
Final-head GitHub check evidence is recorded in
[PR #140](https://github.com/pedroharaujo/shortform-streaming/pull/140).
Human approval is required before merge.

#### P3-T02 — Implement immutable coin wallet and atomic episode unlock

**Timing:** Moved from P7 into MVP on 2026-09-07; original ID retained (prior deferral: issue #52, 2026-08-27).

**Description/objective:** Build persistent Wallet/CoinLedgerEntry and auditable idempotent debit plus episode entitlement in one PostgreSQL transaction.

**Dependencies:** P3-T01-F1, P2-T01/P2-T02; D-008 direction. Use configurable synthetic amounts; commercial values remain unapproved.

**Acceptance criteria:**

- [x] Ledger changes are append-only; balance derives from auditable entries and persists across login/reinstall. Support corrections use compensating entries, never edits/deletes.
- [x] Row locking and idempotency make debit plus entitlement atomic; a valid pre-existing entitlement causes no duplicate charge. No negative spendable balance.
- [x] Current rights, eligibility, configured coin method and price are checked; insufficient balance, stale price and concurrent takedown/policy changes fail safely.
- [x] Owner-only wallet/unlock APIs, least-privilege support and deletion/financial-retention boundary are documented. Financial records are not accidentally cascaded away or exposed cross-account.

**Validation and integration tests:**

- [x] PostgreSQL integration tests cover duplicate/competing unlocks, rollback between debit/grant, price/eligibility changes, IDOR and reconciliation between wallet/ledger/entitlements.
- [x] Expand/migrate tests and `pnpm contract:check` pass. Financial integrity and authorization tests cannot be deferred under D-029.

Implementation evidence (2026-09-07, issue #141, feature branch): P3-T02 backend
and generated contract implemented with production spending disabled. Only local
debug synthetic tests may enable coin methods. There is no public credit API or
Admin balance editor; compensating entry structure exists but no support adjustment
operation or unapproved refund policy is activated. Account deletion detaches the
wallet and preserves restricted immutable facts without profile identifiers.
`pnpm check` passed: 418 backend tests, 177 mobile tests, 50 repository tests, all
static/migration/contract checks. The Android production JavaScript bundle passed.
Independent financial/security review found and verified a fix for an expiry race.
Store funding, native purchase/refund evidence and coin UI remain dependent tasks;
no financial test was deferred. See [the wallet runbook](docs/runbooks/coin-wallet.md)
and [implementation plan](docs/superpowers/plans/2026-09-07-p3-t02-coin-wallet.md).

#### P3-T03 — Configure Google Play coin products and RevenueCat environments

**Timing:** Android coin scope moved from P7 into MVP 2026-09-07. Apple/subscription setup retained as P3-T03-P7.

**Description/objective:** Map Google Play consumable IDs to RevenueCat offerings and server-approved coin quantities by environment; validate native Expo integration without inventing pack sizes or prices.

**Dependencies:** P3-T01-F1, P0-T03 MVP matrix. D-008 values/terms and relevant D-025/Google account prerequisites before real product setup; generic code uses synthetic fixtures.

**Acceptance criteria:**

- [ ] Product registry defines type, store/environment identity, server quantity, localized-price source, finance ownership and approval reference; no confidential values/credentials in Git.
- [ ] Android test build fetches known offerings and shows the exact Google-provided price string. No currency derived from English/France constants.
- [ ] Separate sandbox/production credentials, webhook auth and least-privilege access/rotation are defined with P5-T04. Production remains disabled until release approval.

**Validation and integration tests:**

- [ ] Configuration checks reject missing/unknown/wrong-environment products. Synthetic multi-currency display tests validate store strings without adding another launch market.
- [ ] Google Play license-tester Android device fetches offerings and matches the native purchase sheet. Apple/two-store device testing remains post-MVP.

#### P3-T04 — Verify RevenueCat Android purchase and webhook lifecycle

**Timing:** Coin lifecycle moved from P7 into MVP 2026-09-07. Subscription state lives in P3-T04-P7.

**Description/objective:** Authenticate/validate provider events, preserve restricted references, bind account/product/environment/transaction, quarantine unresolved identity and converge on verified coin-purchase/refund state.

**Dependencies:** P3-T03, P2-T01/P2-T02; ADR 0006 and D-008 approved refund/chargeback rules before live fulfillment.

**Acceptance criteria:**

- [ ] Forged/replayed/wrong-environment/unknown-product events never credit; duplicates, delayed/out-of-order purchase/refund/chargeback events converge idempotently.
- [ ] Pending/cancelled/failed purchases create no credit; verified completed purchases alone are fulfillable. Provider acknowledgement/consumption ownership and retry/recovery are explicit.
- [ ] Unknown/deleted users, alias/transfer conflicts and events arriving during deletion are quarantined/reconciled rather than reassigned. Logs/Analytics never receive raw payloads/receipts.

**Validation and integration tests:**

- [ ] Synthetic provider-contract tests replay ordered, reordered, forged and duplicate lifecycle events and assert financial state; test environment/product/user isolation.
- [ ] Google tester purchase/refund lifecycle converges after callback outage/retry. Private device/provider evidence never enters public fixtures; do not mark unavailable checks passed.

#### P3-T06 — Implement Android coin-pack purchase fulfillment

**Timing:** Moved from P7 into MVP 2026-09-07; original ID retained. Apple fulfillment remains with later iOS work.

**Description/objective:** Present Google Play/RevenueCat coin packs, complete native checkout and credit coins only from a verified server purchase. Client success starts synchronization, never a grant.

**Dependencies:** P3-T02, P3-T03, P3-T04.

**Acceptance criteria:**

- [ ] At most one credit per verified transaction; client cannot choose quantity or owner. Persistent balance/entitlements reload after reinstall and second-device login without re-crediting consumables.
- [ ] Cancel/pending/offline/delayed callback states are recoverable. Refunds/chargebacks use compensating entries and approved D-008 handling including already-spent coins; unresolved cases stay quarantined.
- [ ] User sees store-provided prices, safe support reference and authoritative balance/fulfillment state; commercial launch waits for D-008 terms/prices and Google settlement approval.

**Validation and integration tests:**

- [ ] Backend transaction tests replay purchases/refunds, concurrent fulfillment, crash boundaries and ownership conflicts; no double credit or financial corruption.
- [ ] Google license-tester purchase → verified credit → atomic unlock → fresh playback → reinstall/second-device sync. Cancellation/pending/network interruption and refund after spend receive device/provider evidence with server reconciliation.

#### P3-T07 — Implement rewarded-ad intent and verified reward grant

**Development complete (founder-approved scope, updated 2026-09-02):** Backend
and Android support test and production modes with fail-closed explicit activation.
Production defaults remain disabled. Operator identity, privacy
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

- [x] Explicit disabled/test/production modes exist. Native demo Test Ad is verified; production requires a non-demo Android AdMob app/ad-unit pair and fails closed until explicitly enabled. Genuine publisher callback validation remains a release gate.
- [x] Automated reward/API/client, consent, replay/forgery, entitlement and fresh-authorization controls pass; independent reviews complete. No provider end-to-end result is inferred from these checks.

**Deferred release acceptance (D-028):** #98 requires the actual operator/contact,
final notice/UMP setup, a completed test ad → genuine signed callback → one
entitlement → authorized Android playback, and production activation review.
Setup prerequisites still apply before any publisher-owned ad test. P6-T04,
P6-T05A and the final launch checklist carry these gates; P3-T08 development may
proceed with production ads disabled.

#### P3-T08 — Build locked-episode offer sheet (rewarded-ad foundation)

**Historical implementation scope:** Checked evidence below describes the earlier free/rewarded-ad, fixed-launch-context slice. D-034/P2-T03-F3 and P3-T01-F1/P3-T08-F2 add new MVP requirements; those are unchecked and are not satisfied by this historical completion.

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

**Description:** Present the rewarded-ad unlock offer from the API, including loading, accessibility, errors, and post-success transition to playback. Coin/both-method offers are added by P3-T08-F2; subscription offers remain P7.

**Objective:** Provide the completed rewarded-ad surface that P3-T08-F2 extends for MVP coins.

**Dependencies:** P3-T01, P3-T07, P2-T08.

**Acceptance criteria:**

- [x] Only server-authorized methods appear. MVP shows rewarded-ad unlock when locked.
- [x] Repeated taps and remount/restart recovery reuse the account-bound idempotency request; a known pending intent is status-only (P3-T08-F1 / #99).
- [x] Every success refreshes authoritative entitlement state before playback.

**Validation and integration tests:**

- [x] Component tests cover the ad offer, unavailable ads, offline, and success.
- [ ] Maestro validates the ad unlock path from a locked episode. **Deferred to P6-T03 under D-029; required before release/production enablement.**

#### P3-T08-F2 — Extend the offer sheet for configured coin/ad choices

**Description/objective:** Show the server's configured ad-only, coin-only or both methods, account boundary and wallet/purchase recovery while preserving P3-T08 ad recovery.

Implementation evidence (2026-09-07, #142, local Android slice): the app reads the
server wallet and configured choices, confirms the current coin price, securely
retains the original request through interruption, refreshes balance/access and
freshly authorizes playback. Account replacement hides old state; resumed ad
grants retain their existing verification path. The UI requires local Android
configuration plus server spending availability; purchases remain unavailable.
This foundational slice is independent of P3-T06's unfinished purchase pipeline.
Ambiguous replay rejection stays blocked with a support reference; #144 owns safe
resolution. Full acceptance below remains unchecked until that work and the
purchase/native journeys pass. Reproduction and remaining gates:
`docs/runbooks/final-validation.md` (P3-T08-F2 wallet and choices).

**Dependencies:** P3-T08, P3-T01-F1, P3-T02, P3-T06.

**Acceptance criteria:**

- [ ] Only server-authorized, available methods appear; no ad is offered on a coin-only episode. Purchase/coin amount never comes from an editable client assumption.
- [ ] Atomic unlock retries and account-switch/remount recovery cannot charge twice or adopt another account's pending transaction.
- [ ] Success refreshes server balance/entitlement and obtains fresh playback authorization; offline/pending/cancelled paths never imply success.

**Validation and integration tests:**

- [ ] Focused mobile interaction tests cover offer selection, purchase recovery and identity replacement; reuse backend policy/ledger tests instead of duplicating them.
- [ ] Android regression covers free, ad-only, coin-only and both choices, accessible prices/terms and provider interruptions.

#### P3-T09 — Add MVP commerce reconciliation and support tools

**Timing:** Moved from P7 into MVP 2026-09-07; subscription-specific reconciliation retained with P3-T04-P7/P3-T05.

**Description/objective:** Reconcile Google/RevenueCat transactions, ledger, wallet, entitlements and refunds/rewards; safely operate real money without direct database edits.

**Dependencies:** P3-T04, P3-T06, P3-T07; P2-T02 retention/deletion integration and D-020 approval before production retention.

**Acceptance criteria:**

- [ ] Scheduled/repeatable reconciliation detects missing, duplicate, delayed, refunded, charged-back and quarantined records; adjustments never silently alter money.
- [ ] Least-privilege support can inspect safe identifiers and issue authorized reasoned compensating entries with actor/reason audit; no normal staff editing ledger/history.
- [ ] Refund-after-spend, account ownership/deletion and provider outage recovery follow approved rules; finance exports preserve original currency/amount and private provenance.

**Validation and integration tests:**

- [ ] Synthetic known discrepancies produce exact reports and idempotent repair where approved; role tests deny unauthorized adjustments/payload access.
- [ ] Reconcile a Google tester purchase/refund and reinstall journey end to end. Financial integrity tests and unresolved mismatches block release and cannot be deferred as passed.

### Checkpoint 3 — Ad and coin integrity

- [ ] Genuine AdMob SSV and Google Play coin purchase/refund journeys converge on authoritative server entitlements and balances.
- [ ] Forgery, replay, transaction atomicity, concurrency, rights/price race, IDOR and reconciliation tests pass.
- [ ] No mobile request/event can set balance, purchase success or entitlement; consumed purchase sync never duplicates credits.
- [ ] MVP coin/ad disclosures, Google settlement and approved D-008 terms are covered; subscriptions remain P7.

---

### Phase 4 — Acquisition and contribution LTV/CAC measurement

#### P4-T01 — Implement analytics governance and event SDK

**Implementation-history caveat (2026-09-07):** The dated F1–F4 notes below preserve prior completed slices. The 2026-09-02 narrowed schema now contains only the 11 events in Section 6; historical discovery/progress/offer/full-ad trails are not current capability. P4-T01-F5 must implement the required missing exposure/selection and new coin/acquisition measurement, and P6 must update exact device trails before claiming a pass.

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
consent.

**Playback instrumentation implemented (P4-T01-F3b / #104):** The authorize
response now supplies the server-owned `free`, `rewarded_ad`, or `staff` access
source. The player records starts only after native playback begins, progress and
completion only after the progress API accepts them, locks only when displayed,
and terminal failures with fixed safe codes that cannot contain URLs or provider
messages. Tests prove ordered, deduplicated consented playback trails and zero
non-consented transport events. Staff-authorized playback never fabricates a
product access method. F4 still owns reward/backend diagnostics. Production
transport remains hard-disabled pending the existing approvals.

**Reward instrumentation implemented (P4-T01-F4 / #104):** The reward sheet owns
visible offer and explicit-selection events; the native ad presenter owns loaded,
opened, and earned-reward diagnostics. Owner-only reward status supplies a typed,
server-derived `admob_ssv` grant source before the client may record the diagnostic
grant event. Stable request/intent keys deduplicate retries, pending recovery,
callback replay, and remounts without exposing those keys as event properties.
Provider bindings, SSV data, tokens, transaction identifiers, and signed URLs never
enter Analytics, and no event creates an intent, entitlement, or playable access.
The earlier F1–F4 viewing/reward slices are complete; the new MVP commerce/acquisition scope is P4-T01-F5.

**Account-funnel instrumentation implemented (P4-T01 / #104):** Confirmed `/v1/me`
results now own Google `sign_up` and `login` diagnostics. A result that
arrives before consent stays process-local and may be retried only when that same
session enables the server-owned preference; session replacement discards it.
Accepted account deletion records the receipt status only after the Analytics user
ID is cleared and local Analytics data is reset, then disables collection. It never
sends the profile ID, deletion receipt ID, email, credential, country, or session.
Automated P4-T01 engineering is complete. Deferred device/DebugView evidence and
production activation remain blocked by D-020/privacy/store and P6 clearance.

**Description:** Publish event schemas and a typed, consent-gated mobile wrapper for the minimum MVP events: app open; Google sign-up/login; account deletion; episode start/complete/error; locked episode; rewarded-ad start/grant/failure. P4-T01-F5 adds campaign/coin events for MVP; subscription, push and experiment events remain P7.

**Objective:** Provide the governed product-event foundation, extended for MVP business economics by P4-T01-F5.

**Dependencies:** P2-T08, P3-T08, the updated P0-T03 MVP privacy/commerce matrix. Historical event foundations do not imply approval of new financial/acquisition data.

**Acceptance criteria:**

- [ ] Canonical MVP events in Section 6 have definitions, trigger timing, required properties, and data classification.
- [ ] Debug validation rejects unknown events/properties and production strips prohibited sensitive values.
- [ ] Anonymous-to-authenticated identity linking is documented and consent-aware.

**Validation and integration tests:**

- [ ] Analytics contract tests validate representative MVP events against schemas.
- [ ] Execute free and rewarded-ad journeys and verify one correctly ordered event trail per journey in Firebase DebugView. Coin trails are required under P4-T01-F5 for MVP; subscriptions remain P7.

#### P4-T01-F5 — Extend governed events and facts for MVP commerce/acquisition

**Dependencies:** P4-T01, P3-T08-F2, P3-T09, P0-T03; coordinate attribution properties with P4-T06.

**Description/objective:** Add canonical lock/options/coin-pack/purchase/refund/credit/spend/unlock concepts from Section 6 and the analytics contract. Backend/provider finance facts remain authoritative; client funnel events never create financial state.

**Acceptance criteria:**

- [ ] Event names, exact triggers, IDs/deduplication, unlock method and allowed product/series/campaign properties are documented/typed. Map prior `purchase_succeeded` planning name to `purchase_completed` without double counting.
- [ ] Store/provider/backend facts include lifecycle identity, original amount/currency, refunds, ledger/entitlement links and restricted provenance suitable for reconciliation.
- [ ] Consent/identity/deletion/retention cover new data; disclose anonymous/non-consented measurement gaps without repurposing operational identifiers into tracking.

**Validation and integration tests:**

- [ ] Schema tests reject prohibited values; transaction-derived facts cannot arise from forged client analytics. One deduplicated synthetic funnel contains the correct failed/pending/completed/refunded and unlock-method outcomes.
- [ ] Android DebugView verifies consented diagnostic order and opt-out silence; backend/provider totals independently reconcile. No financial test deferred under D-029.

#### P4-T06 — Implement minimum paid-acquisition attribution

**Timing/history:** The earlier custom campaign parser/landing/attribution properties were removed 2026-09-02. That removal is historical, not a current P7 requirement. D-016/D-032 move the minimum reliable paid-test scope back to MVP; original ID retained. P4-T06-P7 owns advanced deferred links.

**Description/objective:** Recover bounded source/campaign/creative at acquired-cohort level using the simplest reliable Google Play/native attribution path (Install Referrer where required), consented identity joins and repeatable ad-network spend imports. Do not add an MMP or network SDK by default.

**Dependencies:** P4-T01, P0-T03, D-035 audience before actual test design. D-020 legal/retention before live attribution collection; D-017 approved cap/guardrails before spend. D-018 only if MMP is justified.

**Acceptance criteria:**

- [ ] Record a chosen first-touch/window/cohort definition, deduplication/reinstall/account-linking rules and consent coverage. Keep bounded campaign/creative identifiers and allowed aggregate spend provenance, not raw URLs/referrers/PII.
- [ ] Network/date/currency/campaign/creative spend joins to deduplicated acquired users and later financial outcomes; organic, unmatched and consent-limited cases remain visible. Creative-level estimates are labeled when exact linkage is unavailable.
- [ ] Existing catalog eligibility still controls destinations; missing/invalid links recover safely. No multi-country UX or advanced deferred link platform unless documented necessity for the capped test.

**Validation and integration tests:**

- [ ] Synthetic link/referrer/import tests cover malformed input, duplicates, reinstall, identity/consent changes, missing keys and wrong campaign/date/currency joins.
- [ ] Controlled Google Play tester install/first open and spend-import rehearsal recover expected cohort keys without collecting before approval; live paid campaign waits for D-017 and P6 clearance. Insufficient attribution blocks spend, not automatically solved by adding an SDK.

#### P4-T02 — Build minimum BigQuery cohort economics models

**Timing:** Required export/models moved from P7 into MVP 2026-09-07; advanced exports retained in P4-T02-P7.

**Description/objective:** Use supported Firebase Analytics export plus verified backend/store/AdMob facts and repeatable private spend/content-cost/infra imports to calculate engagement, D1/D7/D30 retention, ad/IAP/blended revenue and contribution LTV/CAC. No new data platform or automated royalty engine.

**Dependencies:** P4-T01-F5, P4-T06, P3-T09; approved D-020 region/retention/access/deletion before real-data export. Synthetic model development may proceed earlier.

**Acceptance criteria:**

- [ ] Versioned SQL and data contracts implement the analytics/COST_MODEL definitions, deduplication, occurrence/ingestion times, original currency/FX, refund restatement and cohort maturity.
- [ ] Acquisition spend, verified revenue, content revenue share/MG/localization/delivery and variable infrastructure reconcile by cohort; private terms/rates and provider payloads never enter public Git.
- [ ] Series-level allocation avoids counting pack-sale revenue again when coins are spent; unallocated balances/costs remain explicit. Campaign/creative reporting states measured versus estimated coverage.
- [ ] Dataset IAM, partition filters/query limits, budget/freshness controls and deletion propagation are defined; minimum BigQuery export is required, Looker/experiments are not.

**Validation and integration tests:**

- [ ] A generated cohort with known free/ad/coin paths, late/refunded events, missing attribution and private-cost placeholders yields expected metric identities. Unknown inputs remain unknown, not zero.
- [ ] Test duplicate/reordered imports, missing joins, zero users/spend, immature cohorts, FX and export deletion/retention; reconcile to restricted source totals before real reporting.

#### P4-T03 — Produce daily economics report and data-quality checks

**Timing:** Minimum reporting/quality slice moved from P7 into MVP 2026-09-07. Looker/advanced dashboards retained in P4-T03-P7.

**Description/objective:** Produce a reproducible daily table/export or simple report for founder/growth/finance: spend, acquired users, retention/funnel, ads/coins/refunds, allocated costs, observed contribution and projected LTV:CAC. Private output only for real data; no dashboard platform required.

**Dependencies:** P4-T02; D-017 approved business guardrails and reporting owners before paid-test operation.

**Acceptance criteria:**

- [ ] Filter/group by cohort date, active market/platform, series and practical campaign/creative dimensions; expose projection horizon/assumptions, maturity and unmatched/consent coverage.
- [ ] Freshness, uniqueness, missing joins and provider/ledger/spend reconciliation checks flag unreliable results and pause affected spend/review claims.
- [ ] Exact source versions, import provenance and SQL reproduce a daily result; private reports omit unnecessary identifiers and public evidence remains synthetic.

**Validation and integration tests:**

- [ ] Reconcile a controlled reporting day and generated cohort back to source facts; stop a synthetic feed and verify the documented failure notification/hold procedure.
- [ ] Founder/finance can distinguish observed versus projected contribution and approve D-017 guardrails without a universal invented LTV:CAC threshold.

### Checkpoint 4 — MVP economics measurement

- [ ] Free/ad/coin diagnostics and verified financial facts are governed, consent/deletion-aware and reconciled.
- [ ] Source/campaign/creative cohort attribution and spend imports are sufficient for the approved test; unmatched/estimated coverage visible.
- [ ] Minimum BigQuery SQL and daily reporting calculate CAC, D1/D7/D30, ad/IAP metrics, content/infra contribution and explicit projected LTV:CAC; missing inputs never silently become zero.
- [ ] D-017 budget/guardrails and required D-020 collection/export approvals pass before paid operation. Looker, experiments, push and default MMP remain deferred.

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

- [ ] Each environment has distinct database, Firebase, AdMob, CDN and Django secrets. RevenueCat/Google coin integration adds its own environment-specific vault/auth/rotation gates before MVP testing/activation; earlier staging foundations may remain disabled until then.
- [ ] Runtime identities can access only needed secret versions.
- [ ] Rotation supports overlap where external callbacks/signing require it.

**Validation and integration tests:**

- [ ] Rotate a staging key/secret without downtime and revoke the old value.
- [ ] Secret scanning tests detect representative fake patterns and logs remain redacted.

#### P5-T05 — Implement application security baseline

**Request-boundary foundation implemented (P5-T05-F1 / #115):** Consumer API
commands accept bounded JSON rather than form or multipart payloads. `/v1/`
request bodies are capped at 64 KiB before view mutation, with a second bounded
JSON parser check for streams that bypass a declared content length. Firebase
Bearer credentials are capped at 4 KiB and must be printable ASCII without
whitespace before any verifier call. Rejections use static error envelopes and
never reflect bodies or credentials. Admin forms remain separate. Consumer APIs
never accept or serve video bytes; staff ingestion uses Django Admin and a private
signed landing store in production before submission to the configured provider.

This foundation is not distributed rate limiting, brute-force/DDoS protection,
App Check enforcement, Admin MFA/SSO, or completion of the staging authorization
matrix. Those remain later P5-T05 slices; DRF's cache throttles are non-atomic and
must not be represented as a security boundary.

**Admin foundation implemented (P5-T05-F2 / #117):** Production Admin sessions
use secure, HttpOnly, Lax SameSite cookies scoped to `/admin/`, with a rolling
one-hour idle lifetime and browser-close expiry. CSRF state is server-side,
unsafe Admin actions are integration-tested to fail without a token, staff
passwords use strong built-in validators, and Django User/Group administration
is superuser-only. A view-only catalog role is tested not to mutate titles or
read rights metadata without its own permission. Cloud Run remains internal-only.

This slice does not complete provider-backed MFA/SSO, edge login abuse controls,
or the live staging authorization matrix; those remain required before release.

**App Check foundation implemented (P5-T05-F3 / #122):** Android development
builds select Firebase's debug provider without embedding a debug token; release
builds select Play Integrity. When the public rollout switch is enforced, all app
API clients attach an ephemeral `X-Firebase-AppCheck` token. Django can enforce
Firebase project and exact Android
app ID verification before protected `/v1/` view work while excluding health,
Admin, and the authentic AdMob callback. Production settings forbid the mock
verifier, but the mobile and server switches plus Cloud Run IaC remain disabled by default until the
recorded provider/device matrix passes under D-029.

This foundation is not live Play Integrity evidence, per-request replay
prevention, distributed edge abuse protection, or a substitute for Firebase user
authentication, rights checks, reward binding, or endpoint authorization.

**Description:** Apply OWASP ASVS/MASVS-informed controls: secure storage, TLS, validation, authorization, rate limiting, CORS/CSRF, admin hardening, App Check signals, dependency scanning, and abuse controls.

**Objective:** Protect accounts, the approved catalog, rewards, coin purchases/balances/entitlements and operational interfaces.

**Dependencies:** P3-T07, P3-T09, P5-T04 for final MVP completion. Historical security foundations can proceed earlier; final review includes coin/refund/reconciliation integrity.

**Acceptance criteria:**

- [ ] Mobile tokens use platform secure storage and are absent from logs/backups where controllable.
- [ ] Admin has MFA/SSO-compatible access, restricted exposure, session security, and role separation.
- [ ] Rate/abuse controls cover auth, playback authorization, progress, unlock, reward, and webhook endpoints.

**Validation and integration tests:**

- [ ] Authorization matrix and OWASP checklist are executed against staging.
- [ ] Automated tests cover IDOR, replay, mass assignment, injection, rate limits, CSRF on Admin, and webhook forgery.

#### P5-T06 — Add backend and mobile observability

**Correlation foundation implemented (P5-T06-F1 / #119):** One validated or
generated request ID now spans success/error response headers, API error
envelopes, and structured request-completion logs. The log schema is an allowlist
of request ID, method, route template/coarse family, status, and duration; it
does not format raw paths, query strings, bodies, IPs, users, credentials, or
signed URLs. Early request-boundary failures are correlated before authentication.

Cloud Logging retention, dashboards, alerts, mobile Crashlytics, uptime checks,
and controlled staging failure evidence remain later P5-T06 slices. No provider
or live-environment result is inferred from the local correlation tests.

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
- [ ] Runbooks cover API outage, database issue, CDN/video failure, auth outage, reward discrepancy, media takedown, and data incident. MVP runbooks also cover purchase/refund/ledger/reconciliation incidents.
- [ ] Provider dependencies and fallback user messaging are documented.

**Validation and integration tests:**

- [ ] Restore a staging backup into an isolated environment and reconcile ledger/entitlements.
- [ ] Run one tabletop incident and one rollback drill; record time, gaps, and actions.

#### P5-T08 — Provision isolated production-candidate infrastructure

**Description:** Apply the reviewed infrastructure to an isolated production-candidate environment, upgrade the database from free tier, and configure domain/TLS, quotas, budgets, retention, and operational access. Provisioning and validation use generated data and approved self-owned test media only.

**Objective:** Validate a launchable environment with backups and predictable blast radius without prematurely activating public production.

**Dependencies:** P5-T01 through P5-T07.

**Acceptance criteria:**

- [ ] Production is isolated from staging with separate credentials, projects, data, and media.
- [ ] Candidate region choices are documented for the France-only launch against latency, privacy, and provider constraints; D-020 approval is required before public activation.
- [ ] Cost alerts, quota alerts, backup/PITR, audit logs, and break-glass access are enabled.
- [ ] Before Public Release Clearance, the environment cannot receive public traffic and contains no live ad units, production series masters, production user data, or commercial organization/payout credentials.

**Validation and integration tests:**

- [ ] Full production-candidate smoke test uses approved self-owned test content and test accounts only, with public ingress and commercial integrations disabled.
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

**Foundation implemented (P6-T01-F1):** The root app now supplies one typed
English message catalog and the anonymous browse → series → episode-selection
journey consumes it instead of embedding interface copy. Shared semantic color,
type, spacing, radius, and 48dp minimum-touch-target tokens cover that journey.
Episode selection scrolls so long English copy and compact Android screens keep
the primary action reachable, and catalog transport/provider details are mapped to
localized static copy before display. Automated component coverage exercises long
copy, compact safe-area metrics, and touch targets.

**Account extension implemented (P6-T01-F2):** Sign-in and account management now
use the same localized copy and visual tokens, scroll on compact Android screens,
and expose 48dp inputs, actions, and consent rows. Authentication, profile, and
account-verification failures are reduced to stable app-owned messages rather than
displaying provider or transport details. Existing session-race, consent, sign-out,
and deletion safeguards remain covered alongside long-copy and compact-screen tests.

**Player extension implemented (P6-T01-F3):** Playback loading, unavailable, locked,
failure, close, and reward-navigation copy now comes from the typed message catalog.
The player presents stable lock copy instead of raw server reason codes, uses the
shared visual tokens and 48dp controls, and has compact-screen coverage without
changing authorization, progress, completion, or next-episode behavior.

These foundations do not complete P6-T01. The reward surface still needs migration;
automated screenshot coverage and the Android TalkBack/device pass remain required
before the task and checkpoint can close.

**Description:** Standardize typography, color, spacing, safe areas, motion, skeletons, errors, accessibility, locale formatting, translated strings, and RTL readiness.

**Objective:** Deliver a coherent, accessible English-language Android product for France.

**Dependencies:** P3-T08.

**Acceptance criteria:**

- [ ] Core screens meet WCAG-informed contrast/touch-target expectations and support dynamic text/screen readers where practical for video UI.
- [ ] No user-facing string is hard-coded outside localization. MVP coin products display the store-provided localized price strings.
- [ ] Long English strings and small supported Android screens do not block primary actions.

**Validation and integration tests:**

- [ ] Run automated accessibility checks plus a manual TalkBack pass on core journeys. VoiceOver is post-MVP with iOS.
- [ ] Screenshot tests cover English, long strings, and representative Android device sizes.

#### P6-T02 — Harden offline, degraded, and update behavior

**Description:** Define cached catalog behavior, offline messaging, retries, maintenance mode, forced/minimum version, API compatibility, and EAS Update runtime-version policy. Min-version and kill switch may be build-config or a server flag without a Remote Config experiment layer (P4-T04 is P7).

**Objective:** Fail gracefully under real mobile conditions.

**Dependencies:** P5-T06.

**Acceptance criteria:**

- [ ] No purchase/debit/reward action is presented as successful without server confirmation.
- [ ] Last-known catalog can render with clear offline state; playback and monetization fail safely.
- [ ] Kill switch and minimum-version path do not trap users without store guidance.

**Validation and integration tests:**

- [ ] Test airplane mode and network loss during playback, rewarded-ad unlock, auth, progress, and config fetch. Include Google coin purchase/debit/refund synchronization paths in MVP.
- [ ] Verify compatible EAS update applies and incompatible runtime update is rejected.

#### P6-T03 — Build full regression and device matrix

**Description:** Define supported OS/device/network matrix and automate critical paths in Maestro, with manual coverage for store dialogs, ads, captions, accessibility, and background behavior. Maintain the consolidated, step-by-step deferred-validation register in `docs/runbooks/final-validation.md`; every D-029 deferral must identify prerequisites, exact commands/actions, expected evidence, owner, and the release/enablement gate it blocks.

**Objective:** Make releases repeatable across the riskiest combinations.

**Dependencies:** All MVP feature tasks.

**Acceptance criteria:**

- [ ] Automated suite covers anonymous free viewing, login at lock, progress, rewarded-ad unlock, deletion, and takedown. Include campaign attribution, coin purchase/debit/refund/reconciliation and persistent balance on reinstall/second Android device. Subscription/Apple restore and push remain P7.
- [ ] Matrix includes low/mid/high Android devices, poor network, and current/oldest supported Android versions. iPhone/iOS coverage is post-MVP.
- [ ] Flaky tests have owners and cannot silently pass via unlimited retries.
- [ ] Every D-029 deferral is present in the consolidated runbook and is either passed with evidence or remains an explicit blocker; P3-T08 Android Maestro and #98 genuine provider validation are included.

**Validation and integration tests:**

- [ ] Release candidate passes the full suite twice from clean app state.
- [ ] Run exploratory session focused on money, entitlements, privacy, and playback interruptions.

#### P6-T04 — Prepare store listings, privacy declarations, and review package

**Description:** Create Google Play metadata, screenshots, preview, age rating, Data safety declaration, support/privacy URLs, review notes, and test account/content for the France-only English listing. Include Google Play coin products/prices/terms and refund/sync review. Apple/iOS and subscriptions remain post-MVP.

**Objective:** Submit a transparent, reviewable ads-plus-coins Android product.

**Dependencies:** updated P0-T03 MVP policy/Google settlement, P6-T01, P6-T03.

**Acceptance criteria:**

- [ ] Listings disclose configured free/rewarded-ad/coin access, coin products and Google prices/terms accurately. Subscription metadata remains P7.
- [ ] Privacy declarations match SDK/data inventory and consent behavior.
- [ ] Actual public operator identity, monitored privacy contact, final notice URL and app-specific UMP setup are verified before the applicable ad test/distribution; deferred P3-T07 setup is tracked in #98 (D-028).
- [ ] Reviewer can access representative free, locked, rewarded-ad, coin purchase/unlock, pending/refund/sync and deletion flows with provided instructions. Test ad units only.

**Validation and integration tests:**

- [ ] Independent reviewer follows the submission package without developer assistance.
- [ ] Compare binary SDK inventory, network observations, and data map to store declarations.

#### P6-T05 — Run closed beta and resolve launch blockers

**Description:** Distribute through Google Play closed testing in France, recruit representative Android users, monitor quality/funnels, and triage findings by severity. TestFlight/iOS is post-MVP.

**Objective:** Validate the complete system with real devices before paid acquisition.

**Dependencies:** P5-T08, P6-T03, P6-T04.

**Acceptance criteria:**

- [ ] Beta has agreed minimum Android devices/users and uses Google Play closed testing only.
- [ ] Beta uses AdMob test ad units only; no live commercial product, ad, payout, or acquisition configuration is enabled. Google Play license-tester sandbox coin products are required for MVP; no real charges or production monetization in this beta.
- [ ] No open severity-1/2 issue, reward/entitlement mismatch, unauthorized media exposure, or unexplained critical funnel break remains.
- [ ] Playback, crash-free use, monetization, retention baseline, and support burden are reviewed.

**Validation and integration tests:**

- [ ] Reconcile every beta reward and Google tester purchase/refund with provider, ledger and entitlement records.
- [ ] Repeat regression and rollback drill on the final release candidate.

#### P6-T05A — Obtain Public Release Clearance

**Description/objective:** Assemble one independently approved record for the exact Android revision, approximately 3–5 cleared titles/creatives, France/English/one-audience configuration, environment and ads-plus-coins acquisition experiment. Documentation approval is not production clearance.

**Dependencies:** P0-T01–P0-T04, Checkpoints 3/4/5, P5-T08, P6-T03/T04/T05 and every applicable decision. D-008 commercial terms/values, D-017 budget/guardrails, D-020 privacy/retention and D-025 organization/accounts remain owner gates. D-009 subscriptions is not a dependency; D-018 only if an MMP is justified.

**Acceptance criteria:**

- [ ] Dated owner approvals cover product/audience, content/media/paid-creative rights, ads/coin policy, costs, entity, Google Play/RevenueCat/AdMob and Google IAP EUR settlement.
- [ ] Every title has private provenance or full D-031 free/ad/coin/paid-promotion grant, scope/window/takedown/reporting/exclusivity/protection and age/content approval. No private terms/assets in public evidence.
- [ ] GDPR/privacy/consent/deletion, D-020 processors/exports, Google declarations, security, accessibility, support, incident response and rollback match observed binary behavior.
- [ ] #98 genuine test ad → signed Google callback → one entitlement → fresh playback and independent activation review pass (D-028).
- [ ] Google tester purchase/refund/chargeback handling, persistent balance, atomic unlock, idempotency, reconciliation and financial-retention safeguards have evidence. No financial integrity deferral.
- [ ] Minimum attribution/spend/revenue/cost joins and daily report pass controlled reconciliation. D-017 caps, test period, sufficient-attribution criteria, business guardrails and stop/go owners/date are approved before spend.

**Validation and integration tests:**

- [ ] Independent review traces every item to owner/date/revision/configuration and rollback/expiry condition; no stale checked foundation substitutes for new scope.
- [ ] Test-data dry run proves public traffic, real purchases/ads, licensed media and paid campaigns remain disabled until their exact applicable clearance.

#### P6-T06 — Launch with controlled rollout and daily command center

**Description:** Submit to Google Play and release gradually in France, monitor technical and business guardrails, and hold daily go/hold/rollback reviews during the first launch window.

**Objective:** Limit blast radius while establishing real unit-economics data.

**Dependencies:** P6-T05, Checkpoint 5, and P6-T05A Public Release Clearance. D-017 must be Approved before any paid-acquisition campaign is enabled.

**Acceptance criteria:**

- [ ] Rollout stages, owners, halt thresholds, support coverage, and rollback options are documented.
- [ ] Check cleared titles/creatives, actual Google coin products/prices, ad setup, verified finance facts, campaign attribution/spend joins, daily contribution report, alerts and D-017 budget immediately before release. Looker is optional post-MVP.
- [ ] Paid acquisition begins only within the D-017 approved cap, using traceable creative IDs.

**Validation and integration tests:**

- [ ] Production synthetic journey verifies catalog, free playback, lock, and non-financial health after each rollout stage.
- [ ] First rewards and store purchases/refunds are manually reconciled end to end; initial campaign cohorts join spend to verified revenue and costs before any spend increase.

### Checkpoint 6 — MVP launched

- [ ] The Android app is approved and released through Google Play in France.
- [ ] Approximately 3–5 independently cleared self-owned/licensed series are available; each uncleared title remains unpublished.
- [ ] Daily cohort contribution, acquisition/commerce, retention, quality and funnel reporting operates from reconciled sources; observed/projection coverage is explicit. Looker remains P7.
- [ ] Rollout decisions follow documented technical and business guardrails.

---

### Phase 7 — Subscriptions, iOS commerce, experiments and advanced growth tools

Phase 7 follows the Android ad-plus-coin MVP. Required Android coin and minimum economics tasks were returned to Phases 3/4 on 2026-09-07. The split tasks below preserve traceability for the remaining Apple/subscription and advanced scope; P7-T01–T04 remain post-MVP. Full MMP remains conditional, not an automatic next purchase.

#### P3-T03-P7 — Extend store setup to Apple and subscriptions

**Traceability:** Remainder of original P3-T03; Android consumable products moved to MVP.

**Dependencies:** P3-T03, separately approved iOS phase for Apple, D-009 subscription terms/prices and platform-specific finance/store review.

**Acceptance/validation:** Configure Apple coin products and approved subscription groups/entitlements/offerings; verify eligible bank settlement, localized pricing and platform sandbox offerings. No Apple or subscription activation is required for MVP.

#### P3-T04-P7 — Implement subscription lifecycle and reconciliation

**Traceability:** Subscription portion of original P3-T04/P3-T09 retained post-MVP.

**Dependencies:** P3-T04, P3-T03-P7, approved D-009 and applicable per-license subscription permissions.

**Acceptance/validation:** Verified renewal/grace/billing-retry/cancel/expiry/refund/transfer state converges under replay/out-of-order events and scheduled reconciliation. Playback honors active subscriptions only within current eligibility; expiry/refund does not erase separate valid coin/ad entitlements. Test both stores only when their client phase is approved.

#### P3-T05 — Implement mobile subscription purchase and restore

Deferred from MVP 2026-08-27 (issue #52); task ID unchanged.

**Description:** Build a transparent subscription paywall using store-localized products, purchase handling, restore/sync, manage-subscription link, and resilient pending/error states.

**Objective:** Allow compliant all-access subscription purchase on both stores.

**Dependencies:** P3-T04-P7, P2-T08, approved D-009 and applicable platform release.

**Acceptance criteria:**

- [ ] Paywall clearly shows price, period, renewal, trial conditions, terms, privacy, and restore.
- [ ] Client waits for validated entitlement state and handles cancellation/pending/failure without false access.
- [ ] Same authenticated account restores eligible access on another device.

**Validation and integration tests:**

- [ ] Apple sandbox and Google license-tester purchase, renewal/expiry simulation, cancellation, and restore are executed.
- [ ] Maestro opens a locked episode, subscribes in test mode, synchronizes, and plays it.

#### P4-T02-P7 — Expand warehouse exports and experiment models

**Traceability:** Advanced scope split from original P4-T02; minimum cohort/finance/spend models are MVP.

**Dependencies:** P4-T02 and the feature/processor approval for each added export.

**Acceptance/validation:** Add Crashlytics/Remote Config/experiment/subscription models only as needed, with reviewed region/retention/deletion/cost contracts and synthetic known-outcome reconciliation. Existing financial definitions must not drift.

#### P4-T03-P7 — Build Looker and advanced dashboards

**Traceability:** Looker/advanced presentation split from original P4-T03; daily report and required data-quality checks are MVP.

**Dependencies:** P4-T03, relevant P4-T02-P7 models.

**Acceptance/validation:** Reproduce existing authoritative daily totals in Looker, add justified filters/experiment views and verify least-privilege access and refresh. No dashboard adoption is needed to begin the capped MVP test.

#### P4-T06-P7 — Add advanced deferred deep linking

**Traceability:** Advanced routing/persistence split from original P4-T06 and historical P4-T06-F1/F2/#113 work. Minimum attribution is MVP; move only a demonstrably necessary subset earlier with a recorded dependency.

**Dependencies:** P4-T06, explicit privacy/retention and routing requirements.

**Acceptance/validation:** Test installed/fresh/reinstall/account/consent transitions and safe fallback for expired/ineligible destinations; no raw personal referrers, tracking without approval or eligibility bypass.

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

**Description:** Define hypothesis template, primary metric, guardrails, sample-size check, duration, exposure, segmentation, stopping rules, and decision record. Queue free-episode count, offer order, coin price, and paywall copy experiments. Remote Config experiment-specific design remains here; D-017 budget/business guardrails are MVP release/spend requirements.

**Objective:** Turn experimentation into a disciplined product process.

**Dependencies:** P4-T03-P7, P4-T04.

**Acceptance criteria:**

- [ ] Every experiment has one primary decision metric and retention/playback/refund guardrails.
- [ ] Overlapping experiments with interacting parameters are prevented or explicitly designed.
- [ ] Results include practical effect size and cohort economics, not significance alone.

**Validation and integration tests:**

- [ ] Run an A/A or internal-only experiment to validate assignment and exposure joins.
- [ ] Reproduce experiment totals between Firebase and BigQuery within an explained tolerance.

#### P4-T07 — Decide and integrate an MMP when attribution justifies it

Conditional under D-018: retain post-MVP unless initial approved spend or attribution ambiguity makes it necessary. Never require a full MMP automatically. Prior blanket deferral (issue #52) superseded 2026-09-07.

**Description:** Before material ad spend, compare native attribution with Adjust/AppsFlyer or another approved MMP on required networks, Android attribution (Apple SKAN/AdAttributionKit only with later iOS), fraud controls, cost, privacy, raw export, and BigQuery integration.

**Objective:** Buy reliable attribution only when its value exceeds cost and native limitations.

**Dependencies:** P4-T03, P4-T06, D-018 explicit adoption/cost decision and D-020 privacy approval before integration.

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
- **Device E2E:** Maestro on Android development/release candidates; iOS is post-MVP. Follow CONTRIBUTING.md: one test at the highest level that catches a behavior, without duplicating client/screen/smoke coverage.
- **Cloud smoke tests:** real staging Firebase, Supabase, Cloud Run, Bunny Stream (or GCS/CDN/Transcoder if the fallback is active), and AdMob test ads. Google Play/RevenueCat license-tester sandbox is required for MVP.
- **Security tests:** authorization matrix, webhook forgery/replay, rate limits, dependency/container scans, OWASP checklist.
- **Performance tests:** API load, playback authorization latency, catalog response, database concurrency, HLS startup/rebuffer.
- **Recovery tests:** database restore, deploy rollback, key rotation, provider event replay/reconciliation.

### Required MVP release regression journeys

1. Bounded campaign/creative → Google Play install/first open → deduplicated acquisition cohort → eligible series → free episode → progress/resume.
2. Locked episode → login/return → configured ad-only, coin-only or both options, honoring current per-license permission.
3. Opt-in test ad → genuine SSV → one entitlement → fresh playback authorization; no mid-episode interruption.
4. Google coin pack → verified completed purchase → one credit → atomic coin debit/entitlement → playback.
5. Cancel/pending/offline/callback delay → retry/reconcile; replay/competing unlock/price change/takedown never causes false or double fulfillment.
6. Reinstall/second Android device → server balance/entitlements; refund/chargeback including spent coins → approved compensating policy and reconciled state.
7. Consent withdrawal/account replacement/deletion → no tracking leakage, proper processor cleanup and approved financial retention; late events cannot recreate/transfer a deleted account's funds.
8. Rights expiry/takedown/missing grant/unsupported DRM/spoofed market → catalog/playback/monetized grants fail closed, including previously entitled content.
9. Known cohort spend → ad/IAP/refund/ledger facts → content/infra costs → daily report; duplicate/late/missing data, currency conversion and immature D1/D7/D30 remain explicit.

### Required post-MVP regression journeys

- Subscription purchase/renewal/grace/expiry/refund/restore with separately approved license permissions.
- Apple purchase and second-device restore only with later iOS implementation/release.
- Push/deferred-link routing and experiments after their adoption, preserving eligibility and consent.

### Test data rules

- Use generated users and short self-owned, generated, or purpose-made test videos in automated/local/staging tests; record provenance and permitted test use.
- Never copy production personal data into staging.
- Keep all production masters out of Git, fixtures, screenshots, and public test builds. Automated/local media is self-owned, generated, or purpose-made; licensed masters remain prohibited until their private D-031 package and media review pass.
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
- **Staging:** isolated real cloud integrations, AdMob test units, approved self-owned/generated test media, and synthetic licensed-right metadata. Google Play/RevenueCat license testers are part of MVP commerce validation.
- **Production:** isolated paid database, real ad units (public-release gate), only independently cleared self-owned or licensed series, strict access and audit. Real Google coin products remain disabled until applicable MVP commercial clearance; Apple/subscriptions remain post-MVP.

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
| A series includes an asset without clear ownership, licensed scope, or promotional permission | Critical | Private provenance/rights package plus per-series publication gate; DRM-required grants fail closed |
| LTV does not exceed CAC | Critical | Capped ad-plus-coin acquisition test across approximately 3–5 titles; reconciled contribution including content share/infra, measured retention and explicit LTV projection. D-017 defines spend/business stop/go guardrails. |
| CDN egress destroys contribution margin | High | Watch-hour cost model, adaptive bitrates, caching, regional measurement, provider negotiation/abstraction |
| Store rejection or policy change | High | Google coin and rewarded-ad MVP listings/disclosures; store billing by default, current matrix reviewed before each submission |
| Fraudulent reward grants | High | Verified SSV, unused intent, authentic callback, idempotency, replay protection, anomaly detection |
| Fraudulent coin/IAP grants | High | MVP server ledger, verified lifecycle/webhooks, atomicity/idempotency, replay protection and reconciliation |
| Free database pauses or lacks recovery | High | Free only for development/early staging; paid production with backups/PITR |
| Expo native-module incompatibility | High | Development-build spike for video, Firebase, and AdMob before UI expansion; RevenueCat Android spike before MVP coin beta |
| Attribution is too weak for growth decisions | High | Validate minimum attribution/spend/outcome joins before capped MVP spend (D-017); D-018 MMP only when justified |
| Analytics numbers conflict | High | MVP backend/store/ad facts, minimum SQL models, synthetic cohorts and reconciliation/data-quality checks; client Analytics is diagnostic |
| Signed URLs are shared | Medium | Short TTL/prefix access, private origin, abuse monitoring; DRM/provider if contracts or leakage demand it |
| Webhooks arrive late/out of order | High | MVP coin lifecycle: immutable events, idempotent reducers, reconciliation/quarantine/support; AdMob SSV replay protection remains. |
| Small team operational overload | High | Managed services, modular monolith, runbooks, alerts with owners, no premature infrastructure |
| Privacy/SDK overcollection | High | Data inventory, consent, minimization, SDK review, deletion propagation, store declaration audit |
| Vendor lock-in | Medium | Standard PostgreSQL, provider adapters, OpenAPI, exportable analytics, ADR thresholds |
| Catalog is too small for retention | Medium | Start with approximately 3–5 independently approved series and one defined audience; expand on series/cohort evidence |

---

## 13. Decisions Required for Coding vs. Public Release

### Approved directions (2026-09-07)

Contribution LTV/CAC business hypothesis (D-032); Android/France/English launch configuration (D-001/D-002/D-023/D-027/D-034); approximately 3–5 independent titles and preferred €0 upfront/MG revenue-share/non-exclusive licensing (D-004/D-033); configured free/ad/coin/both access (D-006/D-007); Android coin architecture/timing (D-008/D-015); required MVP measurement/acquisition (D-016); and full free/ad/coin/paid-promotion licensed admission (D-031). No real commercial values or release activation are implied.

### Open founder/business decisions

- One precise target audience and content/creative fit (D-035), provisional rating/content direction (D-003), actual cleared titles/private commercial agreements.
- D-008 coin pack sizes/prices, episode costs, final consumer terms and refund/chargeback handling including spent coins. Generic configurable implementation uses synthetic values; commercial product configuration waits for approval.
- D-017 capped paid budget, test period/allocation, business guardrails, attribution sufficiency criteria, review date/owners. No spend until approved; no universal LTV:CAC ratio invented.

### Required release/provider/legal work

- French entity and Google organization/merchant/AdMob setup (D-024/D-025), Google IAP finance/tax/refund treatment and EUR settlement (D-022); actual public operator/contact/notice/UMP and genuine provider evidence (#98/D-028).
- Per-series private rights/provenance and media acceptance, license-compatible free/ad/coin/paid creatives, territory/language/window/takedown/exclusivity/reporting/protection (D-019/D-031).
- France legal/privacy/store/rating review for actual binary/data flows; D-020 residency/retention/deletion, RevenueCat and minimal attribution/warehouse processors and financial audit retention.
- Completed Android purchase/refund/reconciliation, security/entitlement and minimum cohort-economics evidence. D-029 never defers financial or protected-data safeguards; unchecked release checks stay blockers.

### Conditional or post-MVP decisions

D-018 MMP spend/ambiguity/adoption threshold stays open and conditional; do not block a reliably attributed small test on buying an MMP. If initial attribution is insufficient, hold spend and resolve scope/measurement, requesting adoption only when justified. D-009 subscription terms/prices and Apple/iOS banking/store work remain post-MVP. Looker, push, Remote Config experiments and advanced deferred links remain deferred.

No public production activation, real purchases/ads, paid spend, Google Play distribution or licensed-media publication before its applicable exact-candidate clearance. Isolated P5-T08 test-data validation may proceed earlier.

---

## 14. Suggested First 12 Implementation Moves

The accepted technical baseline permits this sequence now; Public Release Readiness work continues in parallel:

1. P1-T01 (S) — Complete/protect the repository and safety rules.
2. P1-T02 (M) — Bootstrap local Django/PostgreSQL and health checks.
3. P1-T03 (M) — Bootstrap the Expo development build against the local API.
4. P1-T04 (M) — Establish OpenAPI and the generated client.
5. P1-T05 (M) — Establish credential-free baseline CI.
6. P0-T02/P0-T03/P0-T04 (S–M each) — Complete self-owned provenance/media, France compliance, ADR, and cost readiness in parallel; do not block engineering on company/store registration data.
7. P2-T03 (M) — Build the self-owned/licensed catalog and publication controls using generated metadata and self-owned/generated test media.
8. P2-T04 (M) — Build anonymous home/detail screens against local seeded data.
9. P2-T05 (M) — Prove Bunny Stream HLS (GCP Cloud CDN fallback only if Bunny fails) using only approved test media.
10. P2-T01 (M) — Add identity with emulator/mocked verification while preserving anonymous catalog access.
11. P2-T06/P2-T07 (M each) — Exercise ingestion and playback authorization with provider fakes and non-production credentials only where a smoke test requires them.
12. P2-T08 (M) — Complete anonymous discovery-to-free-play, progress, resume, and autoplay.

Historical foundation sequence retained above. The next development phase follows the amendment dependency table: launch/domain configuration, configured access, Android coins, reconciliation and cohort economics before P6 clearance. Subscriptions remain P7.

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

### Historical cost/policy assumptions reviewed on 2026-08-23 (revalidate before use)

- Supabase Free is appropriate for prototypes but can pause after inactivity and lacks production-grade backup/SLA features; public production should be paid.
- Cloud Run has an always-free allowance, but network and dependent services can still incur costs.
- Bunny Stream bills storage plus CDN delivery; encoding is included. GCP Cloud CDN plus Transcoder remains the fallback cost model.
- Cloud Storage has limited free usage in specified US regions; Cloud CDN is usage-priced if the fallback is active.
- Transcoder is pay-per-output-minute and each rendition affects cost if the GCP fallback is active.
- Firebase Analytics, A/B Testing, Crashlytics, and several engagement tools have no-cost allowances, but quotas/pricing can change; Remote Config pricing changes begin in September 2026.
- Apple and Google generally require their purchase systems for in-app digital content and virtual currency, subject to evolving regional programs and legal exceptions. The conservative default is store billing.
- Customer price currency and developer payout currency are separate: storefronts localize customer prices, while Apple pays in the configured bank-account currency and Google pays in the payments-profile currency. The business target is EUR settlement, subject to account and bank eligibility.
- RevenueCat and AdMob require native modules, so Expo development builds are required. AdMob and Android RevenueCat/Google license-tester purchase evidence are MVP beta requirements; Apple/subscriptions remain post-MVP.
- Rewarded ads are user-initiated exchanges for a stated reward; production rewards should use provider verification and idempotent server grants.

---

## 16. Public Release Readiness and Final MVP Completion Checklist

This is a hard commercial/publication gate, not permission to activate from a documentation change. Production candidates remain isolated until every applicable item has exact-revision, catalog, environment and configuration evidence. Licensed ingestion/publication and paid creative use additionally require per-title private clearance. Historical completed foundations do not satisfy newly added scope.

### Android ad-plus-coin MVP and capped acquisition validation

- [ ] Product hypothesis, one audience, approximately 3–5 cleared titles, configured access and full free/ad/coin/paid-promotion rights approved; private contracts/rates/suppliers/media remain outside Git.
- [ ] D-008 commercial sizes/prices/episode costs, terms and refund/chargeback policy approved; D-017 budget, test period, business/attribution guardrails, owners and stop/go review approved before spend.
- [ ] French entity/registration/Google Play/RevenueCat/AdMob production setup, Google IAP finance/tax/EUR settlement and public notices/contact reviewed.
- [ ] P6-T05A independently clears exact Android revision, France/English/one-audience configuration, catalog/creatives and environment.
- [ ] Public repository/CI/security gates pass; no secrets/private/licensed assets or provider payloads in evidence.
- [ ] Generalized rights/market/language/segment domain supports future configuration; MVP active scope remains narrow and client input cannot widen eligibility.
- [ ] Admin/catalog/ingestion, Firebase password/Google auth/deletion, Bunny HLS authorization, free viewing/progress and takedown operate safely.
- [ ] Per-episode free/ad/coin/both policy and licensed permission intersection are verified at offers, grant/debit and playback.
- [ ] AdMob intent/SSV path is idempotent and genuine provider→entitlement→Android evidence passes #98/D-028.
- [ ] Google coins: verified purchase lifecycle, immutable ledger, atomic debit/entitlement, persistent balance, refunds/chargebacks, interrupted/replayed events, reconciliation and support pass. No financial integrity deferral.
- [ ] Typed commerce/product events and consent/identity/deletion controls pass; D-020 and actual Google Data safety/processor/retention declarations match binary and exports.
- [ ] Minimum reliable cohort attribution and spend imports join authoritative ad/IAP/refund and private content/infra costs; BigQuery SQL and daily report reproduce known outcomes. CAC, D1/D7/D30, ARPPU, ad/IAP/blended revenue and observed/projected contribution LTV:CAC expose maturity/coverage/unknowns.
- [ ] Staging/production IaC, secrets/rotation, backups/recovery, observability, incident/support, accessibility, Android device/regression and sandbox beta checks pass, including all permitted D-029 deferrals.
- [ ] Controlled rollout, campaign/creative permissions and daily business/quality review operate within D-017; pause unreliable measurement or breached guardrails before further spend.

### Retained post-MVP work

- [ ] Subscription products/state/purchase/restore/reconciliation and license permissions (D-009, P3-T03-P7/P3-T04-P7/P3-T05).
- [ ] Apple/iOS implementation, device evidence, banking/store setup and commerce.
- [ ] Expanded warehouse exports, Looker dashboards, Remote Config experiments, push and advanced deferred links (P4 split tasks).
- [ ] Conditional MMP decision/integration when D-018 spend or ambiguity justifies it; no automatic MVP adoption.

The platform is not yet a studio, distributor, consumer web service, or mature recommendation platform; those expansions depend on evidence from the mobile acquisition and monetization loop.

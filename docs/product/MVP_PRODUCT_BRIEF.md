# MVP Product Brief

**Plan task:** P0-T01  
**Status:** Development baseline approved; Public Release Readiness remains open
**Product codename:** Shortform Streaming  
**Last updated:** 2026-08-27

## Product statement

Shortform Streaming is a mobile-first platform for licensed vertical microdramas. Viewers discover a series, watch short episodes, and continue through a hardcoded free window plus verified rewarded-ad unlocks.

The MVP is a market-validation product. Launch catalog is **one** series. It must determine whether rewarded-ad LTV on that series can beat capped Meta/TikTok CAC. It is not intended to prove that a large streaming catalog can be built.

### MVP hypothesis (founder 2026-08-27)

> Can rewarded-ad LTV on one series beat capped Meta/TikTok CAC?

If the ads-only test fails, that is evidence ads cannot carry UA — **not** that microdrama is dead. P7 IAP is the next test.

## Development baseline and public-release direction

Founder-approved decisions are marked **Approved**. The release-ready product scope still includes rights, GDPR/privacy-by-design, security, quality, age/content controls, consent, account deletion, store policy, server-authoritative ad grants/entitlements, and launch checks.

Phase 1 repository/backend bootstrap is authorized now using local services, emulators/fakes, generated test data, and short self-owned, generated, or purpose-made test videos. It does not require a formed company, store organization/account enrollment, payout details, or licensed media. Those items are **Required before public release**, not before architecture or coding.

- **Product language:** English (`en`) for all MVP user-facing interface copy — **Approved 2026-08-23**.
- **Distribution countries/storefronts:** The 21 EU countries using EUR enumerated canonically in decision D-001 — **Founder scope approved 2026-08-23**. Each market remains gated by territorial content rights and local legal and language requirements before its storefront is enabled.
- **Intended legal-entity country:** France — **Founder direction approved 2026-08-23**. Legal name/form, incorporation, registered address, D-U-N-S where required, organization-account enrollment, and legal/finance validation are deferred to Public Release Readiness.
- **Customer billing currency:** The currency and localized price string supplied by the user's App Store or Google Play storefront — **Approved 2026-08-23**. The app must never derive a currency from its language or construct a monetary price manually. Although every approved MVP market uses EUR, localized price presentation, VAT treatment, and national requirements can still vary. Store billing strings apply when P7 IAP ships; MVP has no IAP.
- **Company reporting currency:** EUR — **Approved 2026-08-23**.
- **Desired store-settlement currency:** EUR — **Approved business requirement 2026-08-23**. Production setup must confirm that the legal entity, Apple bank-account currency, Google payments profile, and eligible bank/SEPA account support EUR settlement. Store settlement is required before P7 IAP, not before ads-only MVP.
- **Audience:** Adults who already consume romance, revenge, fantasy, and cliffhanger-driven short-form video.
- **Content rating:** 16+ provisional — **Decision required after the launch catalog is known**.
- **Catalog:** English-language microdramas — **Approved 2026-08-23**. Launch catalog is **1** licensed (or self-owned/generated test) series — **Founder approved 2026-08-27 (D-004)**. The catalog data model still supports N series. Expansion after ads-only unit-economics validation. Development uses only self-owned, generated, or purpose-made test media. Every public title remains subject to rights approval for every launch territory.
- **Platforms:** iOS and Android. Django Admin is the only web interface in MVP.
- **Acquisition:** Small, capped Meta and TikTok creative tests with traceable campaign and creative IDs (D-017 still required before paid spend).
- **Guest boundary:** Anonymous discovery and free playback; authentication required before a monetized unlock (rewarded ad) or cross-device sync — **Founder approved 2026-08-27 (D-005)**.
- **Default free window:** First five episodes, hardcoded / admin-configured, not Remote Config or experiment cohorts in MVP — **Founder approved 2026-08-27 (D-006)**; experimentable in P7.
- **Rewarded ad:** One verified ad permanently unlocks one episode for that account. This is the **only MVP monetization path** — **Founder approved 2026-08-27 (D-007)**.
- **Coins:** Deferred to P7 IAP. D-008 remains **Proposed**; not required for MVP launch.
- **Subscription:** Deferred to P7 IAP. D-009 remains **Proposed**; not required for MVP launch.

## Target users and jobs

### Viewer

- Discover a compelling story within seconds.
- Start watching without registration friction.
- Continue after a cliffhanger by watching a verified rewarded ad.
- Resume on another device after signing in.
- Understand the reward before the ad starts, without unrequested interruption.

### Content operator

- Record rights and delivery metadata.
- Ingest, validate, publish, unpublish, and take down a series safely.
- Configure the free-episode window and rewarded-ad availability without code changes.
- See processing errors and rights expirations before they affect users.

### Growth/product operator

- Attribute acquired cohorts to campaign, creative, and the launch series.
- Measure progression, retention, ad yield, CAC, and contribution LTV from verified ad revenue.
- Run Remote Config experiments and IAP tests in P7 after ads-only validation.

## MVP journeys

1. Campaign deep link → series detail → free episode → autoplay/resume.
2. Locked episode → account creation/login → rewarded-ad unlock → playback.
7. User → account deletion → authenticated deletion and data cleanup/anonymization.
8. Operator → rights-valid ingestion → publication → immediate takedown when required.

Journeys 3–6 (coin pack, subscription, restore/sync of store purchases, push) are **deferred to P7** with unchanged plan task IDs. They are not MVP-required.

## MVP scope

The authoritative scope is Section 3 of `MICRODRAMA_IMPLEMENTATION_PLAN.md`. In summary, MVP includes catalog (N-capable, 1 title at launch), identity, rights-aware HLS playback, progress, AdMob SSV and server entitlements for ad grants, thin Firebase Analytics events, campaign IDs, ingestion, rights, staging/prod, CI, privacy, and deletion.

Store IAP, coins, subscriptions, RevenueCat, push/lifecycle campaigns, BigQuery/Looker metric models, Remote Config experiments, and MMP are **deferred to P7**, not deleted.

It excludes consumer web streaming, user-generated content, offline downloads, live streaming, household profiles, TV apps, custom recommendation ML, and microservices.

## Product principles

- Reach first play before asking for an account.
- Never interrupt an episode with an unrequested ad.
- State the reward before the user commits.
- Treat every reward and entitlement as server-authoritative.
- Make rights eligibility part of every catalog and playback decision.
- Treat a failed ads-only LTV>CAC test as evidence about ads and UA, not as a verdict on microdrama or on P7 IAP.
- Prefer a reversible experiment (P7) to a permanent product assumption.
- Optimize contribution margin, not gross revenue or watch time in isolation.

## Metrics

### Primary business metric (MVP ads-only)

`cohort contribution margin = verified ad revenue - CAC - content royalties/revenue share - variable infrastructure - applicable taxes`

Store IAP/subscription revenue joins this formula in P7. Do not treat an ads-only miss as proof that IAP cannot work.

### Product and quality metrics (MVP-required)

- Install/deep-link to first-play conversion.
- Episode 1 start/completion and episode continuation curve.
- Lock reach, rewarded-ad offer acceptance, and verified reward rate.
- Ad revenue per daily active user and CAC versus verified ad revenue.
- D1, D7, and D30 retention and projected cohort LTV from ad yield.
- Playback startup time, rebuffer ratio, completion, and error rate.
- Crash-free sessions/users and API availability/latency.
- LTV/CAC and contribution by creative, the launch series, market, and platform.

Payer conversion, ARPDAU from IAP, renewal, churn, and refund rate are **P7 IAP metrics**, not MVP-required.

## Launch and stop/go gates

Final numerical gates require a launch budget and baseline. Until approved, use these rules:

- Do not start paid acquisition before the complete campaign → verified ad-outcome data path is tested (D-017 still required before paid spend).
- Do not increase spend on a cohort that cannot be reconciled to verified ad outcomes.
- Stop rollout for a rights leak, unreconciled ad-grant mismatch, severity-1/2 security defect, or material entitlement failure.
- Stop an experiment when a predeclared safety guardrail is crossed (experiments themselves are P7).
- Scale only after contribution LTV has a credible path above CAC with an agreed margin and confidence window. If ads-only cannot carry UA, stop or cap ads spend and use that evidence to design the P7 IAP test — do not conclude that microdrama is dead.

## Approval checklist

### Required for architecture/coding

- [x] Founder approves English as the MVP product language.
- [x] Founder approves store-localized customer pricing and EUR as the company reporting/desired settlement currency.
- [x] Founder selects the distribution countries/storefronts and France as the intended legal-entity country.
- [x] Engineering architecture baseline permits Phase 1 repository and backend bootstrap with local/emulated/fake dependencies and no real credentials.
- [x] Founder approves guest boundary, one-series catalog, hardcoded free window, and rewarded-ad-only monetization defaults (D-004–D-007, 2026-08-27).

### Required before public release

- [ ] Legal/finance confirms legal name/form, incorporation, registered address, D-U-N-S where required, and production organization/account configuration for the French entity.
- [ ] Finance validates EUR settlement with the actual Apple banking configuration and Google payments profile/bank account (required before P7 IAP; ads-only MVP still needs entity/AdMob production configuration before real ads).
- [ ] Founder approves provisional audience/content-rating direction.
- [ ] Founder defines the capped acquisition budget and maximum validation period.
- [ ] Content/legal owner confirms the catalog can satisfy the rights checklist.
- [ ] Legal/content review confirms local language and consumer-law requirements for every enabled launch market.
- [ ] Engineering confirms the video and ads proof-of-concepts before production configuration.

Unchecked Public Release Readiness items do not block Phase 1 or isolated production-candidate provisioning/validation, but no public production activation/traffic promotion, storefront distribution, licensed-media publication, real advertising, or P7 real purchase/subscription may be enabled until every applicable release item is approved and verified. P0-T01 remains open for that release-readiness record. D-008 and D-009 are not required for ads-only public release.

## Store pricing and settlement references

- Apple generates comparable storefront prices from a base country or region: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple requires the bank account's primary currency and supports IBAN where applicable: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/
- Apple displays proceeds in the bank account currency: https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google charges customers in supported local currencies and pays in the payments-profile currency: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google merchant bank requirements, including the EEA SEPA nomination path: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en

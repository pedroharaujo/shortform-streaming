# MVP Product Brief

**Plan task:** P0-T01  
**Status:** Development baseline approved; Public Release Readiness remains open
**Product codename:** Shortform Streaming  
**Last updated:** 2026-09-02

## Product statement

Shortform Streaming is an Android-first platform for vertical microdrama series. Viewers discover self-owned or properly licensed series, watch short episodes, and continue through a hardcoded free window plus verified rewarded-ad unlocks.

The MVP is a product-loop validation release. The catalog may contain multiple independently approved series so a single title does not determine the product result. It must determine whether viewers watch through the free window and willingly use verified rewarded ads to continue. Paid-acquisition economics are the next phase, not a reason to add attribution infrastructure now.

### MVP hypothesis (founder 2026-08-27)

> Will viewers progress through an approved catalog of vertical series and use rewarded ads to unlock more episodes?

If the ads-only loop fails, that is evidence about this access model and series — **not** that microdrama is dead. P7 can test paid acquisition and IAP separately.

## Development baseline and public-release direction

Founder-approved decisions are marked **Approved**. The release-ready product scope still includes ownership/provenance or licensed-rights evidence, GDPR/privacy-by-design, security, quality, age/content controls, consent, account deletion, Google Play policy, server-authoritative ad grants/entitlements, and launch checks. Multi-country rollout remains post-MVP.

Development and validation use local services, emulators/fakes, generated test data, and short self-owned videos. Licensed-series support is implemented with synthetic metadata only. Actual licensed ingestion requires the private rights package and media acceptance in D-031; contracts, rates, provider payloads, personal data, and licensed media never enter this public repository. Company, Google Play organization/account enrollment, AdMob production configuration, payout details, and the France-specific release review remain **Required before public release**, not before architecture or coding.

- **Product language:** English (`en`) for all MVP user-facing interface copy — **Approved 2026-08-23**.
- **Distribution country/storefront:** **France only through Google Play** — **Founder scope narrowed 2026-09-01 (D-001)**. Additional countries are post-MVP and require a new explicit decision and market-specific review.
- **Intended legal-entity country:** France — **Founder direction approved 2026-08-23**. Legal name/form, incorporation, registered address, D-U-N-S where required, organization-account enrollment, and legal/finance validation are deferred to Public Release Readiness.
- **Customer billing currency:** MVP has no IAP. Store-provided price strings remain a P7 requirement; no monetary price is constructed from language or locale.
- **Company reporting currency:** EUR — **Approved 2026-08-23**.
- **Desired store-settlement currency:** EUR — **Approved business requirement 2026-08-23**. Production setup must confirm that the legal entity, Apple bank-account currency, Google payments profile, and eligible bank/SEPA account support EUR settlement. Store settlement is required before P7 IAP, not before ads-only MVP.
- **Audience:** Adults who already consume romance, revenge, fantasy, and cliffhanger-driven short-form video.
- **Content rating:** 16+ provisional — **Decision required after the launch catalog is known**.
- **Catalog:** one or more English-language series, self-owned or properly licensed — **Founder approved 2026-09-02 (D-004/D-023/D-031)**. Every title independently requires private ownership/provenance or a complete licensed-rights package, media acceptance, age/content review, and a compatible protection decision before publication.
- **Platforms:** **Android / Google Play only for MVP** — **Founder approved 2026-08-30 and clarified 2026-09-01 (D-026/D-027)**. iOS implementation, validation, Sign in with Apple, TestFlight, and storefront work are post-MVP. Django Admin is the only web interface in MVP.
- **Acquisition:** Organic/direct test distribution only. Paid acquisition and campaign attribution are post-MVP and still require D-017 before spend.
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

- Record ownership/provenance or licensed-rights references and delivery metadata for each series.
- Upload an approved master through Django Admin, monitor processing, publish/unpublish, and take down safely.
- Configure the free-episode window and rewarded-ad availability without code changes.

### Growth/product operator

- Measure progression, retention, and verified rewarded-ad outcomes with a minimal event set.
- Add campaign attribution and paid-acquisition economics only after the MVP loop is validated.
- Run Remote Config experiments and IAP tests in P7 after ads-only validation.

## MVP journeys

1. App open → series detail → free episode → autoplay/resume.
2. Locked episode → account creation/login → rewarded-ad unlock → playback.
7. User → account deletion → authenticated deletion and data cleanup/anonymization.
8. Operator → Django Admin upload → provider processing → provenance/rights-checked publication → immediate takedown when required.

Journeys 3–6 (coin pack, subscription, restore/sync of store purchases, push) are **deferred to P7** with unchanged plan task IDs. They are not MVP-required.

## MVP scope

The authoritative scope is Section 3 of `MICRODRAMA_IMPLEMENTATION_PLAN.md`. In summary, MVP includes an English catalog of independently approved self-owned or licensed series in France on Android, Firebase email/password and Google identity, protected HLS playback, progress, AdMob SSV and server entitlements for ad grants, thin Firebase Analytics events, Django Admin media ingestion, ownership/provenance or licensed-rights enforcement, staging/prod, CI, privacy, and deletion.

Store IAP, coins, subscriptions, RevenueCat, campaign attribution/deferred deep linking, paid acquisition, push/lifecycle campaigns, BigQuery/Looker metric models, Remote Config experiments, and MMP are **deferred to P7**, not deleted.

It excludes iOS release work, additional countries/languages, public contract/rate storage, automated royalty accounting, consumer web streaming, user-generated content, offline downloads, live streaming, household profiles, TV apps, custom recommendation ML, and microservices.

## Product principles

- Reach first play before asking for an account.
- Never interrupt an episode with an unrequested ad.
- State the reward before the user commits.
- Treat every reward and entitlement as server-authoritative.
- Publish only independently approved self-owned or licensed series, preserve opaque provenance/contract references, and fail closed for missing, mismatched, expired, DRM-required, or taken-down rights.
- Treat a failed ads-only viewing/unlock loop as evidence about the test, not as a verdict on microdrama or on P7 IAP.
- Prefer a reversible experiment (P7) to a permanent product assumption.
- Optimize contribution margin, not gross revenue or watch time in isolation.

## Metrics

### Primary business metric (MVP ads-only)

`MVP variable contribution = verified ad revenue - variable infrastructure - applicable taxes`

Content cost, CAC, and store revenue join the full contribution model in P7. Do not treat an ads-only miss as proof that IAP cannot work.

### Product and quality metrics (MVP-required)

- App-open to first-play conversion.
- Episode 1 start/completion and episode continuation curve.
- Lock reach, rewarded-ad offer acceptance, and verified reward rate.
- Verified ad revenue per active and engaged viewer.
- D1, D7, and D30 retention and projected cohort LTV from ad yield.
- Playback startup time, rebuffer ratio, completion, and error rate.
- Crash-free sessions/users and API availability/latency.
- Aggregate rewarded-ad yield and contribution by series and across the approved catalog in France on Android.

Payer conversion, ARPDAU from IAP, renewal, churn, and refund rate are **P7 IAP metrics**, not MVP-required.

## Launch and stop/go gates

Final numerical gates require a launch budget and baseline. Until approved, use these rules:

- Do not start paid acquisition until the post-MVP attribution phase is implemented and D-017 is approved.
- Do not increase spend on a cohort that cannot be reconciled to verified ad outcomes.
- Stop rollout for unauthorized media exposure, an unreconciled ad-grant mismatch, a severity-1/2 security defect, or a material entitlement failure.
- Stop an experiment when a predeclared safety guardrail is crossed (experiments themselves are P7).
- Add paid acquisition only after the P7 attribution and budget gates are approved. Use MVP viewing and reward evidence to design that test; do not conclude that microdrama is dead from one series.

## Approval checklist

### Required for architecture/coding

- [x] Founder approves English as the MVP product language.
- [x] Founder approves store-localized customer pricing and EUR as the company reporting/desired settlement currency.
- [x] Founder selects France-only Google Play distribution and France as the intended legal-entity country (D-001, narrowed 2026-09-01).
- [x] Engineering architecture baseline permits Phase 1 repository and backend bootstrap with local/emulated/fake dependencies and no real credentials.
- [x] Founder approves guest boundary, a multi-series self-owned/licensed catalog, hardcoded free window, and rewarded-ad-only monetization defaults (D-004–D-007/D-031; catalog scope updated 2026-09-02).

### Required before public release

- [ ] Legal/finance confirms legal name/form, incorporation, registered address, D-U-N-S where required, and production organization/account configuration for the French entity.
- [ ] Finance validates EUR settlement with the actual Apple banking configuration and Google payments profile/bank account (required before P7 IAP; ads-only MVP still needs entity/AdMob production configuration before real ads).
- [ ] Founder approves provisional audience/content-rating direction.
- [ ] Founder defines the capped acquisition budget and maximum validation period.
- [ ] Founder/content owner records private ownership/component provenance or completes the private D-031 rights package for every candidate series.
- [ ] Legal/content review confirms the English-language catalog, rating, promotional use, and consumer-law requirements for France.
- [ ] Engineering confirms the video and ads proof-of-concepts before production configuration.

Unchecked Public Release Readiness items do not block development or isolated production-candidate validation, but no public production activation, traffic promotion, Google Play distribution, real advertising, or P7 real purchase/subscription may be enabled until every applicable France/Android release item is approved and verified. Licensed media additionally remains unpublished until its per-series D-031 clearance passes. P0-T01 remains open for that release-readiness record. D-008 and D-009 are not required for ads-only public release.

## Store pricing and settlement references

- Apple generates comparable storefront prices from a base country or region: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple requires the bank account's primary currency and supports IBAN where applicable: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/
- Apple displays proceeds in the bank account currency: https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google charges customers in supported local currencies and pays in the payments-profile currency: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google merchant bank requirements, including the EEA SEPA nomination path: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en

# MVP Product Brief

**Plan task:** P0-T01  
**Status:** Partially approved; remaining launch decisions are listed below
**Product codename:** Shortform Streaming  
**Last updated:** 2026-08-23

## Product statement

Shortform Streaming is a mobile-first platform for licensed vertical microdramas. Viewers discover a series, watch short episodes, and continue through a configurable combination of free access, rewarded-ad unlocks, coins, and an all-access subscription.

The MVP is a market-validation product. It must determine whether specific creative/content/audience cohorts can produce contribution LTV greater than CAC. It is not intended to prove that a large streaming catalog can be built.

## Launch configuration

Founder-approved decisions are marked **Approved**. Items marked **Decision required** block final production configuration but do not block repository scaffolding.

- **Product language:** English (`en`) for all MVP user-facing interface copy — **Approved 2026-08-23**.
- **Distribution countries/storefronts:** To be selected — **Decision required**. Product language does not determine store availability.
- **Customer billing currency:** The currency and localized price string supplied by the user's App Store or Google Play storefront — **Approved 2026-08-23**. The app must never derive a currency from its language or construct a monetary price manually.
- **Company reporting currency:** EUR — **Approved 2026-08-23**.
- **Desired store-settlement currency:** EUR — **Approved business requirement 2026-08-23**. Production setup must confirm that the legal entity, Apple bank-account currency, Google payments profile, and eligible bank/SEPA account support EUR settlement.
- **Audience:** Adults who already consume romance, revenge, fantasy, and cliffhanger-driven short-form video.
- **Content rating:** 16+ provisional — **Decision required after the launch catalog is known**.
- **Catalog:** 5–10 licensed, non-exclusive vertical series.
- **Platforms:** iOS and Android. Django Admin is the only web interface in MVP.
- **Acquisition:** Small, capped Meta and TikTok creative tests with traceable campaign and creative IDs.
- **Guest boundary:** Anonymous discovery and free playback; authentication required before a monetized unlock or cross-device sync.
- **Default free window:** First five episodes, remotely configurable.
- **Rewarded ad:** One verified ad permanently unlocks one episode for that account.
- **Coins:** Purchased consumable packs; coins do not expire; one episode has a server-configured coin price.
- **Subscription:** Store-managed auto-renewing access to the eligible catalog while active.

## Target users and jobs

### Viewer

- Discover a compelling story within seconds.
- Start watching without registration friction.
- Continue after a cliffhanger using the preferred value exchange.
- Resume on another device after signing in.
- Understand prices, rewards, balance, and subscription state without ambiguity.

### Content operator

- Record rights and delivery metadata.
- Ingest, validate, publish, unpublish, and take down a series safely.
- Configure free episodes and monetization offers without code changes.
- See processing errors and rights expirations before they affect users.

### Growth/product operator

- Attribute acquired cohorts to campaign, creative, series, and experiment.
- Measure progression, retention, revenue, ad yield, CAC, and contribution LTV.
- Run controlled experiments with guardrails and reproducible decisions.

## MVP journeys

1. Campaign deep link → series detail → free episode → autoplay/resume.
2. Locked episode → account creation/login → rewarded-ad unlock → playback.
3. Locked episode → coin-pack purchase → verified credit → atomic episode unlock → playback.
4. Locked episode → subscription purchase → verified entitlement → playback.
5. Existing user → restore/synchronize access on a second device.
6. User → notification → eligible series/episode or safe fallback.
7. User → account deletion → authenticated deletion and data cleanup/anonymization.
8. Operator → rights-valid ingestion → publication → immediate takedown when required.

## MVP scope

The authoritative scope is Section 3 of `MICRODRAMA_IMPLEMENTATION_PLAN.md`. In summary, MVP includes catalog, identity, rights-aware HLS playback, progress, three monetization paths, push, analytics, experimentation, production operations, and store launch.

It excludes consumer web streaming, user-generated content, offline downloads, live streaming, household profiles, TV apps, custom recommendation ML, and microservices.

## Product principles

- Reach first play before asking for an account.
- Never interrupt an episode with an unrequested ad.
- State the reward and price before the user commits.
- Treat every purchase, coin, reward, and entitlement as server-authoritative.
- Make rights eligibility part of every catalog and playback decision.
- Prefer a reversible experiment to a permanent product assumption.
- Optimize contribution margin, not gross revenue or watch time in isolation.

## Metrics

### Primary business metric

`cohort contribution margin = net store revenue + verified ad revenue - CAC - content royalties/revenue share - variable infrastructure - refunds - applicable taxes`

### Product and quality metrics

- Install/deep-link to first-play conversion.
- Episode 1 start/completion and episode continuation curve.
- Paywall reach and offer acceptance by method.
- Reward verification rate and ad revenue per daily active user.
- Payer conversion, ARPDAU, renewal, churn, and refund rate.
- D1, D7, and D30 retention and projected cohort LTV.
- Playback startup time, rebuffer ratio, completion, and error rate.
- Crash-free sessions/users and API availability/latency.
- LTV/CAC and contribution by creative, series, market, platform, and experiment.

## Launch and stop/go gates

Final numerical gates require a launch budget and baseline. Until approved, use these rules:

- Do not start paid acquisition before the complete campaign → verified outcome data path is tested.
- Do not increase spend on a cohort that cannot be reconciled to verified revenue and ad outcomes.
- Stop rollout for a rights leak, unreconciled financial mismatch, severity-1/2 security defect, or material entitlement failure.
- Stop an experiment when a predeclared safety guardrail is crossed.
- Scale only after contribution LTV has a credible path above CAC with an agreed margin and confidence window.

## Approval checklist

- [x] Founder approves English as the MVP product language.
- [x] Founder approves store-localized customer pricing and EUR as the company reporting/desired settlement currency.
- [ ] Founder selects the distribution countries/storefronts and legal entity.
- [ ] Finance validates EUR settlement with the actual Apple banking configuration and Google payments profile/bank account.
- [ ] Founder approves provisional audience/content-rating direction.
- [ ] Founder approves guest boundary and monetization defaults.
- [ ] Founder defines the capped acquisition budget and maximum validation period.
- [ ] Content/legal owner confirms the catalog can satisfy the rights checklist.
- [ ] Engineering confirms the video and store proof-of-concepts before production configuration.

When every item is approved, P0-T01 may be marked complete.

## Store pricing and settlement references

- Apple generates comparable storefront prices from a base country or region: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple requires the bank account's primary currency and supports IBAN where applicable: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/
- Apple displays proceeds in the bank account currency: https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google charges customers in supported local currencies and pays in the payments-profile currency: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google merchant bank requirements, including the EEA SEPA nomination path: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en

# MVP Product Brief

**Plan task:** P0-T01  
**Status:** Founder strategy approved; implementation and Public Release Readiness remain open
**Product codename:** Shortform Streaming  
**Last updated:** 2026-09-07

## Product statement and business hypothesis

Shortform Streaming is an Android-first platform for vertical microdrama series. Viewers discover independently approved self-owned or licensed stories, watch free episodes, and continue using the rewarded-ad or purchased-coin options configured for each episode.

> Can we acquire users profitably? Can contribution LTV become greater than CAC for users acquired in our initial market and target audience?

Contribution LTV is the projected lifetime contribution per acquired user before acquisition cost; CAC is the cost of acquiring one user. The MVP must measure engagement and retention alongside real ad revenue, coin purchases, content costs, infrastructure, and a small capped paid-acquisition test. The primary business metric is **contribution LTV / CAC**. No universal pass/fail ratio is approved.

The 2026-08-27 product-loop-only hypothesis and monetization/timing decisions are **Superseded** by the founder direction dated 2026-09-07. Their history remains in [DECISION_REGISTER.md](DECISION_REGISTER.md). This documentation approval does not claim the new capabilities are implemented or authorize spend.

## MVP launch configuration and platform capability

**Build the platform so it can grow, but validate the business with the smallest possible market scope.**

| Dimension | Active MVP launch configuration | Platform capability / later activation |
|---|---|---|
| Client/storefront | Android / Google Play only | iOS/Apple implementation and release remain post-MVP; consumer web also remains post-MVP |
| Country | France only (D-001) | Market-specific availability, rights, storefront and policy configuration; every additional rollout needs explicit approval and review |
| Language | English interface and catalog (D-002/D-023) | Language-independent content IDs, localized metadata and separately scoped original/subtitle/dub rights |
| Audience | One defined target audience, exact segment still to be approved (D-035) | Multiple editorial audiences/content segments without redesigning catalog identity or eligibility |
| Catalog | Approximately 3–5 independently approved series (D-004) | Reusable per-series publication and rights gates |
| Acquisition | Small controlled paid test after D-017 approval | More spend and more complex attribution only when justified |
| Currency | Store-provided Google Play localized prices; EUR reporting and desired settlement | Multiple currencies from store pricing, preserved original financial amounts and documented reporting conversion |

France, Android and English are active server-controlled launch configuration, not permanent domain constants. Do not add a country/language picker or multi-country UX in MVP. Preserve generalized territory, platform, language, content-segment and monetization-permission dimensions in domain models and APIs. Client-supplied locale, country or storefront must never widen eligibility; trusted market resolution and rights checks remain server-owned. P2-T03-F3 implements this configuration and rights-admission foundation; [the launch-context runbook](../runbooks/catalog-launch-context.md) describes conservative migration and private reapproval. Editorial episode offers and coin transactions remain subsequent tasks.

The existing broad audience idea—adults who consume romance, revenge, fantasy and cliffhanger-driven video—is a candidate pool, not a sufficiently specific approved acquisition segment. D-035 must define one audience and its content/creative fit before the test. The provisional 16+ rating remains unapproved and catalog-dependent (D-003).

## Catalog and licensing strategy

Target approximately **3–5 independently approved series** so the result is not determined by a single title. Prefer **€0 upfront license cost, €0 minimum guarantee where possible, revenue share, and non-exclusive licensing where possible** (D-033). These are commercial targets, not schema restrictions or permission to accept particular terms. The platform must continue supporting other licensing structures.

Each title needs private ownership/component provenance or a complete licensed-rights package plus media acceptance, age/content review and compatible protection. Licensed MVP titles must permit France streaming, Android/Google Play, required English localization, free episodes, rewarded ads, coin-based transactional episode access, and paid acquisition using approved clips, trailers, posters, stills and relevant likenesses. Confirm revenue-share reporting, window, takedown, exclusivity restrictions and DRM/protection requirements. See [CONTENT_RIGHTS_CHECKLIST.md](CONTENT_RIGHTS_CHECKLIST.md).

Contracts, supplier information, commercial terms, percentages, rates, media, provider payloads and personal data stay in private systems. Public documentation/fixtures contain only opaque references and synthetic enforcement metadata. Missing, mismatched, expired, taken-down or unsupported DRM rights fail closed. An entitlement never overrides current content eligibility.

## Episode access and monetization

- Anonymous discovery and free playback remain available. Firebase email/password and Google Sign-In remain validated Android identity paths (D-030). Authentication is required before purchases, monetized unlocks and cross-device synchronization.
- The first-five-episodes free window remains an initial editorial default (D-006), with server/Admin configuration for **free, rewarded-ad, coin, or both rewarded-ad and coin options per episode**. Do not hardcode all locked episodes to one method. An operator may choose coin-only cliffhangers; automatic cliffhanger detection is out of scope.
- Evaluate rights/publication/window/territory/platform/language/protection and takedown before access. Then honor a valid existing entitlement or the configured free policy; otherwise return only configured and legally permitted unlock methods. Revalidate eligibility, method and current server price at grant/debit time.
- AdMob rewarded ads stay opt-in, disclose the reward, and occur between episodes without interrupting playback. One verified SSV reward can grant the configured persistent episode entitlement. No forced mid-episode ads or interstitial advertising in MVP.
- Android consumable coin purchases use Google Play Billing and RevenueCat (ADR 0006). Django owns an immutable coin ledger, persistent balances, idempotent verified credits, atomic debit plus entitlement, refunds/chargebacks and reconciliation. Client purchase success, balance and analytics are never financial authority.
- Coin pack sizes, prices, episode coin costs and final coin/refund terms remain open under D-008. No direct credit-card checkout. Store monetary strings come from the active storefront, never the English locale.
- Subscriptions and all Apple/iOS commerce remain post-MVP (D-009/D-026). Restore/sync in MVP means recovering server balance/entitlements and reconciling verified consumable transactions; it must never re-credit consumed purchases on reinstall.

Implementation note: P3-T01-F1 provides the editorial configuration, versioned
offers, Admin history, and current-policy reward checks described in the
[access-policy runbook](../runbooks/access-policy.md). Coin prices are configurable
metadata; coin methods and spending remain unavailable until P3-T02 supplies the
wallet/debit implementation. This does not approve commercial values or activation.

## MVP journeys

1. Campaign/creative → attributed Google Play install/first open → eligible series → free episode → progress/resume.
2. Locked episode → account creation/login → configured rewarded-ad option → verified grant → fresh playback authorization.
3. Locked episode → coin-pack view → Google Play purchase → verified server credit → atomic coin unlock → playback.
4. Cancelled/pending/offline purchase → safe pending/failure state → reconciliation; replay creates no duplicate credit.
5. Same account on reinstall/another Android device → persistent balance/entitlements; refund/chargeback → auditable correction and reconciled access under the approved policy.
6. User → reauthenticated account deletion → operational/processor cleanup with only approved financial retention.
7. Operator → private per-title clearance → Django Admin ingestion → rights-checked publication → immediate takedown.
8. Growth/finance → join campaign spend, acquired cohorts, engagement, verified revenue and allocated costs → daily contribution review.

## Scope and operating principles

Keep Django/DRF modular monolith, Django Admin, React Native/Expo, PostgreSQL, Firebase Auth, Bunny Stream default video delivery, AdMob, RevenueCat and server-authoritative entitlements. Never serve video bytes through Django.

MVP includes the minimum Firebase-to-BigQuery export, backend/store/provider facts, campaign-spend joins and reproducible SQL/reporting required for cohort economics (P4-T01-F5, P4-T02, P4-T03, P4-T06; ADR 0007). A full MMP is not a default dependency. Use the simplest reliable attribution method for the approved spend, with D-018 retained for MMP adoption when ambiguity or spend justifies it.

Post-MVP: subscriptions, iOS, consumer web, multi-country/language rollout UX, recommendation ML, automated royalty accounting, push, Remote Config A/B experimentation, Looker dashboards and advanced deferred deep linking unless required for the initial paid test. Manual private content-cost and ad-network-spend imports are acceptable with provenance, repeatability and reconciliation.

## Core metrics

Definitions, denominators and authority are in [the analytics measurement contract](../analytics/README.md) and [COST_MODEL.md](COST_MODEL.md).

| Category | MVP-required measures |
|---|---|
| Acquisition | Spend, installs and deduplicated acquired users, CAC, source/campaign/creative, unattributed share |
| Engagement | First-play conversion, episode completion/continuation, lock reach, D1/D7/D30 retention |
| Advertising | Rewarded-ad acceptance, verified impressions/rewards, net ad revenue/user |
| Commerce | Payer conversion, coin-pack purchase conversion and sales, ARPPU, net IAP revenue/user, refunds/chargebacks |
| Business | Blended net revenue/user, revenue-share and other content cost, contribution LTV, LTV:CAC, economics by series and campaign/creative where supportable |
| Quality | Playback startup/rebuffer/error, crash-free use, API reliability, financial/entitlement mismatches |

Keep observed D1/D7/D30 contribution separate from projected lifetime contribution. Immature cohorts, missing joins and consent-limited coverage must be visible; do not claim full-cohort retention or precise creative LTV from a measured subset. Do not treat installs, accounts, MAU and acquired users as interchangeable denominators.

## Launch, spend and stop/go gates

Development continues with local/emulated/provider-fake dependencies, generated data and self-owned test media. Public activation requires the exact binary, catalog, environment and configuration to pass P6-T05A / Public Release Readiness. D-029 never defers financial-integrity, entitlement, private-data, destructive-migration or production-activation protections.

- [x] Founder approves the narrow launch and business experiment, ads plus coins, minimum acquisition/economics measurement, and catalog/licensing direction (2026-09-07).
- [ ] Founder defines one target audience (D-035), approves rating/content direction (D-003), and confirms candidate titles privately.
- [ ] Founder approves D-017: total test budget/cap, period, campaign allocation, business guardrails, attribution sufficiency criteria, stop/go date and owners before any spend. No budget or universal LTV:CAC threshold is invented here.
- [ ] Founder/legal approves D-008 pack sizes, prices, episode coin costs, consumer terms and refund/chargeback treatment before commercial product configuration; generic implementation may use synthetic configurable products.
- [ ] French entity, legal name/form, incorporation, registered address, required registration/organization data, Google Play payments/bank EUR settlement and AdMob production setup are approved/verified (D-022/D-024/D-025). Apple banking remains an iOS gate.
- [ ] Each title and each acquisition creative passes private rights/provenance, free/ad/coin/promotion, media, age/content and protection review (D-019/D-031).
- [ ] France-specific legal/privacy/consumer/store review, public notices/contact, consent, D-020 residency/retention/deletion, Google Data safety and support are approved for the actual new data flows and binary.
- [ ] Real Android purchase/refund/reconciliation and genuine AdMob SSV → entitlement → playback tests pass; #98 remains a release blocker for the ad path.
- [ ] Attribution and finance joins reconcile a controlled cohort before paid acquisition; minimum reporting and cost controls operate. D-018 remains conditional on MMP need.

Pause spend when attribution/revenue reconciliation cannot support the approved decision or a predeclared budget/business guardrail is crossed. Stop affected rollout for unauthorized media, financial or entitlement mismatch, material security/privacy failure or unsafe activation. Paid acquisition is part of MVP validation, but this strategy update itself authorizes no spend or production enablement.

P0-T01 remains open for Public Release Readiness. D-009 subscription terms do not block this Android coin MVP.

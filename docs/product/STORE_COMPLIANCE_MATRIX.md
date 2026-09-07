# Store, Advertising, and Privacy Compliance Matrix

**Plan task:** P0-T03  
**Status:** Public-release engineering baseline; does not block Phase 1 and requires legal/store review before beta and every submission. **MVP includes rewarded ads and Google Play coins** (D-007/D-008/D-015, 2026-09-07). Apple/iOS commerce and subscriptions remain post-MVP. These scope changes do not approve legal terms, prices, processing or release.

This document is an implementation checklist, not legal advice. Policies and regional programs change. Recheck primary sources at release time.

## Mobile commerce

Google Play consumable coin purchases, lifecycle/refunds, server ledger/unlock and persistent-balance reconciliation are **MVP requirements**. Subscriptions and Apple/IAP-specific setup/validation remain **P7**.

| Area | Conservative implementation rule | Evidence/validation | Timing |
|---|---|---|---|
| Digital subscriptions | Store billing through RevenueCat for separately approved subscriptions. | Renewal, grace, expiry, cancel, refund, restore and second-device tests. | Post-MVP |
| Coin packs | Google Play consumables through RevenueCat; backend maps known product/environment ID to approved coin amount. D-008 prices/sizes remain open. | Verified purchase, duplicate/reordered callback and fulfillment tests; at most one credit per transaction. | MVP |
| Coin terms | Non-expiring/non-transferable/no-cash-value terms remain the earlier D-008 proposal pending founder/legal confirmation. Do not invent final terms. | Owner-approved terms/UI and refund/chargeback review before commercial products. | MVP approval required |
| Episode unlock (coins) | Server verifies current rights/method/price and atomically debits plus grants entitlement. | Concurrency, idempotency, rollback, insufficient balance, price/takedown race and cross-account tests. | MVP |
| Balance recovery/sync | Reinstall/second Android device reloads server balance/entitlements and reconciles known transactions; consumed purchases never re-credit. | Google license-tester interrupted purchase and second-device/reinstall reconciliation. Subscription/Apple restore later. | MVP coin sync; subscription/Apple restore P7 |
| Price display | Exact Google Play storefront-provided currency/price strings; no language-derived money. | Android native purchase-sheet comparison; synthetic alternate currency strings test capability without expanding launch. | MVP |
| Developer settlement | EUR reporting/desired payout; verify eligible Google payments profile/bank, fees, tax/refunds and actual reconciliation. Apple banking is later. | Private finance approval of entity/account/currency/setup and test-to-production reconciliation procedure. | Before MVP commercial IAP; Apple P7 |
| Subscription disclosure | Price, renewal/trial, period, benefits, terms, cancel/manage and restore. | Independent review of subscription submission package. | P7 |
| External checkout | No direct credit-card checkout in MVP. Any later link/program needs separate current regional/legal approval. | Exact-binary review. | MVP prohibition; later decision |
| Refund/chargeback | Verified provider lifecycle plus auditable compensating ledger entries and approved D-008 handling, including already-spent coins; quarantine unresolved ownership/policy cases. | Reordered/replayed adjustments, refund after spend, financial/entitlement reconciliation and restricted support controls. | MVP |

Primary references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple storefront pricing: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple banking and proceeds: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/ and https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play local currencies and payouts: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google Play merchant bank requirements: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en
- RevenueCat Expo integration: https://www.revenuecat.com/docs/getting-started/installation/expo

## Rewarded advertising

One of the two MVP monetization paths (D-007); Google coin policy above is also required.

| Area | Implementation rule | Evidence/validation |
|---|---|---|
| Choice | Rewarded ads are opt-in, preferably between episodes, never interrupt playback; no interstitials or forced mid-episode ads in MVP. | UX review and device test. |
| Reward disclosure | State exactly what the user receives before the ad starts. | Screenshot/review checklist. |
| Grant authority | Production entitlement is granted from an authentic server-side verification callback bound to an unused server intent. | Forgery, replay, mismatch, expiry, and duplicate tests. |
| Non-production | Use only provider test ad units outside production. | Environment assertion and release check. |
| Availability | If no ad is available, show a recoverable state; do not promise a reward. Show a coin alternative only when currently configured, rights-permitted and enabled; never substitute an unauthorized method. | Offline/no-fill integration test. |
| Privacy/consent | Gate personalized advertising and SDK initialization according to market consent requirements. | Consent-mode/network inspection. |
| Invalid traffic | Do not ask users to click ads or automate impressions. Add anomaly monitoring and provider-policy runbook. | Abuse review and alert exercise. |

Primary reference: https://developers.google.com/admob/android/rewarded

MVP ships Android / Google Play only (D-027). iOS AdMob remains relevant for a later iOS storefront, not this launch.

## Authentication and account rules

- Android MVP (D-027/D-030): retain Firebase email/password and Google Sign-In.
- If a third-party/social login is offered on a later iOS storefront, include Sign in with Apple where required by current Apple rules.
- Never use phone/SMS auth in MVP without a cost, abuse, and privacy decision.
- Allow anonymous browsing/free playback, but require authentication before permanent entitlements (rewarded-ad/coin unlocks and coin purchases in MVP).
- Provide in-app account deletion and a support/privacy path accessible without purchase.
- Reauthentication is required for destructive account actions.

## Privacy and data protection baseline

The MVP app interface and independently approved self-owned or licensed microdrama catalog are in English. Decision D-001 limits active MVP distribution to France through Google Play. Complete the France-specific consumer, tax, age-rating, accessibility, privacy, advertising, rights, and language review for the exact binary and catalog. Additional rollout requires a later explicit decision and review. D-034 retains generalized country/storefront/language/segment and currency capability; active launch configuration never permits client eligibility overrides.

- Maintain a data inventory: field/event, purpose, lawful basis/consent, processor, region, retention, access roles, deletion behavior. Engineering inventory: [`SDK_DATA_INVENTORY.md`](SDK_DATA_INVENTORY.md) (P0-T03 remaining engineering slice; not a P0-T03 completion record).
- Minimize identifiers and avoid email, tokens, receipts, signed media URLs, exact IP, or contract references in analytics.
- Separate authentication identity, operational logs, analytics identifiers, and financial audit records.
- Provide clear privacy notice, terms, support contact, consent choices, and account deletion.
- Propagate deletion/opt-out to processors where required and record completion.
- Retain pseudonymous financial records only for documented legal/accounting/fraud needs.
- Gate advertising/attribution SDKs and tracking permissions by current platform and market requirements.
- Complete data-processing agreements, international-transfer assessment, and breach/incident procedure before production.

## Acquisition and licensed-content review

- [ ] D-017 founder-approved capped test budget, duration and business guardrails before paid spend; D-035 selects one target audience.
- [ ] Every MVP licensed title permits free episodes, rewarded ads, coin transactional access and paid acquisition using approved clips/trailers/posters/stills/likenesses in France/Google Play/English. Rights window/takedown/reporting/exclusivity/protection remain private per-title gates (D-031).
- [ ] Minimal attribution/spend/outcome joins are reliable enough for the test, consent-aware and covered by D-020. MMP remains conditional D-018; ad-network SDKs/pixels are not implied by campaign approval.
- [ ] RevenueCat/ledger, verified refund records, warehouse exports and private spend/cost imports are inventoried with least privilege and approved retention/deletion; client Analytics is never financial authority.

## Store listing and review package

- [ ] App description/screenshots disclose configured free, rewarded-ad, coin-only or combined choices accurately, including purchase/unlock terms. Subscription disclosures remain P7.
- [ ] Google coin IAP metadata, prices and approved D-008 terms match products/UI (**MVP**); subscriptions remain P7.
- [ ] Age rating and content warnings match the most restrictive launch content.
- [ ] Google Data safety declarations match the Android binary, SDKs, network behavior and exports; Apple privacy labels remain post-MVP.
- [ ] Privacy policy, terms, support, and deletion URLs are live.
- [ ] Actual public operator identity and monitored privacy-contact email are established, with completed notice/UMP setup and genuine rewarded-ad release evidence in #98. D-028 defers these from P3-T07/PR #97 to release readiness; required setup still precedes publisher-owned ad testing.
- [ ] Reviewer receives a test account and deterministic instructions for free/locked, ad-only/coin-only/both, Google purchase/pending/cancel/refund, persistent-balance sync and deletion flows. Apple/subscription restore remains P7.
- [ ] Review notes explain why rewarded ads are optional and how rewards are verified.
- [ ] Screenshots and review media use only approved series and assets covered by their private provenance or licensed promotional-use grant.

## Required approvals before P0-T03 completion and commercial MVP

- [x] France/Google Play active launch and ads-plus-coins scope are founder-approved (updated 2026-09-07).
- [ ] Legal/privacy owner reviews the exact France/Google Play binary and new RevenueCat/attribution/warehouse data flows; D-020 residency/retention/deletion remains open.
- [ ] Content owner approves rating/content direction and per-title free/ad/coin/paid-promotional rights.
- [ ] Founder/legal approves D-008 final coin terms/prices/sizes and refund-after-spend treatment.
- [ ] Finance approves AdMob plus Google IAP merchant/tax/refund/recognition and EUR-compatible settlement with actual entity/profile/bank configuration.
- [x] Engineering SDK inventory exists; scope labels updated 2026-09-07. Publication is not processing approval or a matching-binary declaration.
- [ ] Independent Google Play tester purchase/refund/reconciliation and genuine AdMob/provider evidence pass before commercial release, alongside updated review package and P6-T05A.

P0-T03 remains incomplete. D-017 budget/business guardrails and D-035 audience are required before paid acquisition; no ad spend, processor activation or real purchase is authorized here. Subscription terms, Apple banking/labels and iOS test paths remain post-MVP.

# Store, Advertising, and Privacy Compliance Matrix

**Plan task:** P0-T03  
**Status:** Public-release engineering baseline; does not block Phase 1 and requires legal/store review before beta and every submission. **MVP is ads-only** (D-007, 2026-08-27). IAP/subscription/coin rows remain required before P7; they are not MVP engineering.

This document is an implementation checklist, not legal advice. Policies and regional programs change. Recheck primary sources at release time.

## Mobile commerce

IAP, subscriptions, and coins are **P7 engineering**. Rewarded ads remain MVP.

| Area | Conservative implementation rule | Evidence/validation | Timing |
|---|---|---|---|
| Digital subscriptions | Use Apple In-App Purchase and Google Play Billing through RevenueCat in mobile apps. | Sandbox purchase, renewal, grace, expiry, refund, cancel, restore, and second-device tests. | P7 |
| Coin packs | Treat as consumable in-app products. Backend maps verified product ID to a fixed coin amount. | Duplicate/out-of-order webhook tests; one store transaction creates at most one ledger credit. | P7 |
| Coin lifecycle | Purchased coins do not expire, transfer, cash out, or operate outside this product. | Terms/UI review and ledger reconciliation. | P7 |
| Episode unlock (coins) | Debit and entitlement grant occur atomically on the server. | Concurrency, idempotency, insufficient-balance, and price-race tests. | P7 |
| Restore/sync | Restore restorable purchases and resynchronize subscription state; server balance persists after reinstall/login. | Apple sandbox and Google license-tester device matrix. | P7 |
| Price display | Render the store-provided localized price and period for the active storefront; do not infer currency from app language or construct monetary strings manually. | Compare UI with the native store purchase sheet using test accounts in at least two currencies on each platform. | P7 |
| Developer settlement | Use EUR as the finance reporting currency and desired payout currency. Configure a EUR-denominated bank account in App Store Connect and a EUR-compatible Google payments profile/bank account where the registered entity is eligible. | Finance records account country, legal entity, payments-profile currency, bank currency, verification evidence, fees, and first sandbox/production reconciliation. | Before P7 IAP / public commercial IAP |
| Subscription disclosure | Show price, billing period, renewal, trial/intro terms, benefits, privacy, terms, cancel/manage, and restore before purchase. | Independent review using store submission package. | P7 |
| External checkout links | Do not include by default. Add only after a current storefront/region-specific policy and legal review. | Storefront matrix and review notes. | P7 |
| Refund/chargeback | Provider lifecycle changes server state; purchased-coin correction policy uses auditable compensating entries. | Replayed provider fixtures and support runbook. | P7 |

Primary references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple storefront pricing: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple banking and proceeds: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/ and https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play local currencies and payouts: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google Play merchant bank requirements: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en
- RevenueCat Expo integration: https://www.revenuecat.com/docs/getting-started/installation/expo

## Rewarded advertising

MVP monetization path (D-007). IAP matrix above remains required before P7.

| Area | Implementation rule | Evidence/validation |
|---|---|---|
| Choice | Rewarded ads are opt-in and never interrupt an episode. | UX review and device test. |
| Reward disclosure | State exactly what the user receives before the ad starts. | Screenshot/review checklist. |
| Grant authority | Production entitlement is granted from an authentic server-side verification callback bound to an unused server intent. | Forgery, replay, mismatch, expiry, and duplicate tests. |
| Non-production | Use only provider test ad units outside production. | Environment assertion and release check. |
| Availability | If no ad is available, show a recoverable state; do not promise a reward. Other unlock methods wait for P7. | Offline/no-fill integration test. |
| Privacy/consent | Gate personalized advertising and SDK initialization according to market consent requirements. | Consent-mode/network inspection. |
| Invalid traffic | Do not ask users to click ads or automate impressions. Add anomaly monitoring and provider-policy runbook. | Abuse review and alert exercise. |

Primary reference: https://developers.google.com/admob/ios/rewarded

## Authentication and account rules

- Offer email/password plus Apple and Google where configured.
- If a third-party/social login is offered on iOS, include Sign in with Apple where required by current Apple rules.
- Never use phone/SMS auth in MVP without a cost, abuse, and privacy decision.
- Allow anonymous browsing/free playback, but require authentication before permanent entitlements (rewarded-ad unlock in MVP; purchases in P7).
- Provide in-app account deletion and a support/privacy path accessible without purchase.
- Reauthentication is required for destructive account actions.

## Privacy and data protection baseline

The MVP app interface and initial microdrama catalog are in English. The intended legal-entity country is France, and decision D-001 defines the founder-approved scope of 21 EU countries using EUR. Language and common currency do not remove national consumer, tax, age-rating, accessibility, or language obligations. The final law set follows the incorporated legal entity, enabled distribution countries, users, data flows, and providers. Implement a GDPR-ready baseline now, then add and approve each storefront's jurisdiction-specific requirements before enabling distribution there.

- Maintain a data inventory: field/event, purpose, lawful basis/consent, processor, region, retention, access roles, deletion behavior. Engineering inventory: [`SDK_DATA_INVENTORY.md`](SDK_DATA_INVENTORY.md) (P0-T03 remaining engineering slice; not a P0-T03 completion record).
- Minimize identifiers and avoid email, tokens, receipts, signed media URLs, exact IP, or contract references in analytics.
- Separate authentication identity, operational logs, analytics identifiers, and financial audit records.
- Provide clear privacy notice, terms, support contact, consent choices, and account deletion.
- Propagate deletion/opt-out to processors where required and record completion.
- Retain pseudonymous financial records only for documented legal/accounting/fraud needs.
- Gate advertising/attribution SDKs and tracking permissions by current platform and market requirements.
- Complete data-processing agreements, international-transfer assessment, and breach/incident procedure before production.

## Store listing and review package

- [ ] App description and screenshots disclose that some content requires a rewarded ad. Coin or subscription disclosure is required before P7 IAP, not for ads-only MVP.
- [ ] IAP/subscription metadata matches the products and UI (**P7**).
- [ ] Age rating and content warnings match the most restrictive launch content.
- [ ] Apple privacy labels and Google Data safety declarations match the binary, SDKs, and network behavior.
- [ ] Privacy policy, terms, support, and deletion URLs are live.
- [ ] Reviewer receives a test account and deterministic instructions for free, locked, rewarded-ad, and deletion flows. Coin, subscription, and restore instructions wait for P7.
- [ ] Review notes explain why rewarded ads are optional and how rewards are verified.
- [ ] No licensed production content is used in screenshots or review media without promotional rights.

## Required approvals before P0-T03 completion (ads-only MVP)

Store IAP EUR settlement, IAP merchant, and store-billing refund treatment are **not** P0-T03 closers. They are required before P7 IAP, not before ads-only launch.

- [x] Distribution countries/storefront scope is founder-approved; per-market rights and legal/language launch gates remain open.
- [ ] Legal/privacy owner reviews the relevant jurisdiction row set.
- [ ] Content rating owner approves provisional rating method.
- [ ] Finance/tax owner approves **AdMob/ads-only** merchant, tax, and revenue-recognition treatment. Store IAP/refund/EUR-settlement treatment waits for P7.
- [x] Engineering published [`SDK_DATA_INVENTORY.md`](SDK_DATA_INVENTORY.md) (2026-08-25; timing labels updated 2026-08-27). This checks the engineering inventory box only: the inventory exists and is labeled current-on-main / in-flight snapshot / planned MVP / planned P7. **P0-T03 is still incomplete** — legal/privacy jurisdiction review, content rating, and ads-only finance/tax treatment remain open. Store IAP EUR settlement is required before P7 IAP, not before this ads-only slice. Apple privacy labels and Google Data safety declarations are not confirmed until those reviews and a matching binary exist.

## Required before P7 IAP (not ads-only launch)

- [ ] Finance confirms that the registered store accounts and bank configuration can settle IAP proceeds in EUR.
- [ ] Finance/tax owner approves IAP merchant, tax, refund, and revenue-recognition treatment.

# Store, Advertising, and Privacy Compliance Matrix

**Plan task:** P0-T03  
**Status:** Engineering baseline; requires legal/store review before beta and every submission

This document is an implementation checklist, not legal advice. Policies and regional programs change. Recheck primary sources at release time.

## Mobile commerce

| Area | Conservative implementation rule | Evidence/validation |
|---|---|---|
| Digital subscriptions | Use Apple In-App Purchase and Google Play Billing through RevenueCat in mobile apps. | Sandbox purchase, renewal, grace, expiry, refund, cancel, restore, and second-device tests. |
| Coin packs | Treat as consumable in-app products. Backend maps verified product ID to a fixed coin amount. | Duplicate/out-of-order webhook tests; one store transaction creates at most one ledger credit. |
| Coin lifecycle | Purchased coins do not expire, transfer, cash out, or operate outside this product. | Terms/UI review and ledger reconciliation. |
| Episode unlock | Debit and entitlement grant occur atomically on the server. | Concurrency, idempotency, insufficient-balance, and price-race tests. |
| Restore/sync | Restore restorable purchases and resynchronize subscription state; server balance persists after reinstall/login. | Apple sandbox and Google license-tester device matrix. |
| Price display | Render the store-provided localized price and period for the active storefront; do not infer currency from app language or construct monetary strings manually. | Compare UI with the native store purchase sheet using test accounts in at least two currencies on each platform. |
| Developer settlement | Use EUR as the finance reporting currency and desired payout currency. Configure a EUR-denominated bank account in App Store Connect and a EUR-compatible Google payments profile/bank account where the registered entity is eligible. | Finance records account country, legal entity, payments-profile currency, bank currency, verification evidence, fees, and first sandbox/production reconciliation. |
| Subscription disclosure | Show price, billing period, renewal, trial/intro terms, benefits, privacy, terms, cancel/manage, and restore before purchase. | Independent review using store submission package. |
| External checkout links | Do not include by default. Add only after a current storefront/region-specific policy and legal review. | Storefront matrix and review notes. |
| Refund/chargeback | Provider lifecycle changes server state; purchased-coin correction policy uses auditable compensating entries. | Replayed provider fixtures and support runbook. |

Primary references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple storefront pricing: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple banking and proceeds: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/ and https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play local currencies and payouts: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en
- Google Play merchant bank requirements: https://support.google.com/googleplay/android-developer/answer/7161440?hl=en
- RevenueCat Expo integration: https://www.revenuecat.com/docs/getting-started/installation/expo

## Rewarded advertising

| Area | Implementation rule | Evidence/validation |
|---|---|---|
| Choice | Rewarded ads are opt-in and never interrupt an episode. | UX review and device test. |
| Reward disclosure | State exactly what the user receives before the ad starts. | Screenshot/review checklist. |
| Grant authority | Production entitlement is granted from an authentic server-side verification callback bound to an unused server intent. | Forgery, replay, mismatch, expiry, and duplicate tests. |
| Non-production | Use only provider test ad units outside production. | Environment assertion and release check. |
| Availability | If no ad is available, show a recoverable state and other authorized offers; do not promise a reward. | Offline/no-fill integration test. |
| Privacy/consent | Gate personalized advertising and SDK initialization according to market consent requirements. | Consent-mode/network inspection. |
| Invalid traffic | Do not ask users to click ads or automate impressions. Add anomaly monitoring and provider-policy runbook. | Abuse review and alert exercise. |

Primary reference: https://developers.google.com/admob/ios/rewarded

## Authentication and account rules

- Offer email/password plus Apple and Google where configured.
- If a third-party/social login is offered on iOS, include Sign in with Apple where required by current Apple rules.
- Never use phone/SMS auth in MVP without a cost, abuse, and privacy decision.
- Allow anonymous browsing/free playback, but require authentication before permanent entitlements or purchases.
- Provide in-app account deletion and a support/privacy path accessible without purchase.
- Reauthentication is required for destructive account actions.

## Privacy and data protection baseline

The app interface is English, but language and payout currency do not determine legal jurisdiction. The final law set follows the company's legal entity, distribution countries, users, data flows, and providers. Implement a GDPR-ready baseline now, then add and approve each storefront's jurisdiction-specific requirements before enabling distribution there.

- Maintain a data inventory: field/event, purpose, lawful basis/consent, processor, region, retention, access roles, deletion behavior.
- Minimize identifiers and avoid email, tokens, receipts, signed media URLs, exact IP, or contract references in analytics.
- Separate authentication identity, operational logs, analytics identifiers, and financial audit records.
- Provide clear privacy notice, terms, support contact, consent choices, and account deletion.
- Propagate deletion/opt-out to processors where required and record completion.
- Retain pseudonymous financial records only for documented legal/accounting/fraud needs.
- Gate advertising/attribution SDKs and tracking permissions by current platform and market requirements.
- Complete data-processing agreements, international-transfer assessment, and breach/incident procedure before production.

## Store listing and review package

- [ ] App description and screenshots disclose that some content requires ads, coins, or subscription.
- [ ] IAP/subscription metadata matches the products and UI.
- [ ] Age rating and content warnings match the most restrictive launch content.
- [ ] Apple privacy labels and Google Data safety declarations match the binary, SDKs, and network behavior.
- [ ] Privacy policy, terms, support, and deletion URLs are live.
- [ ] Reviewer receives a test account and deterministic instructions for free, locked, ad, coin, subscription, restore, and deletion flows.
- [ ] Review notes explain why rewarded ads are optional and how rewards are verified.
- [ ] No licensed production content is used in screenshots or review media without promotional rights.

## Required approvals before P0-T03 completion

- [ ] Distribution countries/storefronts are approved.
- [ ] Finance confirms that the registered store accounts and bank configuration can settle proceeds in EUR.
- [ ] Legal/privacy owner reviews the relevant jurisdiction row set.
- [ ] Content rating owner approves provisional rating method.
- [ ] Finance/tax owner approves merchant, tax, refund, and revenue-recognition treatment.
- [ ] Engineering confirms all declarations match the planned SDK/data inventory.

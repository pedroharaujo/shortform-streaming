# Product and Technical Decision Register

This register distinguishes working assumptions from approved decisions. An implementation agent must not silently convert a proposal into an approval.

- **Required for architecture/coding:** the relevant entry must be approved before implementing behavior that depends on it. Already accepted technical baselines allow Phase 1 repository and backend bootstrap to start.
- **Required before public release:** the entry may remain deferred during local/staging and isolated production-candidate validation, but public production activation/traffic promotion, storefront distribution, real monetization, advertising, or licensed-media publication must remain disabled until it is approved and verified.

| ID | Decision | Proposed value | Status | Owner | Required by |
|---|---|---|---|---|---|
| D-001 | Distribution countries/storefronts | The 21 EU Member States using EUR in 2026: Austria, Belgium, Bulgaria, Croatia, Cyprus, Estonia, Finland, France, Germany, Greece, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Portugal, Slovakia, Slovenia, and Spain | Founder scope approved 2026-08-23; each market remains gated by territorial rights and local legal/language review | Founder + legal/growth | P0-T01 completion and store launch |
| D-002 | Product interface language | English (`en`) | Approved 2026-08-23 | Founder | Now |
| D-003 | Provisional age direction | 16+ | Proposed; catalog-dependent | Founder + content/legal | Store submission |
| D-004 | Initial catalog | 1 licensed (or self-owned/generated test) series at launch; the catalog data model still supports N series | Founder approved 2026-08-27. Expansion after ads-only unit-economics validation. | Founder + content | Content ingestion |
| D-005 | Guest boundary | Browse/watch free episodes anonymously; login required before monetized unlock (rewarded ad) | Founder approved 2026-08-27 | Founder | Auth UX implementation |
| D-006 | Initial free window | First five episodes, hardcoded / admin-configured (not Remote Config / experiment cohorts in MVP) | Founder approved 2026-08-27; experimentable in P7 | Founder/product | Offer configuration |
| D-007 | Reward model | One verified rewarded ad permanently unlocks one episode. This is the only MVP monetization path. | Founder approved 2026-08-27 | Founder/product | Ad implementation |
| D-008 | Coin policy | Store-purchased, non-expiring, non-transferable, no cash value | Proposed; deferred 2026-08-27 (not MVP) | Founder + legal | P7 IAP |
| D-009 | Subscription benefit | Eligible catalog access while active | Proposed; deferred 2026-08-27 (not MVP) | Founder/product | P7 IAP |
| D-010 | Repository visibility | Public | Accepted by current repository state | Founder | Now |
| D-011 | Backend architecture | Django/DRF modular monolith | Accepted in implementation plan | Engineering | Bootstrap |
| D-012 | Database path | Supabase PostgreSQL for development/early staging; paid production database | Accepted in implementation plan | Engineering | Environment provisioning |
| D-013 | Mobile platform services | Firebase Auth/Analytics/Remote Config/Crashlytics/FCM/App Check | Accepted in implementation plan | Engineering | Mobile bootstrap |
| D-014 | Video path | Bunny Stream HLS + short-lived token access as default; GCP Cloud Storage → Transcoder → signed Cloud CDN as documented fallback | Accepted default 2026-08-24; P2-T05 on-device proof is Android under D-026 (Bunny still must be proven on a real Android development build; iOS play is deferred to the iOS ship pass); activate GCP Cloud CDN only if Bunny fails that spike, a license/residency/support constraint forbids it, or measured cost/reliability is worse; D-019 DRM may still require a DRM-capable provider | Engineering + content/legal | P2-T05 Android on-device outcome under D-026 before production video-provider configuration; D-019 before licensed-media ingestion |
| D-015 | Mobile commerce | Apple/Google store billing through RevenueCat; Django ledger. MVP implementation deferred to P7; MVP commerce is AdMob only. | Accepted architecture; MVP deferred 2026-08-27 | Engineering + legal | P7 |
| D-016 | Analytics/experiments | Accepted architecture: Firebase Analytics typed events (MVP); BigQuery export, Looker Studio models, and Remote Config A/B wait for P7 | Accepted architecture with MVP/P7 split 2026-08-27 | Product + engineering | MVP events now; warehouse/experiments P7 |
| D-017 | Acquisition validation budget | TBD | Decision required | Founder | Before paid acquisition |
| D-018 | MMP adoption threshold | TBD based on spend and attribution ambiguity | Decision required | Founder + growth | P4-T07 |
| D-019 | DRM requirement | No custom DRM unless contract requires it | Pending first license package; does not block local fixtures or self-owned/generated test media | Content/legal | Before licensed-media ingestion or production video-provider selection/configuration |
| D-020 | Data residency/retention | Follow approved distribution countries and provider constraints | Decision required | Legal + engineering | Before public production activation |
| D-021 | Customer billing currency | Storefront-localized currency and store-provided price strings | Approved 2026-08-23 | Founder | Mobile commerce implementation |
| D-022 | Company reporting and desired settlement currency | EUR; validate Apple bank-account currency and Google payments-profile/bank eligibility | Business target approved 2026-08-23; financial setup deferred. Store IAP EUR settlement required before P7 IAP, not before ads-only launch. | Founder + finance | Ads-only: entity/AdMob production. Store IAP EUR settlement: P7 |
| D-023 | Initial catalog language | English-language microdramas | Approved 2026-08-23; rights and content feasibility remain pending | Founder | Content licensing and ingestion |
| D-024 | Intended legal-entity country | France | Founder direction approved 2026-08-23; incorporation and legal/finance validation deferred | Founder + legal/finance | Required before public release |
| D-025 | Company and store-account registration details | Legal name and form, incorporation, registered address, D-U-N-S where required, organizational enrollment data, and payout/bank details | Deferred to Public Release Readiness; not required for MVP coding (D-028) | Founder + legal/finance | Required before public release, production accounts, or real commerce |
| D-026 | Device validation sequence | Implement both platforms in the architecture; required on-device/manual observation is Android until Android ship-ready; iOS device observation is required before iOS public storefront / TestFlight-quality pass, not for each implementation PR | Approved 2026-08-26; ads-only public storefront sequenced by D-027 | Founder | P2-T05 close-out; later P2-T08/store/IAP/push iOS pass |
| D-027 | Ads-only MVP launch storefront | Google Play / Android only. iOS remains in the rights and API model (`X-Platform`, ContentRight) but is not an ads-only MVP ship target. Sign in with Apple (P2-T01-F3 / #89) is deferred to the iOS TestFlight-quality / P7 pass, not waived. | Founder approved 2026-08-30 | Founder | Ads-only MVP launch; unblocks planned Android implementation past #89 |
| D-028 | P3-T07 development versus release acceptance | Accept the tested, disabled-by-default reward implementation for development/PR #97 and subsequent MVP coding. Defer actual public operator identity, privacy-contact email, final notice/UMP setup and genuine test-ad → Google SSV → entitlement → Android playback evidence to P6-T04/P6-T05A / #98. #96 is superseded, not evidence of a successful provider journey. | Founder approved 2026-08-31; no runtime safeguard or production/legal approval changed | Founder + engineering | Required setup still precedes publisher-owned ad testing; #98 blocks public/production activation and release, not development completion or merge |

## Decision protocol

1. Record a proposed value and its owner.
2. Document evidence, alternatives, and irreversible consequences in the relevant brief or ADR.
3. The named human owner changes `Status` to `Approved`, `Rejected`, or `Superseded` and records the date.
4. Implementation may use a proposal only behind reversible configuration and must not publish production behavior that depends on an unapproved legal, rights, financial, or market decision.

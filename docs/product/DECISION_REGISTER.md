# Product and Technical Decision Register

This register distinguishes working assumptions from approved decisions. An implementation agent must not silently convert a proposal into an approval.

- **Required for architecture/coding:** the relevant entry must be approved before implementing behavior that depends on it. Already accepted technical baselines allow Phase 1 repository and backend bootstrap to start.
- **Required before public release:** the entry may remain deferred during local/staging and isolated production-candidate validation, but public production activation/traffic promotion, storefront distribution, real monetization, advertising, or licensed-media publication must remain disabled until it is approved and verified.

| ID | Decision | Proposed value | Status | Owner | Required by |
|---|---|---|---|---|---|
| D-001 | Distribution countries/storefronts | The 21 EU Member States using EUR in 2026: Austria, Belgium, Bulgaria, Croatia, Cyprus, Estonia, Finland, France, Germany, Greece, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Portugal, Slovakia, Slovenia, and Spain | Founder scope approved 2026-08-23; each market remains gated by territorial rights and local legal/language review | Founder + legal/growth | P0-T01 completion and store launch |
| D-002 | Product interface language | English (`en`) | Approved 2026-08-23 | Founder | Now |
| D-003 | Provisional age direction | 16+ | Proposed; catalog-dependent | Founder + content/legal | Store submission |
| D-004 | Initial catalog | 5–10 non-exclusive licensed series | Proposed | Founder + content | Content ingestion |
| D-005 | Guest boundary | Browse/watch free episodes anonymously; login before monetized unlock | Proposed | Founder | Auth UX implementation |
| D-006 | Initial free window | First five episodes | Proposed, experimentable | Founder/product | Offer configuration |
| D-007 | Reward model | One verified ad permanently unlocks one episode | Proposed | Founder/product | Ad implementation |
| D-008 | Coin policy | Store-purchased, non-expiring, non-transferable, no cash value | Proposed; policy review required | Founder + legal | IAP configuration |
| D-009 | Subscription benefit | Eligible catalog access while active | Proposed | Founder/product | IAP configuration |
| D-010 | Repository visibility | Public | Accepted by current repository state | Founder | Now |
| D-011 | Backend architecture | Django/DRF modular monolith | Accepted in implementation plan | Engineering | Bootstrap |
| D-012 | Database path | Supabase PostgreSQL for development/early staging; paid production database | Accepted in implementation plan | Engineering | Environment provisioning |
| D-013 | Mobile platform services | Firebase Auth/Analytics/Remote Config/Crashlytics/FCM/App Check | Accepted in implementation plan | Engineering | Mobile bootstrap |
| D-014 | Video path | Private GCS → Transcoder HLS → signed Cloud CDN access | Reversible hypothesis; P2-T05 must validate or supersede it, and later DRM rights may change the production choice | Engineering + content/legal | P2-T05 outcome before production video-provider selection/configuration |
| D-015 | Mobile commerce | Apple/Google store billing through RevenueCat; Django ledger | Accepted subject to current regional policy review | Engineering + legal | Monetization |
| D-016 | Analytics/experiments | Firebase → BigQuery → Looker Studio | Accepted in implementation plan | Product + engineering | Analytics phase |
| D-017 | Acquisition validation budget | TBD | Decision required | Founder | Before paid acquisition |
| D-018 | MMP adoption threshold | TBD based on spend and attribution ambiguity | Decision required | Founder + growth | P4-T07 |
| D-019 | DRM requirement | No custom DRM unless contract requires it | Pending first license package; does not block local fixtures or self-owned/generated test media | Content/legal | Before licensed-media ingestion or production video-provider selection/configuration |
| D-020 | Data residency/retention | Follow approved distribution countries and provider constraints | Decision required | Legal + engineering | Before public production activation |
| D-021 | Customer billing currency | Storefront-localized currency and store-provided price strings | Approved 2026-08-23 | Founder | Mobile commerce implementation |
| D-022 | Company reporting and desired settlement currency | EUR; validate Apple bank-account currency and Google payments-profile/bank eligibility | Business target approved 2026-08-23; financial setup deferred | Founder + finance | Required before public release and real commerce |
| D-023 | Initial catalog language | English-language microdramas | Approved 2026-08-23; rights and content feasibility remain pending | Founder | Content licensing and ingestion |
| D-024 | Intended legal-entity country | France | Founder direction approved 2026-08-23; incorporation and legal/finance validation deferred | Founder + legal/finance | Required before public release |
| D-025 | Company and store-account registration details | Legal name and form, incorporation, registered address, D-U-N-S where required, organizational enrollment data, and payout/bank details | Deferred to Public Release Readiness; not required for Phase 1 | Founder + legal/finance | Required before public release, production accounts, or real commerce |

## Decision protocol

1. Record a proposed value and its owner.
2. Document evidence, alternatives, and irreversible consequences in the relevant brief or ADR.
3. The named human owner changes `Status` to `Approved`, `Rejected`, or `Superseded` and records the date.
4. Implementation may use a proposal only behind reversible configuration and must not publish production behavior that depends on an unapproved legal, rights, financial, or market decision.

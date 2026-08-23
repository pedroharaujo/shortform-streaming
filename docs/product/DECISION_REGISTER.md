# Product and Technical Decision Register

This register distinguishes working assumptions from approved decisions. An implementation agent must not silently convert a proposal into an approval.

| ID | Decision | Proposed value | Status | Owner | Required by |
|---|---|---|---|---|---|
| D-001 | First launch market | Brazil | Proposed | Founder | P0-T01 completion |
| D-002 | Primary locale/currency | `pt-BR` / BRL | Proposed; follows D-001 | Founder | P0-T01 completion |
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
| D-014 | Video path | Private GCS → Transcoder HLS → signed Cloud CDN access | Conditional on proof-of-concept and DRM rights | Engineering + content/legal | P2-T05 |
| D-015 | Mobile commerce | Apple/Google store billing through RevenueCat; Django ledger | Accepted subject to current regional policy review | Engineering + legal | Monetization |
| D-016 | Analytics/experiments | Firebase → BigQuery → Looker Studio | Accepted in implementation plan | Product + engineering | Analytics phase |
| D-017 | Acquisition validation budget | TBD | Decision required | Founder | Before paid acquisition |
| D-018 | MMP adoption threshold | TBD based on spend and attribution ambiguity | Decision required | Founder + growth | P4-T07 |
| D-019 | DRM requirement | No custom DRM unless contract requires it | Pending first license package | Content/legal | Before media ingestion |
| D-020 | Data residency/retention | Follow launch market and provider constraints | Decision required | Legal + engineering | Production provisioning |

## Decision protocol

1. Record a proposed value and its owner.
2. Document evidence, alternatives, and irreversible consequences in the relevant brief or ADR.
3. The named human owner changes `Status` to `Approved`, `Rejected`, or `Superseded` and records the date.
4. Implementation may use a proposal only behind reversible configuration and must not publish production behavior that depends on an unapproved legal, rights, financial, or market decision.

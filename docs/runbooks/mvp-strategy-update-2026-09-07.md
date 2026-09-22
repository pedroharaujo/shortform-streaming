# MVP strategy documentation update — 2026-09-07

**Plan task:** P0-T01; related product foundations P0-T02/P0-T03/P0-T04.
**Scope:** Documentation and planning only. No application, schema, generated API, dependency, infrastructure or runtime configuration change. The founder separately authorized opening and merging a documentation PR after reviewing this update; publication and applicable CI evidence belong in that PR. No deployment, campaign, account setup or paid spend is authorized by this strategy update.

## Outcome

The source of truth now asks whether contribution LTV can exceed CAC. The planned MVP includes Android Google Play coins alongside opt-in AdMob rewards, minimum reliable acquisition attribution and cohort economics, approximately 3–5 independently cleared titles, and preferred €0 upfront/MG revenue-share/non-exclusive licensing where possible. Launch scope remains France, English, Android and one defined audience; generalized market/language/segment/license/currency capability remains a domain requirement.

Coin rights and paid promotional rights are mandatory for MVP licensed titles. Contracts, rates, suppliers, terms and licensed assets remain private. Unknown costs are parameters, not zero; revenue share remains a real cost. Existing fail-closed rights, server financial/entitlement authority and release safeguards remain in force.

## Decisions superseded or clarified

[The decision register](../product/DECISION_REGISTER.md) preserves prior values/statuses with explicit Superseded labels dated 2026-09-07.

- D-001/D-023/D-027: retain France/English/Android launch; remove exclusive-ad framing and permanent-domain implications.
- D-004: approximately 3–5 independently approved series replaces the earlier unspecified multi-series target.
- D-005/D-006/D-007: account boundary includes purchases/coin unlocks; editorial episode methods replace the hardcoded-only restriction; rewarded ads are one of two MVP monetization methods.
- D-008/D-015: Android coin direction and required commerce lifecycle move into MVP; commercial sizes/prices/final terms remain open. Apple/subscription work remains deferred.
- D-016: minimum warehouse, financial facts, spend joins and reporting move into MVP; advanced analytics/tools remain later.
- D-017/D-018: paid-test budget/guardrails are required before MVP spend; MMP remains conditional. Neither an amount nor an adoption threshold is approved.
- D-022: Google IAP finance/EUR settlement becomes an MVP commercial gate; Apple banking remains later.
- D-031: free/rewarded-ad/coin/paid-creative compatibility is mandatory per licensed title.
- New D-032 records the contribution LTV/CAC hypothesis; D-033 the preferred licensing strategy; D-034 platform capability versus launch configuration; D-035 the still-open exact target audience.

The 2026-08-27 product-loop hypothesis and affected August/early-September timing remain visible as history. D-009 subscriptions, Android-only launch, core architecture, private-record boundaries and D-028/D-029 release/integrity protections are retained.

## Work returned from post-MVP to MVP

See [the plan's traceability table](../../MICRODRAMA_IMPLEMENTATION_PLAN.md) for dependencies, acceptance and required tests.

| Task | MVP requirement | Scope retained later |
|---|---|---|
| P3-T02 | Immutable persistent wallet, atomic coin debit/episode grant | None of the required Android financial integrity |
| P3-T03 | Google Play coin products and RevenueCat setup | P3-T03-P7 Apple/subscription products |
| P3-T04 | Verified Android coin purchase/webhook/refund lifecycle | P3-T04-P7 subscription state and reconciliation |
| P3-T06 | Android coin-pack fulfillment and balance recovery | Apple fulfillment with iOS |
| P3-T09 | Purchase/ledger/refund/reward reconciliation and support | Subscription-specific work with P3-T04-P7/P3-T05 |
| P4-T02 | Minimum Firebase-to-BigQuery, verified finance/spend/content/infra joins and SQL models | P4-T02-P7 expanded exports/experiments |
| P4-T03 | Daily economics report and required data-quality checks | P4-T03-P7 Looker/advanced dashboards |
| P4-T06 | Minimum reliable acquisition source/campaign/creative cohort attribution | P4-T06-P7 advanced deferred links unless demonstrably necessary for the first test |

New follow-ups P2-T03-F3, P3-T01-F1 and P3-T08-F2 cover active launch configuration/generalized rights, editorial episode methods and coin/both offer UI. P4-T01-F5 adds/restores the required commerce, exposure/selection and acquisition measurement. P4-T07 MMP remains conditional on D-018. Subscriptions, iOS, consumer web, recommendation ML, automated royalty accounting, Remote Config experiments and push remain post-MVP.

## Decisions and external gates still open

- Founder: select one exact target audience (D-035); approve D-008 coin packs/prices, episode costs, final consumer terms and refund-after-spend policy; approve D-017 test cap, duration, business/attribution guardrails, allocation and review owners/date before any spend. No universal LTV:CAC threshold is invented.
- Content/legal/finance: actual candidate titles and private terms/provenance/rights, paid creatives, rating (D-003), protection requirements per title (D-019/D-031), France policy review and Google coin/AdMob tax/refund/revenue recognition/EUR settlement.
- Provider/release: French entity/Google organization/merchant/AdMob configuration (D-024/D-025), public notices/contact/UMP and genuine #98 evidence, Android purchase/refund/reconciliation tests, D-020 data residency/retention/deletion and exact-binary store disclosures.
- Engineering: implement and validate the newly planned P2/P3/P4 scope, including consent-limited acquisition denominators and cohort joins. Missing financial, entitlement, private-data or activation checks are never eligible D-029 deferrals.
- Conditional/later: D-018 MMP threshold/adoption when justified; D-009 subscription benefit/terms and all Apple/iOS commerce approvals stay post-MVP.

Recommended next engineering action: start **P2-T03-F3**, making launch settings configurable while preserving territory/language/segment and licensed monetization dimensions. It unlocks safe episode-policy and coin work without waiting for unapproved real commercial values; use synthetic fixtures only.

## Contradictions found and disposition

- Authoritative exclusive-ad/P7-coin/P7-acquisition claims were replaced in README, product documents, plan, ADRs, compliance and SDK inventory. No known unresolved contradiction remains between those current requirements.
- Current runtime still implements the old fixed launch context and free/rewarded-ad policy, with no new coins, attribution or warehouse functionality supplied here. This expected documentation-to-implementation gap is explicit and assigned to the tasks above; no runtime change was authorized.
- The access-policy runbook described dormant AccessPolicy rows as active and offered stale migration reversal instructions. Current Series operation and planned extension now precede an explicitly superseded historical record; those old instructions are not current rollback guidance.
- Earlier analytics notes claimed discovery/progress/offer/ad-lifecycle events beyond the current 11-event schema. Read-only inspection confirmed the narrower schema and production consent no-op. Historical records are labeled, P4-T01-F5 owns required restoration/additions, and final validation must update exact trails before claiming a pass.
- Older cost examples silently modeled missing IAP/content inputs as zero. They are preserved in [the superseded archive](../archive/2026-08-cost-scenarios.md); current scenarios are parameterized and include ads, coins, fees/taxes/refunds, revenue share, infrastructure and acquisition.
- Architecture diagrams now distinguish Android coins/minimum economics from Apple/subscription/advanced tools, and use Bunny for the default playback/ingestion path. Existing historical inventory/spec notes are evidence, not current scope.
- Provider prices, FX and policy-source observations retained in the cost model are explicitly historical; they were not reverified in this strategy-only task and need refresh before operational use. Missing audience, commercial values and release evidence remain open decisions rather than contradictions silently filled in.

## Files changed

28 documentation files changed (26 existing files and 2 new records):

- [MICRODRAMA_IMPLEMENTATION_PLAN.md](../../MICRODRAMA_IMPLEMENTATION_PLAN.md)
- [README.md](../../README.md)
- [docs/README.md](../README.md)
- [docs/adr/0005-gcp-video-pipeline.md](../adr/0005-gcp-video-pipeline.md)
- [docs/adr/0006-store-billing-revenuecat-ledger.md](../adr/0006-store-billing-revenuecat-ledger.md)
- [docs/adr/0007-firebase-bigquery-experimentation.md](../adr/0007-firebase-bigquery-experimentation.md)
- [docs/analytics/README.md](../analytics/README.md)
- [docs/architecture/shortform-streaming.drawio](../architecture/shortform-streaming.drawio)
- [docs/archive/2026-08-cost-scenarios.md](../archive/2026-08-cost-scenarios.md)
- [docs/privacy/DEVELOPMENT_PRIVACY_NOTICE_DRAFT.md](../privacy/DEVELOPMENT_PRIVACY_NOTICE_DRAFT.md)
- [docs/product/CONTENT_RIGHTS_CHECKLIST.md](../product/CONTENT_RIGHTS_CHECKLIST.md)
- [docs/product/COST_MODEL.md](../product/COST_MODEL.md)
- [docs/product/DECISION_REGISTER.md](../product/DECISION_REGISTER.md)
- [docs/product/MVP_PRODUCT_BRIEF.md](../product/MVP_PRODUCT_BRIEF.md)
- [docs/product/SDK_DATA_INVENTORY.md](../product/SDK_DATA_INVENTORY.md)
- [docs/product/STORE_COMPLIANCE_MATRIX.md](../product/STORE_COMPLIANCE_MATRIX.md)
- [docs/runbooks/access-policy.md](access-policy.md)
- [docs/runbooks/account-lifecycle.md](account-lifecycle.md)
- [docs/runbooks/development-privacy-setup.md](development-privacy-setup.md)
- [docs/runbooks/final-validation.md](final-validation.md)
- [docs/runbooks/mvp-strategy-update-2026-09-07.md](mvp-strategy-update-2026-09-07.md)
- [docs/runbooks/rewarded-ads.md](rewarded-ads.md)
- [docs/runbooks/secrets-and-rotation.md](secrets-and-rotation.md)
- [docs/superpowers/plans/2026-08-31-p2-t02-account-lifecycle.md](../superpowers/plans/2026-08-31-p2-t02-account-lifecycle.md)
- [docs/superpowers/plans/2026-08-31-p3-t07-rewards.md](../superpowers/plans/2026-08-31-p3-t07-rewards.md)
- [docs/superpowers/plans/2026-08-31-p3-t08-offer-sheet.md](../superpowers/plans/2026-08-31-p3-t08-offer-sheet.md)
- [docs/superpowers/specs/2026-08-31-p3-t07-rewards-design.md](../superpowers/specs/2026-08-31-p3-t07-rewards-design.md)
- [mobile/README.md](../../mobile/README.md)

## Validation

Checks executed on 2026-09-07:

| Command / review | Result |
|---|---|
| `python scripts/check_repository_foundation.py` | Passed: secret scan, 50 repository tests, AI governance. The first scan flagged newly authored descriptive prose as an assigned-secret pattern; rephrased that sentence without changing or bypassing the scanner. No secret was introduced. |
| `python .tmp/validate_strategy_docs.py` (temporary local audit, not committed) | Passed: documentation-only file scope, Markdown links/fences/table columns, all 57 original task headings retained, 9 unique new follow-up/split headings, moved MVP task placement, all 35 current decision IDs, 14 preserved superseded decision rows, and valid IDs/references across 10 draw.io pages. |
| `git diff --check` | Passed after removing two accidental trailing-space changes. |
| Repository-wide `rg --no-ignore` documentation search for exclusive-ad, P7 coin/IAP/acquisition, fixed-launch and outdated catalog claims | Reviewed matches; current requirements updated. Remaining old-scope statements are explicitly historical/superseded, or describe unchanged current implementation with owning follow-up tasks. |
| `pnpm check` | **Not passed.** Initial sandbox attempt could not access the existing uv cache. Retry with cache access passed repository foundation, backend lint, format (160 files) and typecheck (157 files). Migration check reported no generated changes but could not validate database history because PostgreSQL was unavailable. Backend tests ended with 89 passed and 170 database-setup errors from the unavailable local PostgreSQL service. Aggregate contract/mobile stages were not reached. No database or runtime configuration was changed. |

The local full application check remains an environment limitation, not a pass or a merge approval. The documentation PR must separately pass the applicable always-reporting repository, application and API-contract CI gates described in `CONTRIBUTING.md`; path-filtered application jobs may skip documentation-only changes. No device/provider journey or production activation is claimed. Required financial/entitlement/privacy/device/provider checks for the newly planned work remain future implementation/release gates, not waived by these documentation checks.

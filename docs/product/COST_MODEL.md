# MVP Unit-Cost and Contribution Model

**Plan task:** P0-T04  
**Status:** Updated 2026-09-07 for ad-plus-coin MVP and capped paid acquisition; parameters and finance/founder approval remain open. No budget, coin price, conversion rate or confidential license percentage is assumed.

The business question is whether **contribution LTV can exceed CAC** for acquired users in France, on Android, in one defined audience. Model engagement, rewarded ads, Google Play coin packs, refunds, content revenue share and infrastructure together. Approximately 3–5 independently approved series reduce dependence on one title. D-017 must approve spend/business guardrails before any paid acquisition; this model is not a spend approval or a claim of viable economics.

## Currency and settlement rules

- Google Play supplies customer currency and localized price strings; English language does not choose currency. Apple/iOS commerce and subscriptions remain post-MVP.
- Preserve original financial amount/currency, tax/fee/refund basis, occurrence and settlement dates. Convert to EUR using recorded FX source/rate/effective timestamp; never substitute the user's coin balance for money.
- EUR is reporting and desired settlement currency. Verify Google payments profile/bank eligibility and actual settlement under D-022 before commercial MVP; Apple banking is a later iOS gate.
- Provider prices/quotes need effective dates and sources. Historical list-price/spike evidence below is not a current quote and must be refreshed before operational use. Missing amounts are **unknown**, never zero by default.

## Core formulas

Use the same acquired cohort, observation window, currency basis and allocation method throughout:

```text
gross_store_revenue = verified_Google_Play_coin_pack_sales
net_store_revenue = gross_store_revenue
                  - store_commissions
                  - indirect_taxes_not_already_deducted
                  - refunds_and_chargebacks_not_already_deducted

net_ad_revenue = provider_verified_rewarded_ad_revenue
               - mediation_fees_taxes_and_adjustments_not_already_net

content_cost = allocated_upfront_or_minimum_guarantee_cost_if_any
             + contractual_revenue_share_not_already_included
             + allocated_localization_and_delivery_cost

variable_infrastructure = video_processing + video_storage + CDN_delivery
                        + variable_API_background_compute + variable_database
                        + variable_analytics_observability
                        + variable_RevenueCat_provider_fees

contribution_before_acquisition = net_store_revenue + net_ad_revenue
                                - content_cost - variable_infrastructure

contribution_LTV_per_user
  = projected_lifetime_contribution_before_acquisition / acquired_users

CAC = acquisition_spend / acquired_users
LTV_to_CAC = contribution_LTV_per_user / CAC

cohort_contribution_after_acquisition
  = contribution_before_acquisition - acquisition_spend
```

If variable support/fraud losses apply, report them explicitly as an additional deduction in the contribution definition and use the same definition for every scenario/cohort; do not subtract refunds or losses twice. Fixed corporate overhead is separate from contribution but must be visible in runway/overall profitability review. Contribution LTV greater than CAC is the hypothesis, not a guarantee of company profitability.

Net store/ad source reports sometimes already deduct fees, taxes or refunds. Finance records the report basis and subtracts each item once. Purchases recognized for cohort revenue are reconciled to provider/store settlement and the private finance recognition policy; estimates and cash settlement are labeled separately. Coin spend is usage of previously sold virtual units, not a second sale.

## Content cost and private licensing inputs

Preferred MVP negotiation target (D-033): **€0 upfront license cost and €0 minimum guarantee where possible, revenue share and non-exclusive rights where possible**. This is not a confirmed contract value or a domain restriction. Other license structures remain supported.

`upfront license / MG ≈ 0` does **not** mean `content_cost = 0`. Revenue share remains a real variable cost; localization and delivery may also be due. A recoupable MG and royalties must follow the private contract's recoupment waterfall rather than counting the same cost twice. Separate cash timing from allocated economic cost and document allocation period/title/cohort basis. Automated royalty accounting remains out of MVP; a repeatable, reconciled private finance import is sufficient.

Do not store actual contracts, suppliers, rates, percentages, confidential terms or finance exports in this public repository. Public models use parameter names and generated examples; private records hold the real values and opaque provenance references.

## Required parameter sheet

Every parameter includes source/owner, original unit/currency, observation/effective date, reporting conversion, quality status and private provenance. Blank is unknown; a genuine zero requires evidence.

| Category | Parameters | Authority / approval |
|---|---|---|
| Cohort | Acquired users, installs, cohort date/window, market/platform, audience, source/campaign/creative, consent/attribution coverage | P4-T06 reconciled attribution; D-035 audience, D-017 test |
| Acquisition | Spend by network/date/campaign/creative and currency; test cap/period | Private network billing/import; D-017 founder approval |
| Coins/store | Product IDs, packs/quantities/prices, verified sales, commissions, taxes, refunds/chargebacks | Google/RevenueCat/backend; D-008 values/terms and finance recognition |
| Coin funnel | Payers, pack viewers, purchase attempts/completions, outstanding balance, ledger credits/debits | Governed client diagnostics for exposure only; backend/store for success/finance |
| Ads | Eligible offers, accepted offers, provider-verified impressions/revenue, eCPM/adjustments | AdMob reports and reconciled facts; SSV proves grant, not ad revenue |
| Engagement | First play, completion/continuation, lock reach, D1/D7/D30 retention, watch-hours/bitrate mix | Consented events/approved operational aggregates; coverage explicit |
| Content | Per-title upfront/MG, royalty basis and share, recoupment, localization/delivery allocation | Private legal/finance records; D-031 permission and D-033 strategy |
| Infrastructure | Encoding/source minutes, stored GB-month, delivered GB, API/DB/warehouse/provider variable fees | Dated billing/quotes and measured usage; no unmodeled default zero |
| Projection | Observation cut-off, lifetime horizon, retention/revenue/cost assumptions and sensitivity range | Founder/finance review; not a universal threshold |
| Financial corrections | Late settlements, refunds/chargebacks, support/fraud costs if relevant | Store/provider/ledger and private finance, restated consistently |

Subscriptions, MMP fees if not adopted, push and experiment infrastructure are outside MVP active scope. Add such costs only after adoption, without erasing future modeling capability.

## Scenario templates (parameters, not forecasts)

These replace the previous zero-IAP infrastructure-only scenarios. The [historical August arithmetic](../archive/2026-08-cost-scenarios.md) remains evidence, not the current business model. No coin prices, conversion rates, royalty percentages, ad yield or spend are invented here.

| Input/output | Small closed beta | Capped France storefront test | 10× acquired-volume sensitivity |
|---|---|---|---|
| Purpose | Validate behavior, joins and reconciliation with test money | Measure real ad/coin acquisition economics | Stress economics/capacity; no authority to scale spend |
| Acquired users | `N_beta` generated/test cohort; no paid-CAC claim | `N_launch` observed deduplicated acquired cohort | `10 * N_launch` modeling dimension only |
| Catalog | Synthetic/self-owned test fixtures | Approximately 3–5 privately cleared titles; source minutes/storage TBD | Same approved catalog unless separately changed; usage/storage measured separately |
| Rewarded ad revenue | Provider test ads have no real revenue; synthetic facts test arithmetic | `A_launch` provider net revenue, unknown until observed | `A_scale` independent yield/engagement parameter; not assumed 10× |
| Coin revenue | Synthetic/test purchases, no real receipts or money in public data | `G_launch` verified gross coin sales | `G_scale` independent sales/conversion parameter |
| Commission/tax/refunds | Generated values in private test rehearsal, no forecast | `F_launch`, `T_launch`, `R_launch`, avoid already-net deductions | `F_scale`, `T_scale`, `R_scale`, independently sourced |
| Content | Generated rights/cost inputs only | `C_launch` private upfront/MG/share/localization/delivery allocation | `C_scale` contract/usage-dependent; MG need not scale with users |
| Variable infra/provider fees | Measured test cost, distinguished from hypothetical business contribution | `I_launch` measured/quoted video/API/DB/analytics/RevenueCat | `I_scale` usage/tier/capacity model; no linear-cost assumption |
| Paid spend | No real spend in technical beta | `S_launch` actual spend within D-017 cap; cap TBD | `S_scale` unapproved scenario parameter, requires new spend approval |
| Observed contribution | Synthetic arithmetic check only | `(G_launch-F_launch-T_launch-R_launch)+A_launch-C_launch-I_launch` | `(G_scale-F_scale-T_scale-R_scale)+A_scale-C_scale-I_scale` |
| CAC | N/A for unpaid technical beta | `S_launch/N_launch` when denominator/spend valid | `S_scale/(10*N_launch)` when parameters available |
| Contribution LTV | No business projection from test facts | `L_launch/N_launch`, where `L_launch` is explicit projected lifetime cohort contribution before acquisition | `L_scale/(10*N_launch)`; independently modeled lifetime behavior |
| LTV:CAC | Not claimed | `(L_launch/N_launch)/(S_launch/N_launch)`; unknown until reconciled inputs and projection exist | `(L_scale/(10*N_launch))/(S_scale/(10*N_launch))`; sensitivity, not forecast |

For each scenario, compute net store plus net ads minus content and variable infra before subtracting acquisition. Show observed-window contribution separately from lifetime projection and after-acquisition contribution. Never fill a missing private parameter with zero to complete the table. Unpaid/organic cohorts with zero spend have no meaningful paid LTV:CAC ratio; zero acquired users makes per-user metrics undefined.

## Cohort, series and projection controls

- Use acquisition-date cohorts and the same deduplicated denominator for CAC and contribution LTV. MAU, installs and newly registered accounts are separate counts. Keep paid/organic/unmatched groups distinct; dedup and approved attribution window are part of P4-T06.
- Report observed D1/D7/D30 revenue/contribution and retention only for mature windows. Projection beyond observed time includes its horizon, method, assumptions and sensitivity range; D30 contribution is not lifetime contribution.
- A coin pack can fund episodes across series. Allocate its net recognized revenue by a documented private finance method tied to ledger usage, retaining unspent/unallocated residual explicitly. Series totals plus residual must reconcile to the cohort total; do not count the full pack once per series or once again at unlock.
- Allocate content revenue share using actual contractual bases and infrastructure using measured usage; distinguish direct costs from common costs. Campaign/creative join coverage may be partial: label estimated aggregate allocations rather than presenting fabricated user-level attribution.
- Current consent-gated account analytics cannot observe all anonymous/non-consented viewers. P4-T06/P4-T02 must document lawful acquisition denominators, coverage and missingness; no backfill of unconsented tracking or claim that a consented subset represents the whole paid cohort.
- Pause spend/review claims if freshness, uniqueness, spend joins or finance reconciliation cannot support D-017's approved decision criteria. Founder approves budget/guardrails before spend; no universal LTV:CAC pass/fail ratio is defined.

## Video-specific model

Default production path: **Bunny Stream** (D-014 / ADR 0005). The provider boundary is the `VideoProvider` Protocol at `backend/apps/playback/providers/types.py` (job submit/status, asset metadata, takedown, and playback authorization). This document cites that Protocol; it does not change that file. Documented fallback: private GCS → Transcoder API → Cloud CDN, **unplugged**. P2-T05 did not activate it. GCP list prices below are **modeling only**, not production config and not billing-export measurements.

```text
transcoder_cost_per_source_minute
  = sum(price_per_output_minute_for_each_rendition)

average_delivered_GB_per_watch_hour
  = sum(rendition_share * rendition_average_bitrate_Mbps) * 3600 / 8 / 1024

CDN_cost_per_watch_hour
  = average_delivered_GB_per_watch_hour * destination_CDN_rate
  + cache_fill_share
  + request_cost_per_watch_hour
```

Measure actual bitrate and rendition selection. Do not estimate all viewing at the highest rendition. The archived scenario GB figures are hypothetical bitrate assumptions; P2-T05 did not meter GB. Replace launch inputs with actual approved catalog/usage data.

## Cost controls

- Separate GCP staging and production projects with budgets and labels.
- Alert at forecast and actual budget percentages before automatic interruption would damage users.
- Keep production database on a non-pausing plan with backups; do not optimize away recovery.
- Set storage lifecycle rules for rejected sources and superseded renditions only after rights/retention review.
- Partition BigQuery models and require partition filters.
- Track CDN cost per watch hour and variable infrastructure per active user weekly.
- Treat MMP and managed DRM/video platforms as business decisions with adoption thresholds, not default dependencies.

## Reconsideration gates

- **Supabase → Cloud SQL/other PostgreSQL:** measured connection, recovery, region, compliance, support, or price requirement exceeds the current plan.
- **Bunny Stream → GCP Cloud CDN (documented fallback) or DRM vendor:** P2-T05 fails on Bunny, rights require certified DRM Bunny cannot satisfy, operational/residency/support constraints fail, playback reliability misses guardrails, or GCP/other measured total cost is better at volume.
- **No cache → cache:** database/query measurements show repeated hot reads and the invalidation design is defined.
- **Native attribution → MMP:** campaign ambiguity or fraud risk prevents reliable LTV/CAC decisions at the approved spend.
- **Modular monolith → separated service:** a bounded workload has independent scaling/failure/compliance needs proven by measurements.

## Sources to refresh

- Supabase: https://supabase.com/pricing
- Cloud Run: https://cloud.google.com/run/pricing
- Cloud Storage: https://cloud.google.com/storage/pricing
- Bunny Stream: https://bunny.net/pricing/
- Cloud CDN: https://cloud.google.com/cdn/pricing
- Transcoder API: https://cloud.google.com/transcoder/pricing
- BigQuery: https://cloud.google.com/bigquery/pricing
- Firebase: https://firebase.google.com/pricing
- RevenueCat: https://www.revenuecat.com/pricing
- Apple storefront pricing and proceeds: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/ and https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds
- Google Play local currencies and payouts: https://support.google.com/googleplay/android-developer/answer/1169947?hl=en

Record the original amount/currency, converted EUR amount, exchange rate, rate source, and effective timestamp when numerical inputs are added.

## P2-T05 Bunny Stream spike (public list prices)

Live non-production Bunny Stream smoke ran **2026-08-25** (generated 9:16 clip, non-production library, using a temporary command later removed). Bunny did **not** fail; GCP Cloud CDN fallback was not activated; D-014 was not reopened.

Observed encode (management-command status; no signed URLs recorded):

- Status ready; **1080×1920** portrait; duration **3.0s**; audio yes; captions yes; thumbnails **3**.
- Renditions: 240p, 360p, 480p, 720p, 1080p. This library’s default ladder has **no 540p**; 360p and 720p were present. Plan wording “360/540/720” is an example ABR ladder, not a failed spike.
- Spike source minutes = 3/60 = **0.05 min**. Standard Stream encoding is included at **USD 0.00 / source minute**, so spike encode cost is **USD 0.00 / EUR 0.00**.
- Stored GB and delivered GB were **not metered** from a Bunny billing export. They remain **absent as measured bytes**; do not invent GB. Public list prices below are historical modeling evidence and need revalidation before use. Implied encode cost per source minute is **USD 0.00**.

Public sources (retrieved 2026-08-25):

- Stream pricing: https://bunny.net/pricing/stream/
- Stream pricing reference: https://docs.bunny.net/stream/pricing
- CDN/platform pricing: https://bunny.net/pricing/

EUR conversion uses the Frankfurter API (ECB reference rates): https://api.frankfurter.app/latest?from=USD&to=EUR — **1 USD = 0.85734 EUR** on **2026-08-24** (latest published working-day rate as of 2026-08-25).

| Input | Original | EUR | Rate | Source | Timestamp |
| --- | --- | --- | --- | --- | --- |
| Standard encoding per source minute | USD 0.00 (included) | EUR 0.00 | 1 USD = 0.85734 EUR | https://docs.bunny.net/stream/pricing | 2026-08-25 |
| Storage, Europe Frankfurt HDD | USD 0.01 / GB-month | EUR 0.0085734 / GB-month | 1 USD = 0.85734 EUR | https://docs.bunny.net/stream/pricing | 2026-08-25 |
| CDN delivery, EU & North America, Standard | USD 0.010 / GB | EUR 0.0085734 / GB | 1 USD = 0.85734 EUR | https://docs.bunny.net/stream/pricing | 2026-08-25 |
| Implied encode cost per source minute (standard ladder) | USD 0.00 | EUR 0.00 | n/a | Standard encoding is included; delivery is billed per GB watched | 2026-08-25 |
| Spike-measured standard encode (0.05 source min, 3.0s clip) | USD 0.00 | EUR 0.00 | n/a | Live smoke 2026-08-25; included standard encoding | 2026-08-25 |
| Spike-measured stored GB | absent (not metered) | absent | n/a | No billing-export byte count; do not invent GB | 2026-08-25 |
| Spike-measured delivered GB | absent (not metered) | absent | n/a | No billing-export byte count; do not invent GB | 2026-08-25 |

Premium encoding (not the intended default path for this spike): HD 1080p/720p is USD 0.050 per output minute per codec (EUR 0.042867). Standard encoding remains USD 0.00 per source minute.

## GCP list-price modeling (unplugged fallback; not production)

**Public list price / modeling; GCP path not spiked; GB not metered.** Retrieved **2026-08-28** from the public pages cited in Sources to refresh. EUR uses the existing Frankfurter rate **1 USD = 0.85734 EUR** on **2026-08-24**. These rows are **not** billing-export measurements and **not** production configuration. P2-T05 did not activate this path.

**Portrait classifier note (modeling, not a vendor quote):** spike ladder 240/360/480/720/1080. Treat 240p–480p as SD (`< 1280×720`) and 720p–1080p as HD (`1280×720` to `1920×1080`) unless the live Transcoder page says otherwise. The live page (2026-08-28) matches that classifier; UHD is unused if the ladder stays ≤1080. Example **hypothetical** encode if that full ladder is always produced: `3 × 0.015 + 2 × 0.030 = USD 0.105` per source minute of output (EUR 0.09002) — contrast with Bunny Standard **USD 0.00 / source minute**. List-price comparison, not a production job.

| Input | Original | EUR | Rate | Source | Timestamp | Label |
| --- | --- | --- | --- | --- | --- | --- |
| Transcoder SD (`< 1280×720`) | USD 0.015 / output minute | EUR 0.0128601 / output minute | 1 USD = 0.85734 EUR | https://cloud.google.com/transcoder/pricing | 2026-08-28 | public list price / modeling; GCP path not spiked; GB not metered |
| Transcoder HD (`1280×720` to `1920×1080`) | USD 0.030 / output minute | EUR 0.0257202 / output minute | 1 USD = 0.85734 EUR | https://cloud.google.com/transcoder/pricing | 2026-08-28 | public list price / modeling; GCP path not spiked; GB not metered |
| Transcoder UHD (`> 1920×1080` to `4096×2160`) | USD 0.060 / output minute | EUR 0.0514404 / output minute | 1 USD = 0.85734 EUR | https://cloud.google.com/transcoder/pricing | 2026-08-28 | cited; unused if ladder stays ≤1080; public list price / modeling; GCP path not spiked |
| Hypothetical full-ladder encode (3×SD + 2×HD) | USD 0.105 / source minute of output | EUR 0.0900207 / source minute of output | 1 USD = 0.85734 EUR | derived from Transcoder list prices above | 2026-08-28 | modeling, not a vendor quote / not a production job |
| Cloud CDN cache egress, Europe, 0–10 TiB | USD 0.08 / GiB | EUR 0.0685872 / GiB | 1 USD = 0.85734 EUR | https://cloud.google.com/cdn/pricing | 2026-08-28 | public list price / modeling; GCP path not spiked; GB not metered |
| Cloud CDN cache fill, within Europe | USD 0.01 / GiB | EUR 0.0085734 / GiB | 1 USD = 0.85734 EUR | https://cloud.google.com/cdn/pricing | 2026-08-28 | public list price / modeling; GCP path not spiked; GB not metered |
| Cloud CDN cache lookup | USD 0.0075 / 10,000 | EUR 0.00643005 / 10,000 | 1 USD = 0.85734 EUR | https://cloud.google.com/cdn/pricing | 2026-08-28 | public list price / modeling; GCP path not spiked; GB not metered |
| Cloud Storage Standard, named EU region Frankfurt (`europe-west3`) | **pending exact cell** | pending | n/a | https://cloud.google.com/storage/pricing | 2026-08-28 | public page is a region picker; this retrieval could not select Frankfurt. **Do not invent a GB-month number.** GB not metered. |
| Cloud Storage Standard, default-loaded Region cell on that page (Iowa `us-central1` selected in the picker) | USD 0.000027397 / 1 gibibyte hour | EUR 0.0000234885 / 1 gibibyte hour | 1 USD = 0.85734 EUR | https://cloud.google.com/storage/pricing | 2026-08-28 | exact loaded hourly cell; **not claimed as Frankfurt**. Labeled conversion only: 0.000027397 × 730 = USD 0.01999981 / GiB-month. Not a metered GB-month and not an europe-west3 quote. |

Hypothetical catalog encode on the GCP path if the unplugged fallback were modeled at the full ladder: 60 × USD 0.105 = **USD 6.30** (EUR 5.40124). Contrast Bunny Standard 60 × USD 0.00 = **USD 0.00**.

# MVP Unit-Cost and Contribution Model

**Plan task:** P0-T04  
**Status:** Three **hypothetical** scenarios filled (small closed beta, controlled storefront launch, 10× scale). D-017 acquisition spend is **not assumed** and is **not** an approved UA budget. This sheet is **not** Checkpoint 0 cost-model approval. Provider quotes, catalog terms, and acquisition budget remain pending except cited public list prices and the P2-T05 Bunny encode observation. Store, subscription, and RevenueCat inputs remain for **P7** scenarios.

The business should be evaluated by acquired cohort, not by aggregate revenue. EUR is the company reporting currency. Keep provider pricing inputs versioned with an effective date and source link; do not hard-code volatile prices into application logic.

## Currency and settlement rules

- A customer's billing currency is the localized currency supplied by the active App Store or Google Play storefront. It is independent of the app's English interface language.
- Preserve every financial fact in its original currency and original amount.
- Convert original amounts to EUR for company reporting using a documented exchange-rate source, rate, and effective timestamp.
- Target EUR store settlement by configuring an eligible Apple bank account and Google payments profile/bank account. Do not assume the app can choose payout currency at transaction time.
- Treat coins as non-cash virtual units. A coin balance is not a monetary currency balance and is never converted to EUR for the user. Coins are a P7 input; ads-only MVP contribution uses verified ad revenue.

## Core formulas

```text
gross_store_revenue
  = subscription_sales + coin_pack_sales
  (P7 IAP; zero in ads-only MVP)

net_store_revenue
  = gross_store_revenue
  - store_commissions
  - indirect_taxes_withheld_or_due
  - refunds_and_chargebacks
  (P7 IAP; zero in ads-only MVP)

net_ad_revenue
  = verified_rewarded_ad_revenue
  - ad_mediation_fees_not_already_net

content_cost
  = minimum_guarantee_amortization
  + contractual_revenue_share
  + localization_and_delivery_cost

variable_infrastructure
  = video_transcoding
  + video_storage
  + CDN_delivery
  + API_and_background_compute
  + database_variable_cost
  + analytics_and_observability_variable_cost
  + transactional_notifications
  + payment_or_MMP_variable_fees

cohort_contribution
  = net_store_revenue
  + net_ad_revenue
  - content_cost
  - variable_infrastructure
  - acquisition_spend
  - variable_support_and_fraud_loss

cohort_CAC = acquisition_spend / attributed_new_users

cohort_contribution_LTV_per_user
  = projected_lifetime_cohort_contribution_before_acquisition
  / attributed_new_users

contribution_LTV_to_CAC
  = cohort_contribution_LTV_per_user / cohort_CAC
```

These scenarios report `cohort_contribution_before_acquisition` only. `acquisition_spend` is pending D-017 (Decision required) and is excluded from the numeric result. `contribution_LTV_to_CAC` is **not claimed**.

## Required input sheet

| Category | Input | Unit | Source/owner |
|---|---|---|---|
| Cohort | Country, platform, campaign, creative, series, experiment, install date | dimension | Analytics/growth |
| Acquisition | Spend, attributed installs/users | original currency, EUR, count | Ad network/MMP |
| Store | Product, gross proceeds, commissions, taxes, refunds | customer/store currency, settlement currency, EUR | Store/RevenueCat/finance (**P7**) |
| Subscription | Starts, renewals, churn, grace, expiry | count/rate | RevenueCat/backend (**P7**) |
| Coins | Packs sold, credits, debits, outstanding balance | count/coins plus purchase currency/EUR | Backend ledger (**P7**) |
| Ads | Verified impressions, eCPM/net revenue | count/original currency/EUR | AdMob |
| Viewing | Starts, completed minutes, rendition mix, watch hours | count/minutes | Analytics/player |
| Video processing | Source minutes × each output rendition price, or included in managed-video plan | minutes/currency | Bunny Stream / GCP billing |
| Storage | Source, HLS, artwork, versioned/backup GB-month | GB-month | Bunny Stream / GCP billing |
| Delivery | CDN cache egress, fill, requests by destination | GB/requests/currency | Bunny Stream / GCP billing |
| Application | Cloud Run CPU/RAM/requests/egress | usage/currency | GCP billing |
| Database | Plan, compute, storage, egress, backups | usage/currency | Supabase/GCP billing |
| Data | Firebase/BigQuery/observability/MMP usage | usage/currency | Provider billing |
| Content | MG amortization, revenue share, localization | currency | Contract/finance |
| Support/fraud | Refund handling, goodwill, invalid traffic, abuse loss | currency | Support/risk |

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

Measure actual bitrate and rendition selection. Do not estimate all viewing at the highest rendition. Scenario GB figures below are **hypothetical modeling assumptions from the bitrate formula**; P2-T05 did not meter GB.

## Shared modeling assumptions

One table used by all three scenarios. Every volume is **hypothetical**. EUR uses Frankfurter **1 USD = 0.85734 EUR** on **2026-08-24** (https://api.frankfurter.app/latest?from=USD&to=EUR), same retrieval as the Bunny spike table. No new dated FX pull.

| # | Input | Value | Label |
| --- | --- | --- | --- |
| 1 | GB / watch-hour | **0.721 GB / watch-hour** | **Hypothetical** mix, not all at 1080p: 40% 480p @ 1.2 Mbps, 40% 720p @ 2.5 Mbps, 20% 360p @ 0.8 Mbps. `0.4×1.2 + 0.4×2.5 + 0.2×0.8 = 1.64 Mbps`. `1.64 × 3600 / 8 / 1024 = 0.720703125` ≈ **0.721** (3 d.p.). **Hypothetical modeling assumption from the bitrate formula**; P2-T05 did not meter GB. |
| 2 | Catalog source minutes | **60** | D-004 one series; **hypothetical** 40 episodes × 1.5 min. Not a licensed catalog. |
| 3 | Stored GB | **≈ 4.13 GB** | **Modeling, not metered.** Aggregate ladder bitrates 0.4+0.8+1.2+2.5+4.5 = 9.4 Mbps × 1.0 h source → `9.4 × 3600 / 8 / 1024 = 4.130859375` ≈ **4.13 GB** stored for 60 source minutes. Formula-derived. |
| 4 | Bunny variable video | encode **USD 0.00**; storage **USD 0.0413 / month**; CDN = watch-hours × 0.721 × USD 0.010 | encode = 60 × USD 0.00 = **USD 0.00**; storage = 4.13 × 0.01 = **USD 0.0413** (table ~USD 0.041). CDN uses Bunny Standard list USD 0.010 / GB. |
| 5 | Other `variable_infrastructure` terms | **USD 0.00** | API/DB/analytics/notifications/MMP: **not modeled / pending quotes**. Kept in the sum so the formula identity is visible. Cloud Run request counts are not invented. |
| 6 | P7 IAP | **0 / N/A / labeled P7** | Payer conversion, store commissions, coins, subscriptions = **P7**. Ads-only uses rewarded ads/user and net eCPM. |
| 7 | Acquisition spend | **pending D-017 (Decision required)** | **Not assumed.** No dollar or euro UA figure. `cohort_contribution` is shown **before acquisition**. Approved `contribution_LTV_to_CAC` is **not computed or claimed**. |
| 8 | Content cost | **USD 0.00 in this infrastructure model** | MVP catalog is one self-owned series (D-004). Production cost is tracked separately when known; no license MG or revenue share applies to MVP. |
| 9 | Net eCPM | **hypothetical USD 8.00** (EUR 6.85872 at 0.85734) **per 1,000 rewarded impressions** | Not measured AdMob yield. `net_ad_revenue = (users × ads_per_user / 1000) × eCPM`. |
| 10 | EUR | 1 USD = 0.85734 EUR on 2026-08-24 | Frankfurter / ECB reference; reused, not a new pull. |

## Scenario template

Three **hypothetical** scenarios. Same fields throughout. This is **not an approved budget**. D-017 remains **pending** (Decision required). D-001 limits the MVP to France through Google Play; there is no multi-country or licensed-content mix in these scenarios. First real negotiated quotes remain pending except cited public list prices and the P2-T05 Bunny encode observation.

| Field | Small closed beta (**hypothetical**) | Controlled storefront launch (**hypothetical**) | 10× scale (**hypothetical** 10× launch volumes) |
| --- | --- | --- | --- |
| Acquired users / MAU | **30** (tens of users; invite-only) | **500 MAU** | **5,000 MAU** |
| Catalog source minutes | 60 | 60 | 60 (same one-series template; catalog growth is a later decision) |
| Watch hours / user | **0.5** over the cohort window | **1.0 / month** | **1.0 / month** (do not assume linear engagement quality; only scale headcount ×10) |
| P7 payer conversion / net payer revenue | **P7 / 0** | **P7 / 0** | **P7 / 0**; **do not assume linear payer conversion** (N/A ads-only) |
| Rewarded ads / user | **3** | **8 / month** | **8 / month** (same rate; not a conversion curve) |
| Net eCPM | hypothetical USD 8.00 (EUR 6.85872) | same | same |
| Content cost | pending / USD 0.00 | pending / USD 0.00 | pending / USD 0.00 |
| Acquisition spend | **pending D-017 — not assumed** | **pending D-017 — not an approved budget** | **pending D-017 — not assumed** |
| Encode (Bunny default) | USD 0.00 | USD 0.00 | USD 0.00 |
| Storage (Bunny list × modeled GB) | ~USD 0.041 | ~USD 0.041 | ~USD 0.041 (same catalog) |
| CDN (Bunny list × modeled GB) | 30 × 0.5 × 0.721 × 0.010 ≈ **USD 0.108** | 500 × 1.0 × 0.721 × 0.010 ≈ **USD 3.61** | 5,000 × 1.0 × 0.721 × 0.010 ≈ **USD 36.05** |
| Other infra | USD 0.00 not modeled | USD 0.00 not modeled | USD 0.00 not modeled; see thresholds |
| `variable_infrastructure` | encode + storage + CDN + other ≈ **USD 0.15** | ≈ **USD 3.65** | ≈ **USD 36.09** |

Arithmetic shape (required, same every scenario):

```text
net_store_revenue = 0  (P7)
net_ad_revenue = (users × ads_per_user / 1000) × hypothetical_eCPM
content_cost = 0  (pending catalog terms)
variable_infrastructure = video_transcoding + video_storage + CDN_delivery
                         + API_and_background_compute [not modeled]
                         + database_variable_cost [not modeled]
                         + analytics_and_observability_variable_cost [not modeled]
                         + transactional_notifications [not modeled]
                         + payment_or_MMP_variable_fees [not modeled]
acquisition_spend = pending D-017 (not assumed; excluded from the numeric result)
cohort_contribution_before_acquisition
  = net_ad_revenue - content_cost - variable_infrastructure
LTV:CAC = not claimed (acquisition_spend not approved)
```

Rounding trail (verifier replay). Storage uses 4.13 × 0.01 = **0.0413**. CDN uses the 0.721 GB/watch-hour assumption. Displayed `variable_infrastructure` is rounded to 2 d.p. USD; contribution uses that rounded infra total. EUR = USD × 0.85734.

### Small closed beta (hypothetical)

```text
CDN_delivery = 30 × 0.5 × 0.721 × 0.010 = 0.10815  → table ≈ USD 0.108 (EUR 0.09272)
video_storage = 4.13 × 0.01 = 0.0413                 → table ≈ USD 0.041 (EUR 0.03541)
video_transcoding = 0.00
other infra terms = 0.00  (not modeled / pending quotes)
variable_infrastructure = 0.00 + 0.0413 + 0.10815 + 0.00 = 0.14945 ≈ USD 0.15 (EUR 0.12860)
ads impressions = 30 × 3 = 90
net_ad_revenue = (90 / 1000) × 8.00 = USD 0.72 (EUR 0.61728)
content_cost = 0.00 (pending catalog terms)
acquisition_spend = pending D-017 (Decision required; not assumed; no dollar/euro UA figure)
cohort_contribution_before_acquisition = 0.72 − 0.15 = USD 0.57 (EUR 0.48868)
  unrounded check: 0.72 − 0.14945 = 0.57055 ≈ 0.57
LTV:CAC = not claimed
```

### Controlled storefront launch (hypothetical)

```text
CDN_delivery = 500 × 1.0 × 0.721 × 0.010 = 3.605 (EUR 3.09071) → table ≈ USD 3.61 (EUR 3.09500)
video_storage = 0.0413                            → table ≈ USD 0.041 (EUR 0.03541)
video_transcoding = 0.00
other infra terms = 0.00  (not modeled / pending quotes)
variable_infrastructure = 0.00 + 0.0413 + 3.605 + 0.00 = 3.6463 ≈ USD 3.65 (EUR 3.12929)
ads impressions = 500 × 8 = 4,000
net_ad_revenue = (4000 / 1000) × 8.00 = USD 32.00 (EUR 27.43488)
content_cost = 0.00 (pending catalog terms)
acquisition_spend = pending D-017 (Decision required; not an approved budget; no dollar/euro UA figure)
cohort_contribution_before_acquisition = 32.00 − 3.65 = USD 28.35 (EUR 24.30559)
  unrounded check: 32.00 − 3.6463 = 28.3537 ≈ 28.35
LTV:CAC = not claimed
```

### 10× scale (hypothetical 10× launch volumes)

Headcount ×10 only. Do not assume linear engagement quality or linear payer conversion (P7 / N/A ads-only).

```text
CDN_delivery = 5,000 × 1.0 × 0.721 × 0.010 = 36.05  → USD 36.05 (EUR 30.90710)
video_storage = 0.0413                              → table ≈ USD 0.041 (EUR 0.03541)
video_transcoding = 0.00
other infra terms = 0.00  (not modeled / pending quotes)
variable_infrastructure = 0.00 + 0.0413 + 36.05 + 0.00 = 36.0913 ≈ USD 36.09 (EUR 30.94140)
ads impressions = 5,000 × 8 = 40,000
net_ad_revenue = (40000 / 1000) × 8.00 = USD 320.00 (EUR 274.34880)
content_cost = 0.00 (pending catalog terms)
acquisition_spend = pending D-017 (Decision required; not assumed; no dollar/euro UA figure)
cohort_contribution_before_acquisition = 320.00 − 36.09 = USD 283.91 (EUR 243.40740)
  unrounded check: 320.00 − 36.0913 = 283.9087 ≈ 283.91
LTV:CAC = not claimed
```

### GCP-path sensitivity (modeling only; fallback unplugged)

Not production. Same **hypothetical** GB. Replace Bunny CDN USD 0.010/GB with Cloud CDN Europe cache egress USD 0.08/GiB (list-price modeling; GB and GiB treated as the same modeling unit, not metered). Replace Bunny encode USD 0.00 with Transcoder portrait-ladder example **USD 0.105 / source minute** × 60 ≈ **USD 6.30** (EUR 5.40124). GCS Frankfurt Standard storage remains a **pending exact cell** (see GCP table); it is not invented here.

| Scenario | Bunny CDN (USD) | GCP Cloud CDN Europe egress (USD) | GCP encode (USD) |
| --- | --- | --- | --- |
| Beta | 0.10815 | 30 × 0.5 × 0.721 × 0.08 = **0.8652** | 6.30 |
| Launch | 3.605 | 500 × 1.0 × 0.721 × 0.08 = **28.84** | 6.30 |
| 10× | 36.05 | 5,000 × 1.0 × 0.721 × 0.08 = **288.40** | 6.30 |

This illustrates ADR 0005 “several times more expensive” without activating the fallback. Cache fill (USD 0.01/GiB within Europe) and cache lookup (USD 0.0075 / 10,000) are **not** added; request counts are not invented.

### 10× thresholds

Reuse existing gates only; no new ADRs.

- **CDN volume:** 5,000 × 0.721 GB ≈ **3,605 GB ≈ 3.6 TB** (≈ 3.52 TiB) month CDN — still inside Cloud CDN’s first **10 TiB** Europe tier. **No volume-discount trigger.**
- **Unit-price gap:** Bunny USD 0.010/GB vs GCP Europe USD 0.08/GiB remains the existing **Bunny → GCP / DRM** gate (Reconsideration gates / ADR 0005), not a new decision.
- **Supabase → paid/non-pausing production DB** (ADR 0004 + existing gate) is the first realistic infra threshold before public traffic.
- **MMP:** existing gate + D-018; does not fire while D-017 spend is unset.
- **Firebase/observability quotas, Cloud Run, support/fraud:** watch existing cost-control bullets / pending quotes; no new architecture.
- **Encode:** Bunny Standard stays USD 0/source min at this catalog size; GCP Transcoder scales with output minutes if the fallback were ever activated.

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
- Stored GB and delivered GB were **not metered** from a Bunny billing export. They remain **absent as measured bytes**; do not invent GB. Public list prices below still apply for modeling. Implied encode cost per source minute is **USD 0.00**.

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

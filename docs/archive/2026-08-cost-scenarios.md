# Historical August 2026 infrastructure-only scenarios

**Status: Superseded for MVP business planning on 2026-09-07.** These previously published hypothetical examples are retained verbatim as arithmetic/provenance evidence under P0-T04. Their zero/pending IAP, acquisition and content costs are not current MVP assumptions or approved budgets. Do not use their contribution figures for launch or LTV:CAC decisions. Use [the current cost model](../product/COST_MODEL.md), which includes purchased coins, revenue-share content cost and acquisition.

The dated provider prices and FX are historical, not reverified on 2026-09-07. Older one-series volumes are not the new approximately 3–5-series target.

## Shared modeling assumptions

One table used by all three scenarios. Every volume is **hypothetical**. EUR uses Frankfurter **1 USD = 0.85734 EUR** on **2026-08-24** (https://api.frankfurter.app/latest?from=USD&to=EUR), same retrieval as the Bunny spike table. No new dated FX pull.

| # | Input | Value | Label |
| --- | --- | --- | --- |
| 1 | GB / watch-hour | **0.721 GB / watch-hour** | **Hypothetical** mix, not all at 1080p: 40% 480p @ 1.2 Mbps, 40% 720p @ 2.5 Mbps, 20% 360p @ 0.8 Mbps. `0.4×1.2 + 0.4×2.5 + 0.2×0.8 = 1.64 Mbps`. `1.64 × 3600 / 8 / 1024 = 0.720703125` ≈ **0.721** (3 d.p.). **Hypothetical modeling assumption from the bitrate formula**; P2-T05 did not meter GB. |
| 2 | Catalog source minutes | **60** | **Hypothetical one-series baseline**: 40 episodes × 1.5 min. D-004 allows a larger approved catalog; scale this input to the actual total. |
| 3 | Stored GB | **≈ 4.13 GB** | **Modeling, not metered.** Aggregate ladder bitrates 0.4+0.8+1.2+2.5+4.5 = 9.4 Mbps × 1.0 h source → `9.4 × 3600 / 8 / 1024 = 4.130859375` ≈ **4.13 GB** stored for 60 source minutes. Formula-derived. |
| 4 | Bunny variable video | encode **USD 0.00**; storage **USD 0.0413 / month**; CDN = watch-hours × 0.721 × USD 0.010 | encode = 60 × USD 0.00 = **USD 0.00**; storage = 4.13 × 0.01 = **USD 0.0413** (table ~USD 0.041). CDN uses Bunny Standard list USD 0.010 / GB. |
| 5 | Other `variable_infrastructure` terms | **USD 0.00** | API/DB/analytics/notifications/MMP: **not modeled / pending quotes**. Kept in the sum so the formula identity is visible. Cloud Run request counts are not invented. |
| 6 | P7 IAP | **0 / N/A / labeled P7** | Payer conversion, store commissions, coins, subscriptions = **P7**. Ads-only uses rewarded ads/user and net eCPM. |
| 7 | Acquisition spend | **pending D-017 (Decision required)** | **Not assumed.** No dollar or euro UA figure. `cohort_contribution` is shown **before acquisition**. Approved `contribution_LTV_to_CAC` is **not computed or claimed**. |
| 8 | Content cost | **USD 0.00 in this infrastructure-only baseline** | Production, minimum-guarantee, or revenue-share costs are intentionally not assumed. Add the actual privately approved cost/terms to the business model before admitting licensed content; never record confidential rates here. |
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

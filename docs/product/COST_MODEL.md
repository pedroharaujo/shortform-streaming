# MVP Unit-Cost and Contribution Model

**Plan task:** P0-T04  
**Status:** Formula baseline; ads-first MVP validation (2026-08-27). Provider quotes, catalog terms, and acquisition budget are pending. Store, subscription, and RevenueCat inputs remain for **P7** scenarios.

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

Measure actual bitrate and rendition selection. Do not estimate all viewing at the highest rendition.

## Scenario template

Create at least three scenarios before P0-T04 is complete:

### Small closed beta

- Acquired users:
- Catalog source minutes:
- Watch hours/user:
- Payer conversion and average net payer revenue: (**P7** IAP scenario; ads-only MVP uses rewarded ads/user and net eCPM)
- Rewarded ads/user and net eCPM:
- Content cost:
- Expected monthly variable infrastructure:
- Acquisition spend:
- Contribution/user:

### Controlled storefront launch

Use the same fields with the approved budget, expected country/storefront/platform mix, customer-currency mix, EUR settlement assumptions, and first real provider quotes.

### 10× scale

Apply measured behavior rather than assuming linear payer conversion. Identify the first provider, quota, database, observability, and support thresholds that change price or architecture.

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

Live non-production Bunny Stream smoke ran **2026-08-25** (`spike_bunny_playback`, generated 9:16 clip, non-production library). Bunny did **not** fail; GCP Cloud CDN fallback was not activated; D-014 was not reopened.

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

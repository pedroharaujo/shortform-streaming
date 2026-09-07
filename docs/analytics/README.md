# MVP analytics contract

The completed P4-T01 foundation measures viewing and rewarded-ad behavior.
D-016/D-032 (2026-09-07) extend MVP measurement to purchased coins and contribution
LTV/CAC under P4-T01-F5/P4-T02/P4-T03/P4-T06; these additions are planned, not
implemented by this documentation update. The
mobile contract and consent lifecycle exist in `mobile/src/analytics/`;
collection is disabled by default and can be enabled only from the current
server-returned account preference. This document does not approve
production collection, retention, residency, exports, advertising use, or
legal/store declarations. Those remain gated by D-020 and P6 clearance.
Production builds therefore select a hard no-op adapter even when the stored
preference is true; a later approved release task must explicitly remove that gate.

## Rules shared by every event

- Analytics is optional and consent-gated. No event may leave the app before
  the current account's server-returned analytics preference permits it.
- `event_id` is derived from the event name and a safe logical event key so a
  retry keeps the same ID. The logical key is not sent.
- Required context is `session_id`, app version/build, platform, locale, and an
  ISO UTC occurrence time. Country is optional. `account_deleted` is the only
  exception: it contains only occurrence time and safe completion status, with
  no session, profile, country, or provider identifier. Firebase's app-instance
  ID and a consented opaque profile ID are transport identity, not event
  properties.
- Mobile events are product diagnostics. Django/provider verification and the
  entitlement database remain authoritative for reward grants; backend/store/provider records alone own financial outcomes.
- Unknown fields are errors in development. Production removes invalid
  optional/unknown fields and drops an event if a required value is unsafe.
- Never send email, authentication credentials, Firebase UID, signed video
  URLs, full IP addresses, payment receipts, contract references, provider
  callback data, ad bindings, SSV values, or free-form error payloads.

## Ownership and data classification

All listed IDs are opaque application IDs, classified as pseudonymous product
data when linked to a session or consented profile. App/build/platform and safe
error codes are technical data. Planned campaign fields are pseudonymous attribution data. There are no direct
identifiers or raw financial records in client Analytics; restricted backend
financial facts and warehouse joins are separately governed below.

Product owns discovery, playback, offer, and diagnostic definitions.
Engineering owns schema enforcement and safe error codes. The backend remains
the owner of verified rewards and access grants. Retention, region, processor
access, and deletion propagation are **pending D-020**. Production provider
transport must remain disabled until approved. Account opt-out/deletion cleanup
is implemented with the provider adapter in P4-T01-F2.

## Current schema and historical viewing/reward dictionary

Read-only schema check on 2026-09-07: `mobile/src/analytics/events.ts` currently allows only `app_open`, `sign_up`, `login`, `account_deleted`, `episode_started`, `episode_completed`, `playback_error`, `locked_episode_viewed`, `rewarded_ad_started`, `reward_granted` and `reward_failed`; access methods are `free`/`rewarded_ad`. The 2026-09-02 narrowing removed the broader discovery/progress/offer/ad-lifecycle events. The dictionary and completed F1–F4 notes below preserve historical definitions, **not current shipping triggers**. P4-T01-F5 restores required offer exposure/selection and adds coin/acquisition measurement; do not report removed events as verified today.

Every event except `account_deleted` also includes the shared context above.

| Event                   | Exact trigger and owner                                                                             | Event properties                                                                    | Classification / authority                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `app_open`              | Product: once when a cold launch, foreground session, or approved internal deep link becomes active | launch reason; launch reason only in current narrowed contract; bounded campaign/creative dimensions planned under P4-T06 | Product/attribution diagnostic                                         |
| `sign_up`               | Product: after the app confirms the newly created account through `/v1/me`                          | sign-in method                                                                      | Account-funnel diagnostic                                              |
| `login`                 | Product: after an existing account is confirmed through `/v1/me`                                    | sign-in method                                                                      | Account-funnel diagnostic                                              |
| `account_deleted`       | Backend/account flow: once after deletion is accepted; never include the deleted identity           | occurrence time and completed or provider-cleanup-pending status                    | Operational diagnostic; deletion receipt remains authoritative         |
| `home_viewed`           | Product: once when the home catalog successfully renders for a session                              | none                                                                                | Discovery diagnostic                                                   |
| `series_impression`     | Product: once per series/card position in a rendered home result                                    | series ID, zero-based position                                                      | Discovery diagnostic                                                   |
| `series_opened`         | Product: when navigation opens an eligible series                                                   | series ID                                                                           | Discovery diagnostic                                                   |
| `episode_started`       | Player: once when playback actually starts for the episode                                          | series/episode/season/order, access method, starting second                         | Playback diagnostic                                                    |
| `episode_progress`      | Player: at the owned progress checkpoint, not every video callback                                  | series/episode/season/order, position and duration seconds                          | Playback diagnostic; progress API remains authoritative                |
| `episode_completed`     | Player: once when completion is accepted for the episode                                            | series/episode/season/order and duration                                            | Playback diagnostic; progress API remains authoritative                |
| `playback_error`        | Player: once for the terminal failed phase shown to the viewer                                      | optional episode ID, safe error code, phase                                         | Technical diagnostic; never free-form text or a URL                    |
| `locked_episode_viewed` | Player: once when a locked result is displayed                                                      | series/episode/season/order and safe lock reason                                    | Offer-funnel diagnostic; server eligibility remains authoritative      |
| `offer_presented`       | Reward sheet: once when the eligible ad offer is visibly rendered                                   | episode fields and rewarded-ad method                                               | Offer-funnel diagnostic                                                |
| `offer_selected`        | Reward sheet: once for the explicit watch-ad action                                                 | episode fields and rewarded-ad method                                               | Offer-funnel diagnostic                                                |
| `rewarded_ad_loaded`    | Ad presenter: once after the provider reports a loaded rewarded ad                                  | episode fields and rewarded-ad method                                               | Provider diagnostic only                                               |
| `rewarded_ad_started`   | Ad presenter: once after presentation begins                                                        | episode fields and rewarded-ad method                                               | Provider diagnostic only                                               |
| `rewarded_ad_completed` | Ad presenter: once after the earned-reward callback                                                 | episode fields and rewarded-ad method                                               | Provider diagnostic; does not grant access                             |
| `reward_granted`        | Reward flow: once after owner-only status returns the verified grant                                | episode fields and `admob_ssv` source                                               | Client diagnostic; verified callback and entitlement are authoritative |
| `reward_failed`         | Reward flow: once for a terminal offer/load/present/verify failure                                  | episode fields, safe stage and safe error code                                      | Provider diagnostic only                                               |

## Identity and consent sequence

P4-T01-F2 adds the native Analytics module and a process-wide consent controller
while all native automatic collection, screen reporting, advertising identifiers,
and advertising consent default off. F2b connects sign-in, the confirmed `/v1/me`
profile, preference saves, sign-out, session replacement, unauthenticated cleanup,
and account deletion to the controller. F3a connects the process-wide event runtime
to cold/foreground app lifecycle, successful home catalog rendering, ordered series
card impressions, and eligible series detail rendering. F3b connects the player to
actual native playback start, accepted progress/completion writes, displayed locks,
and terminal safe-coded failures. The runtime retries a cold trigger when consent
activates and deduplicates accepted logical events across remounts, retries, and
autoplay. F4 connects visible offer/selection, native loaded/opened/earned callbacks,
and owner-only verified reward status without sending provider bindings or making
Analytics authoritative. The account-funnel connection observes confirmed `/v1/me`
authentication results and accepted deletion receipts; Firebase's `isNewUser`
result distinguishes first-time Google sign-up from returning login. A pre-consent
authentication
result can be retried only for the same still-current session when consent activates.
Deletion detaches the Analytics user ID and resets local data before its status-only
diagnostic, then disables collection.

After `/v1/me` confirms
analytics consent, the adapter may enable collection and link only the opaque
profile ID. Anonymous app-instance history may link to that profile only in the
same consented installation. Withdrawal, sign-out, account deletion, or session
replacement disables collection, clears the user ID, and resets local Analytics
data before another account can be linked. Anonymous users have no analytics
preference in the current MVP, so collection stays off for them.
The real adapter is reachable only in local/staging builds for synthetic
validation. Production uses a no-op adapter until D-020 and P6 clearance.

## Historical completed foundations and current follow-up work

- Completed P4-T01-F1: fixed schemas, filtering, deterministic IDs, and no-op
  default sink.
- Completed P4-T01-F2a: Firebase adapter, default-off native settings, and the tested
  consent/identity controller.
- Completed P4-T01-F2b: process-wide lifecycle connection for sign-in, preference
  changes, sign-out, deletion, and session replacement.
- Completed P4-T01-F3a: consent-aware runtime/Firebase event transport plus
  `app_open`, `home_viewed`, `series_impression`, and `series_opened` triggers with
  ordered consented and zero-event non-consented tests.
- Completed P4-T01-F3b: server-owned playback access source plus actual-start,
  accepted-progress/completion, displayed-lock, and terminal safe-error triggers.
  Tests cover ordered/deduplicated free and autoplay trails and zero non-consented
  transport. Staff access omits `episode_started` instead of inventing a product
  access method; progress and completion remain non-authoritative diagnostics.
- Completed P4-T01-F4: visible offer/selection, native ad lifecycle, terminal safe
  failures, and owner-status `reward_granted` backed by a server-derived
  `admob_ssv` source. Stable request/intent keys deduplicate retry, recovery, and
  callback replay but are never event properties. The verified callback,
  entitlement, refreshed offer, and playback authorization remain authoritative.
- Completed P4-T01 account funnel: server-confirmed password/Google `sign_up` and
  `login`, plus status-only accepted deletion after identity detachment/reset.
  Consent activation retries only the current session's pending authentication
  result; replacement cannot adopt it. Deletion receipts and profile/session data
  are not event properties, and diagnostics never control account lifecycle.
- Historical P4-T06-F1 installed-link baseline: the custom campaign parser and
  attribution properties were removed on 2026-09-02. Earlier F1/F2/#113 notes
  are superseded implementation history, not a current attribution capability.
- Planned MVP: P4-T01-F5 commerce/acquisition schemas and facts; P4-T06 minimum
  reliable source/campaign/creative attribution; P4-T02 minimum BigQuery export,
  SQL and source joins; P4-T03 daily economics report and quality checks.
- Retained P7: Looker/advanced dashboards and exports, Remote Config experiments,
  push, subscriptions and advanced deferred linking unless necessary for the first
  test. D-018 MMP stays conditional; D-017 approval precedes any paid spend.
- P6-T03: DebugView/device evidence if deferred under D-029 while collection is
  disabled and the exact validation steps remain recorded.

Never commit production exports, screenshots containing identifiers, personal
data, provider payloads, or live analytics configuration to this repository.


## MVP extension: commerce and acquisition measurement (planned 2026-09-07)

This section is the intended measurement contract for P4-T01-F5/P4-T02/P4-T03/P4-T06. The current mobile schemas may reject these new properties/events until implementation. Do not enable collection merely because a name is documented. Production collection/export requires D-020 and exact-binary legal/privacy/store approval.

| Canonical concept/event | Trigger | Authority / minimal data |
|---|---|---|
| `locked_episode_viewed` | Actual locked/paywall UI becomes visible | Client exposure diagnostic; episode/series and safe reason; no second `paywall_viewed` counter |
| `offer_presented` | Configured unlock options are shown | Client diagnostic; server-derived offered methods and policy reference, never inferred entitlement |
| `offer_selected` | Explicit user chooses an offered method | Client diagnostic; selected `rewarded_ad` or `coin`; count a logical selection once |
| `coin_pack_viewed` | Store-provided pack choice is visible | Client diagnostic; allowlisted product ID/screen context; no receipts |
| `purchase_started` | User explicitly initiates native checkout | Client diagnostic; logical attempt ID and known product; pending/cancelled are not completion |
| `purchase_completed` | Backend verifies completed known store transaction for the mapped account/environment | Authoritative backend/store fact, optionally reflected as client diagnostic; original amount/currency and transaction identity stay in restricted finance records |
| `purchase_failed` | Terminal purchase failure/cancellation is confirmed for an attempt | Diagnostic or provider lifecycle fact, with safe reason; pending has a separate state, not false failure/success |
| `purchase_refunded` | Verified provider refund/chargeback is recorded | Backend/provider fact; transaction/adjustment key, reversal amount/currency and type in restricted finance data |
| `coins_credited` | Immutable verified credit commits | Ledger fact; original transaction link, quantity, account ownership; once per fulfilled transaction |
| `coins_spent` | Atomic debit plus episode entitlement commits | Ledger fact; quantity, episode/series, policy/price, idempotent operation; no event on rollback |
| `episode_unlocked` | Verified entitlement grant commits | Backend fact; episode/series and `unlock_method=rewarded_ad` or `coin`; free playback is not an unlock |
| Ad impression/revenue fact | Provider measurement/report delivers monetizable impression or revenue adjustment | AdMob report/fact with reporting date, ad unit, currency/amount and provenance; SSV reward count is not an impression or revenue proxy |
| Acquisition cohort/spend facts | Validated attribution and network spend ingestion | Bounded source/campaign/creative, cohort/acquisition date, network report date/currency, acquired count/approved opaque join key and source provenance |

The earlier proposed `purchase_succeeded` event maps to `purchase_completed`; do not emit/count both. Reinstall or balance synchronization does not create `coins_credited`; a consumed purchase cannot be credited twice. Refund adjustments may arrive later and restate prior cohorts. Subscription `purchase_restored`/lifecycle events remain post-MVP unless a separately defined non-financial sync diagnostic is needed.

Every fact has stable deduplication identity, occurrence time, ingestion time and source/environment. Pseudonymous finance keys stay in the restricted operational/warehouse boundary, not raw client Analytics properties. Amounts/quantities do not imply that the client is allowed to mutate them. P3-T09 owns reconciliation, and P2-T02/D-020 own approved deletion versus legally necessary financial retention.

## Minimum data path and cohort attribution

Use the accepted Firebase Analytics→BigQuery export plus backend/store/provider facts, private content-cost allocation and repeatable campaign-spend imports. Versioned SQL and a daily table/report are sufficient. Full MMP, Looker, Remote Config, push and an automated royalty pipeline are not dependencies.

P4-T06 documents one acquisition definition before the test: acquisition date/time basis, chosen attribution model/window, deduplication across installs/reinstalls and permitted account linking, source/campaign/creative vocabulary and consent coverage. Use Google Play/native attribution (Install Referrer where necessary) and network spend exports at the initial scale. A controlled manual spend import is acceptable if source/date/network/campaign/creative/currency joins reproduce and reconcile. No raw URL/referrer or fingerprinting to fill coverage gaps. D-018 remains the decision when spend/ambiguity justifies an MMP.

Current analytics collect only after a signed-in account's server-confirmed consent. They cannot by themselves measure all anonymous first plays, installs or non-consented retention. Before spend, P4-T06/P4-T02 must define a lawful acquired-user denominator and sufficient measured coverage for the intended decision. Show total/attributed/consented counts separately. Use approved aggregates where possible, report unknown/unattributed groups, and hold the test if the remaining ambiguity defeats D-017's criteria. Do not make optional analytics mandatory for watching or silently repurpose guest progress IDs as advertising identifiers.

## Metric definitions (MVP)

Unless stated otherwise, evaluate a deduplicated acquisition-date cohort `C` in a declared observation window `W`, normalized to EUR with traceable original amounts. `N` is the reconciled acquired-user count for that cohort, not MAU/accounts/installs. Exposure-based product metrics use the observable/consented subset and disclose coverage. Exclude staff, generated tests, duplicate imports and known invalid traffic using documented rules, not hidden edits.

| Metric | Definition / denominator | Source and qualification |
|---|---|---|
| Spend; installs/acquired users | Actual network spend for C; distinct installs separately from deduplicated acquired N | Network billing/export + approved attribution; paid/organic/unmatched separate |
| CAC | Acquisition spend / N | Same paid cohort/window; N=0 undefined; no paid CAC claim for unpaid beta |
| First-play conversion | Distinct observable acquired users who start first eligible playback / observable acquired users | Actual-play event; report consent/attribution coverage relative to total N |
| Episode completion | Distinct episode viewers completing / viewers starting that episode | Server accepted completion/progress and governed events, declared completion rule |
| Episode continuation | Viewers starting episode n+1 / viewers starting episode n for the series/window | Respect episode availability and cohort maturity; plot the sequence |
| Lock reach | Distinct observable viewers seeing a lock / observable first-play viewers | Actual lock exposure, not a server lock response never displayed |
| D1/D7/D30 retention | Observable cohort users with qualifying app/play activity in day 1/7/30 / observable users in that fully matured acquisition cohort | Declare day boundary/timezone and qualifying event; immature windows unknown |
| Rewarded-ad acceptance | Distinct logical ad selections / logical visible ad offers | Deduplicate offer exposure/selection, exclude coin-only offers |
| Verified ad impressions/rewards | Provider-verified impressions; authentic SSV grants shown separately | Do not equate grant counts, video-complete callbacks and billed impressions |
| Net ad revenue/user | Reconciled net AdMob revenue allocated to C / N | State provider-grain allocation/coverage; never derive money from client reward events |
| Payer conversion | Distinct verified purchasers in C/W / N | Completed verified coin purchases; report fully refunded payer count separately |
| Coin-pack purchase conversion | Observable distinct pack viewers with a matched verified purchase / observable distinct pack viewers | Separately report completed-attempt/start-attempt rate and unmatched purchases |
| Coin-pack sales | Verified completed transaction/pack count and original monetary totals | Product/environment mapping; refunds/chargebacks separately reconciled |
| IAP revenue/user | Net store coin revenue allocated to C / N | Google/provider/backend facts, net of fees/tax/refund exactly once |
| ARPPU | Net store coin revenue / distinct verified purchasers in same C/W | Include originally completed but later-refunded purchasers in denominator; disclose definition; zero payers undefined |
| Refunds/chargebacks | Verified adjusted count and amount; refunded transactions / completed transactions for mature purchase cohorts | Late adjustments restate original purchase cohort; partial refunds counted once by transaction for count rate |
| Blended revenue/user | (Net store coin revenue + net ad revenue) / N | Consistent recognized/net basis, no repeat revenue at coin spend |
| Content revenue-share cost | Contract-calculated cost allocated to cohort/series, plus other content costs separately | Private finance import with recoupment/recognition basis and opaque provenance |
| Observed contribution/user | (Net store + net ads − allocated content − variable infrastructure) / N in W | Additional approved variable losses shown explicitly; see cost model |
| Contribution LTV | Projected lifetime contribution before acquisition / N | Show observation cut-off, horizon, retention/yield/cost assumptions and sensitivity |
| LTV:CAC | Contribution LTV per user / CAC | Same cohort and denominator; unknown if inputs missing or CAC zero; no invented pass/fail threshold |
| Series/campaign/creative economics | Above measures grouped/allocated where linkage supports them | Reconcile grouped sums plus residual to cohort totals; distinguish observed vs allocated/estimated |

For cross-series coin packs, attribute net recognized revenue once using a finance-approved ledger-usage allocation; retain unspent/unallocated residual. Revenue-share bases follow private contracts, not an assumed universal percentage. Never assign the entire pack to each unlocked series. Future market, currency, language and segment dimensions remain available even though only the narrow launch configuration is active.

## Reporting and validation gates

- P4-T02 tests a known synthetic cohort with free/ad/coin flows, duplicate and reordered facts, refunds after spend, missing attribution, multiple original currencies, allocation residual and immature retention. Finance totals, ledger and report must reconcile.
- P4-T03's minimum daily report shows acquisition, funnel/retention, ads, coins/refunds, content/infra, observed contribution, lifetime projection and LTV:CAC with dates, coverage and private-source provenance. A repeatable report/export is sufficient; Looker remains P7.
- Check freshness, event/transaction uniqueness, imported spend totals, join completeness, late adjustments and source-vs-report reconciliation. Missing/unreconciled inputs are unknown, not zero. Budget/quality/business holds have named owners.
- D-017 founder approval covers budget, test period and business/attribution guardrails before real spend; D-035 chooses the audience. No universal LTV:CAC threshold is invented. D-020 privacy/retention and P6 exact-candidate clearance precede real collection/export/activation.

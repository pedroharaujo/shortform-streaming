# MVP analytics contract

P4-T01 measures the ads-only viewing loop with a small, fixed event list. The
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
  entitlement database remain authoritative for reward grants.
- Unknown fields are errors in development. Production removes invalid
  optional/unknown fields and drops an event if a required value is unsafe.
- Never send email, authentication credentials, Firebase UID, signed video
  URLs, full IP addresses, payment receipts, contract references, provider
  callback data, ad bindings, SSV values, or free-form error payloads.

## Ownership and data classification

All listed IDs are opaque application IDs, classified as pseudonymous product
data when linked to a session or consented profile. App/build/platform and safe
error codes are technical data. Campaign fields are pseudonymous attribution
data. There are no direct identifiers or financial records in this contract.

Product owns discovery, playback, offer, and diagnostic definitions.
Engineering owns schema enforcement and safe error codes. The backend remains
the owner of verified rewards and access grants. Retention, region, processor
access, and deletion propagation are **pending D-020**. Production provider
transport must remain disabled until approved. Account opt-out/deletion cleanup
is implemented with the provider adapter in P4-T01-F2.

## Canonical event dictionary

Every event except `account_deleted` also includes the shared context above.

| Event                   | Exact trigger and owner                                                                             | Event properties                                                                    | Classification / authority                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `app_open`              | Product: once when a cold launch, foreground session, or approved internal deep link becomes active | launch reason; optional campaign, ad set, creative, source, medium, internal target | Product/attribution diagnostic                                         |
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

## Completed foundations and deferred work

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
- Completed P4-T06-F1 installed-link baseline: a validated custom-scheme series
  link contributes only bounded campaign/ad-set/creative/source/medium tokens and
  an internal series target to the consent-gated `app_open`. The raw URL is never
  an event property or stored value. A guarded landing asks the catalog API to
  confirm current eligibility and otherwise returns home.
- P4-T06-F2 / #113: approve the first/last-touch attribution and retention windows,
  then add Google Play Install Referrer persistence, fresh-install/deferred-link
  handling, and device evidence. Until then there is no attribution history on
  device, no referrer SDK, and no paid-acquisition-ready campaign chain.
- P7: BigQuery/Looker models, experiments, push, commerce events, and MMP.
- P6-T03: DebugView/device evidence if deferred under D-029 while collection is
  disabled and the exact validation steps remain recorded.

Never commit production exports, screenshots containing identifiers, personal
data, provider payloads, or live analytics configuration to this repository.

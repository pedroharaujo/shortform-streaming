# Rewarded ads: P3-T07

This slice implements an Android **test-only** reward path. Production remains
disabled; provider end-to-end evidence is a release blocker, not a waived check.
Tracked by [P3-T07-F1 / #96](https://github.com/pedroharaujo/shortform-streaming/issues/96).
D-005 requires login and D-007 grants one permanent episode entitlement per
verified ad. P3-T08 owns the fuller offer-sheet experience.

## Runtime and contract

- Default `REWARDED_ADS_MODE=disabled`. Local Django settings with `DEBUG=True`
  may opt into `test`; production settings reject every non-disabled value.
- Mobile requires Android and a local/staging public environment. It only uses
  Google's demo app and rewarded unit, with delayed native measurement init.
  No live ad IDs, mediation, client grant endpoint or configurable trust keys.
- POST `/v1/rewards/intents` requires Firebase authentication, current account
  ads preference, explicit `accepted=true`, eligible locked episode, and a
  UUID `request_id`. The same user/key/context returns the same intent after a
  lost response; changing the episode/context returns 409. Unknown body fields
  are rejected. Intents expire after 15 minutes.
- Two independent random bindings, `custom_data` and `ssv_user_id`, go into the
  SDK's server-side verification options. Neither is the Firebase UID. The
  client sees the exact episode reward before opting in. Fresh UMP consent
  must permit ads before SDK initialization; consent failure stops the flow.
  Non-personalized requests are not a substitute for consent.
- GET `/v1/rewards/{id}` is owner-only and no-store. Only `granted` returns to
  the player, which always obtains fresh playback authorization. SDK completion
  only starts polling. Pending retries check status without another ad.
- Privacy options remain accessible without a reward offer or an account.
  Changing account preferences alone does not edit UMP's consent record.
- GET `/v1/rewards/admob/ssv` verifies the exact raw signed query prefix with
  ECDSA/SHA-256 using only Google's fixed HTTPS public-key endpoint. Parsing is
  bounded and rejects ambiguous fields, malformed encodings, invalid bindings,
  network/unit mismatches, bad signatures, stale timestamps and expired intents.
  Key rotation is supported with a 23-hour cache and bounded unknown-key refresh.
  Key-service failure returns 503; invalid callbacks return a generic 400.

## Transactions, deletion and reconciliation

Callback transaction IDs have both a transaction advisory lock and a unique
database constraint. The existing account identity lock serializes callbacks
against preference updates and deletion, then the intent is row-locked.
Eligibility and consent are checked again at grant time. Entitlement plus minimal
verified transaction facts commit atomically. An identical delivery returns 200
without another grant; conflicting deliveries cannot write. The client cannot
name a reward value or supply a trusted completion event.

Granted status is a historical grant fact, not a playback credential. Rights,
territory, platform, publication, availability, takedown and media readiness
still apply through the existing playback-authorize path. Local account deletion
cascades reward intents and entitlements and retains the existing deletion
tombstone/revocation flow; callbacks cannot recreate a deleted profile.

For delayed callbacks, retry owner status within the intent lifetime. After
expiry, an ungranted intent cannot be redeemed. Do not grant manually from SDK
events, screenshots, logs or user reports. Provider delivery reconciliation and
production retention/cleanup require the follow-up release work; no raw provider
payload is retained to facilitate it.

## Privacy and production gates

Persist only account/episode/context, random bindings, expiry and verified
transaction ID/timestamp/grant time. Do not log bindings, signatures, callback
queries, ad payloads, auth tokens or signed media URLs. Django development access
logs strip queries. Gunicorn logs time, method, URL path, status and bytes only;
its format omits query strings, referrers, user agents and client IPs.
**Ingress/load-balancer/provider log redaction is still a production gate.**

Before any production activation, separately approve/configure UMP messages,
store disclosures, D-020 region/retention, production ad IDs, abuse/rate limits,
public callback delivery and ingress logging. Do not enable a debug backend on
public infrastructure to bypass these gates. The current shared demo unit cannot
be configured by us to deliver SSV to this backend. Synthetic signed tests verify
our implementation but do not prove Google's end-to-end callback delivery.

## Local validation and rollback

Use a dedicated local PostgreSQL database, Firebase Auth emulator and generated
catalog fixtures only. Set `REWARDED_ADS_MODE=test` in the process environment;
do not edit private `.env`. Use `EXPO_NO_DOTENV=1` for deterministic Expo checks.
Stop Metro before repository temporary-directory tests, then restart with
`CI=1` for device observation.

The adapter is pinned to `react-native-google-mobile-ads@16.0.0` (Google Mobile
Ads 24.6.0, UMP 3.2.0). Version 16.5.0 pulled Google Ads 25.4.0, whose Kotlin 2.3
metadata failed this Expo build's Kotlin 2.1 compiler. The compatible version
builds without compiler bypasses or node_modules patches. Revisit the pin only
with a native build and consent/reward checks, not just a JavaScript export.

Rollback: set backend reward mode to disabled and ship a mobile build with reward
entry disabled. Keep the additive advertising table; do not contract the schema
or revoke previously granted entitlements as a code rollback. There is no queue
to drain. Pending callbacks are rejected while disabled. Data removal/retention
is a separate authorized operation, never a migration rollback shortcut.

## Verification evidence (2026-08-31)

- Independent backend and mobile reviews completed. Both P2 findings were fixed:
  decoded callback binding validation and privacy entry independent of reward
  eligibility. Reviewers rechecked fixes with no remaining actionable findings.
- Regression failures were observed before each fix. Signed callback tests use
  fresh in-memory EC keys and replace only key-server transport; no fake verifier
  or production verification bypass exists. PostgreSQL races exercise duplicate
  callbacks, competing transactions and deletion against a pending grant.
- Native build: `expo prebuild --platform android --no-install` then
  `expo run:android --no-bundler`, with the repository JDK helper and explicit
  local public configuration: **passed**, APK installed on Pixel_9 emulator.
- `$env:EXPO_NO_DOTENV='1'; pnpm check`: **passed**. Repository tests 49;
  backend 232 (49 advertising); mobile 18 suites / 82 tests. Includes safety scan,
  governance, lint/format/types, migration drift, OpenAPI/client drift and Expo
  configuration checks. Harmless Windows pytest-cache/staticfiles warnings were
  present; no unavailable check was counted as a pass.
- `$env:EXPO_NO_DOTENV='1'; pnpm mobile:bundle:check`: **passed** Android export.
- Pixel_9 emulator with dedicated local PostgreSQL and Firebase Auth emulator:
  observed guest login gate, ads-preference-off gate and privacy entry in both
  states; opted the synthetic account into ads; followed the real locked-player
  reward entry and observed exact episode/reward disclosure before Watch test ad.
  UMP displayed the Publisher Test Ads form. Selected **Do not consent**; UMP's
  `canRequestAds` still permitted a demo request (not personalization consent).
  Observed the native **Test Ad** label, then closed the ad without following
  install links. The app polled and stayed pending. Database: **1 intent, 0
  granted intents, 0 entitlements**. A status retry showed no second ad and left
  the counts unchanged. No real callback or playback grant was fabricated.
- Device setup required IPv4-first Node DNS for Metro's localhost listener
  (`NODE_OPTIONS=--dns-result-order=ipv4first`) and a cold app restart after the
  initial bundler connection failure. `CI=1` disabled Metro file watching.
- **Blocked:** genuine Google SSV delivery, entitlement and authorized device
  playback in one journey. Shared demo ad display is not this evidence; #96
  records the approved test-configuration follow-up. Production remains off.

## Provider references

- [Google SSV verification and keys](https://developers.google.com/admob/android/ssv)
- [Google test ad units](https://developers.google.com/admob/android/test-ads)
- [React Native rewarded ads and SSV](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads)
- [UMP consent integration](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent)
- [Adapter 16.0.0 native dependency versions](https://github.com/invertase/react-native-google-mobile-ads/blob/v16.0.0/package.json)

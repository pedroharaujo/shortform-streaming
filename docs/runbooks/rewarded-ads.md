# Rewarded ads: P3-T07

This slice implements an Android **test-only** reward path. Under the founder's
2026-08-31 decision D-028, P3-T07 development acceptance is complete; PR #97 and
subsequent MVP coding do not wait for operator identity/privacy contact or the
dependent provider observation. Production remains disabled. Unobserved provider
evidence is still a release blocker, never a passed check. Remaining setup and
validation moved from #96 to
[P6-T05A / #98](https://github.com/pedroharaujo/shortform-streaming/issues/98).
D-005 requires login and D-007 grants one permanent episode entitlement per
verified ad. P3-T08 owns the fuller offer-sheet experience.

## Runtime and contract

- Default `REWARDED_ADS_MODE=disabled`. Local Django settings with `DEBUG=True`
  may opt into `test`; production settings reject every non-disabled value.
- Local test mode may explicitly set `REWARDED_ADS_TEST_UNIT_ID` to a
  publisher-owned unit for the approved #96 callback test. Unset means Google's
  demo unit. Production rejects the override, including an empty value. Intent
  creation and signed callback processing both bind to the configured unit.
- Mobile defaults to Google's demo Android app/unit in local/staging builds.
  Paired publisher IDs are allowed only in local configuration, with Android
  emulator and development-build safeguards before CMP/SDK activity. Measurement
  initialization remains delayed and emulator test-device configuration precedes
  SDK initialization. No production ad requests, mediation, client grant endpoint
  or configurable trust keys. See `mobile/README.md` for rebuild requirements.
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
- GET `/v1/rewards/admob/ssv` percent-decodes the signed query prefix once as
  UTF-8, preserving parameter order and literal plus signs, then verifies it with
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

## Temporary callback endpoint (P3-T07-F1, 2026-08-31)

The user approved a supervised temporary public **callback-only** endpoint.
This does not authorize publishing Django or changing staging ingress. At this
stage mobile still used Google demo IDs. Publisher-owned native configuration
and emulator safeguards were added in the subsequent attempt recorded below.

Run the task-owned local backend on `127.0.0.1:18000` with its dedicated synthetic
PostgreSQL database, process-only test configuration, and no request output.
Run `python backend/config/reward_callback_bridge.py` on `127.0.0.1:18081`.
Only the bridge may be tunneled. It preserves the exact GET callback query,
rejects other paths/methods/bodies, strips caller headers, and returns empty
200/400/503 responses only for accepted requests; validation failures also use
empty fixed status responses. It never forwards bodies, headers, or redirects
from Django. No admin/API route, debug page, auth header, or cookie is exposed.

The bridge serializes requests, limits forwarding to 30/minute, bounds headers
and query size, interrupts client/upstream sockets at absolute deadlines, and
expires within one hour. Supervise and stop the tunnel/backend process trees too;
on Windows the Python launcher can have a child process. Do not leave a tunnel
running after bridge expiry or activate automatic restart. Rollback stops these
task-owned processes; it does not change production, staging, or any schema.

Before sending real callbacks through ngrok, confirm full capture is disabled,
there are no log exports, and the agent runs with `--inspect=false --log=false`.
Probe using harmless markers first and inspect cloud **request details**: the
request URL/query, headers, body and captured bytes must be absent. A path-only
table view is not sufficient. Cloud path/status/network metadata remains subject
to the account's retention window; this is not a production privacy approval.

Observed during this session: matching ngrok account/endpoint, full capture
disabled, no configured log exports, local captured requests zero. The cloud
probe detail displayed no Request URL, URL Length 0, Headers Captured 0 and
Captured Bytes 0; raw display contained method/path/host only. Cloud metadata
retention was one day. Public probes returned empty no-store 404 for admin and
intent routes, and 503 for the callback while its backend was disconnected.
No genuine callback or binding was used to test logging.

After connecting the dedicated synthetic backend, public probes returned empty
no-store 400 for an unsigned callback, 404 for admin/intent routes and 405 for
POST to the callback. The one-hour process supervisor shuts down the tunnel,
bridge and backend together. The live address is session-local, not committed.

Validation: `$env:EXPO_NO_DOTENV='1'; pnpm check` **passed**: repository 49,
backend 279, mobile 18 suites/82 tests, including contract/config/type/lint gates.
Independent bridge and publisher-configuration review found one timeout P2;
its drip-fed upstream regression failed before the fix and passed afterward.
Reviewer rechecked with no remaining P1/P2; independent bridge/settings run:
50 passed. No native publisher-unit ad or genuine Google grant is claimed yet.

## Dashboard verification diagnosis (P3-T07-F1, 2026-08-31)

The first genuine dashboard request returned 400. Metadata-only diagnostics
identified an ECDSA input-encoding defect: Google's signature verified against
the percent-decoded UTF-8 prefix, not the raw URL-encoded prefix. The verifier
now matches Google's reference `URI.getQuery()` behavior: decode percent escapes
once, preserve literal plus signs and parameter order, and verify with the same
fixed Google key source. Do not decode twice or use form-style plus conversion.
The bridge still forwards the original query unchanged. No provider request,
signature, or binding was recorded in diagnostics or committed fixtures.

The corrected genuine signature then passed, but the dashboard supplied a
placeholder ad unit rather than the configured publisher unit. The unchanged
reward service correctly rejected that mismatch. Dashboard setup therefore uses
a session-only local challenge handler, not a reward intent: both random
bindings, Google signature, placeholder unit, timestamp and short expiry must
match before an empty acknowledgement. It cannot grant or modify application
data. Normal callbacks retain the existing handler and exact unit binding.
The temporary challenge expires within the original supervisor lifetime; remove
the override and restore the normal backend immediately after saving the URL.
This is transport/signature setup evidence only, never proof of a completed ad,
an entitlement or device playback. The original synthetic intent grants nothing.

The callback API regression failed twice before the encoding fix and passed
afterward. Its generated fixtures now cover spaces plus a reward name containing
a literal plus, UTF-8 and an encoded percent sequence. Advertising tests:
`uv run pytest backend/tests/advertising -q` **85 passed**. Independent review
found no P1/P2 and independently passed 12 generated encoding/ambiguity checks.
The temporary launcher's isolated tests passed 10 cases, including bad signatures,
partial bindings, wrong units, expiry, future timestamps, disabled/production
mode and normal-handler fallback; no application database access was allowed.

Observed result: AdMob displayed successful URL verification. Applied the
verified URL and saved it on the development rewarded unit; mediation-wide
verification remained unchecked. The challenge reported a valid Google
signature and no grant attempt. Read-only database checks confirmed zero
entitlements, no intent for the setup challenge, and no grant for the original
synthetic dashboard intent. The supervisor then restarted the normal backend
without the diagnostic/probe launcher, retaining its original shutdown deadline;
the temporary binding files were removed. Unsigned HTTP probes returned 400
at the backend, bridge and public endpoint; bridge/public bodies were empty
with no-store. The original grant service and configured-unit check are unchanged.
After these checks, the temporary tunnel/bridge/backend were stopped. Start a
new supervised test window before native publisher-unit testing; a saved AdMob
callback URL does not keep the local endpoint running.

Final `$env:EXPO_NO_DOTENV='1'; pnpm check` **passed**: repository 49, backend
280, mobile 18 suites/82 tests, including the regenerated OpenAPI/client contract
and all lint/type/config checks. The first full run correctly stopped at contract
drift after regenerating the revised API description; staging those generated
artifacts and repeating the complete gate passed. Independent temporary-probe
review found no P1/P2 and repeated all 10 isolated checks successfully.

## Native publisher attempt (P3-T07-F1, 2026-08-31)

The user approved continuing with the development Android app and rewarded unit.
The native configuration now accepts a validated same-publisher pair only in
the local environment. Defaults remain Google's demo pair. Publisher attempts
require Android, `__DEV__`, and `expo-device.isDevice === false`; physical,
unknown, release, staging and production contexts fail before CMP/SDK activity.
Set the emulator test-device configuration before SDK initialization. UMP,
account preference, session freshness and exact server-selected unit checks
remain mandatory; no client grant or signature bypass was added.

- `expo prebuild --platform android --no-install` then
  `expo run:android --no-bundler`, via the repository JDK helper and process-only
  local variables: **passed**, installed on Pixel_9. Checked emulator identity,
  embedded app ID matching the supplied configuration and delayed measurement.
- Reused an existing generated three-second portrait clip, without uploading
  media. Provider readiness checked in memory; unsigned and expired access both
  returned 403, valid signed HLS returned 200. Only the dedicated synthetic
  database's media fixture changed. This is not native post-reward playback proof.
- Started Firebase Auth emulator, local Django, Metro and the callback-only
  bridge/tunnel within one supervised test window. No dashboard probe override.
  Public unsigned callback returned empty no-store 400; admin returned empty
  no-store 404. Tunnel inspection remained off, captured requests zero.
- Native locked-player entry showed the episode reward. Synthetic account ads
  preference was on and analytics off. Tapped **Watch test ad** once. UMP reported
  publisher misconfiguration because no form was configured for the app ID;
  the UI showed the safe consent/ad-service error. AdMob's European regulations
  page also showed first-message setup. No publisher test ad was displayed.
- Post-failure read-only database observation: **0 intents, 0 verified
  transaction records, 0 grants, 0 entitlements**. Preparation failed before
  intent creation. No callback, reward or playback result was fabricated.
- **Next setup blocker:** configure a European regulations message for only the
  development app, with its approved public privacy-policy URL. No approved URL
  was found in the repository. Do not invent legal terms, reuse unrelated apps'
  policies, bypass UMP or enable account-wide automatic messages. Production
  disclosure/D-020 approval remains separate. The message has not been published.
- Independent mobile/config review found no P1/P2. A separate review found an
  orphan-process cleanup issue in the temporary Windows supervisor. Enrolling
  the supervisor in a kill-on-close Windows Job before spawning children fixed
  it; two isolated normal-exit/crash cases passed, and re-review approved it.
- `$env:EXPO_NO_DOTENV='1'; pnpm check`: **passed**, repository 49, backend 280,
  mobile 18 suites / 90 tests, including lint/format/types/migrations, API contract
  and Expo configuration gates. `$env:EXPO_NO_DOTENV='1'; pnpm mobile:check`
  also passed. Known Windows cache/staticfiles warnings were non-failing.
- Stopped the temporary supervisor and all five test-service ports were closed.
  The saved callback URL needs a new bounded service window before the next
  attempt; leaving it saved does not leave a server running.

At this attempt, a completed publisher Test Ad, genuine Google SSV, one entitlement
and fresh authorized Android playback had not been observed. This remains true.
D-028 subsequently moved that requirement and operator/privacy setup to release
issue #98; #96 is superseded and P3-T07 development acceptance is complete.
Consent setup still blocks a publisher-owned ad test, and #98 must pass before
public/production activation. No notice, consent message or production mode is
enabled by this scope decision. The earlier evidence sections are historical.

## Provider references

- [Google SSV verification and keys](https://developers.google.com/admob/android/ssv)
- [Google reference signature verifier](https://github.com/tink-crypto/tink-java-apps/blob/main/rewardedads/src/main/java/com/google/crypto/tink/apps/rewardedads/RewardedAdsVerifier.java)
- [Google test ad units](https://developers.google.com/admob/android/test-ads)
- [React Native rewarded ads and SSV](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads)
- [UMP consent integration](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent)
- [Create an AdMob European regulations message](https://support.google.com/admob/answer/10113207)
- [Required app privacy-policy URL](https://support.google.com/admob/answer/10113106)
- [Adapter 16.0.0 native dependency versions](https://github.com/invertase/react-native-google-mobile-ads/blob/v16.0.0/package.json)

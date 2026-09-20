# First hands-on Android journey

**Decision:** D-036, founder approved 2026-09-13.
**Tasks:** P2-T08, P3-T03, P3-T04 and P3-T06.
**Tracking:** [issue #164](https://github.com/pedroharaujo/shortform-streaming/issues/164).

The next checkpoint is an app the founder can use: choose a series, watch a free
episode, sign in with Google, buy a test coin pack through Google Play, unlock the
next episode and keep watching. Reuse the existing services and screens. D-037 now defers rewarded ads until after MVP. Required coin economics and
applicable public-release requirements remain.

## What exists and what is missing

The Android catalog, native HLS player, progress/resume/autoplay, Google sign-in,
wallet and episode-unlock screens exist. Django Admin manages catalog and media.
PostgreSQL owns account, wallet and access records; Bunny delivers the video.

The app now includes an opt-in Buy coins screen and RevenueCat Android adapter,
with [server verification and known-result recovery](revenuecat-sandbox.md).
Checkout defaults to disabled until the Play license-test setup is verified.
Account/app/product checks protect once-only credit. A separately enabled
[sandbox notification handler](revenuecat-sandbox.md#sandbox-notifications-while-the-app-is-closed)
can verify credits while the app is closed and preserve signed-refund review.
Its genuine-provider setup and delivery remain unchecked. Unknown-result
interruption recovery, full lifecycle and device evidence remain open.

## Bring up the existing viewing experience

Engineering runs these commands from the repository root. Existing private local
configuration is required; never put its contents in Git or screenshots.

1. Start Docker Desktop, then `docker compose up -d --wait postgres`.
2. With the local `.env` pointing at the local database, run
   `uv run --env-file .env python backend/manage.py migrate` and then
   `uv run --env-file .env python backend/manage.py runserver 127.0.0.1:8000`.
3. Start `firebase emulators:start --only auth --project <local-firebase-project>`
   using the same non-production project as the app and backend. The backend
   uses `FIREBASE_AUTH_MODE=admin` and
   `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`; keep the Auth emulator on loopback.
4. Run `pnpm mobile:android` after `uv run python scripts/start_android_avd.py`.
   The existing Android emulator configuration uses `http://10.0.2.2:8000` for
   the backend and `http://10.0.2.2:9099` for local authentication.
5. Inspect the existing catalog before running any seed command. For the playable
   check, create a separate generated test series and episodes in Django Admin,
   then use its existing upload/processing workflow with generated or approved
   self-owned video in the non-production Bunny library. Publish only when the
   media and eligibility checks pass. Do not reset existing titles or uploads.
   `seed_catalog` is only a metadata fixture: its fake URLs are **not playable
   media**, and its READY fake assets prevent uploading another master into those
   episodes. Keep that fixture separate from the playable test series. Repeat
   seeding now preserves existing operator edits and media rather than replacing
   them.

If the emulator is listed as unauthorized, approve its debugging connection in
the emulator and confirm `adb devices` reports `device`. A physical USB phone
needs explicit connection setup; it cannot use the emulator-only `10.0.2.2`
addresses as-is. Do not open the local database or Auth emulator to the LAN.

On Windows, if Metro starts but only listens on IPv6 `::1`, stop that Metro
process and run this from `mobile/` to make the installed debug app's port 8081
reachable by the Android emulator:

```powershell
$env:NODE_OPTIONS='--dns-result-order=ipv4first'
node ../node_modules/expo/bin/cli start --dev-client --localhost --port 8081 --max-workers 2
```

Open Shortform normally in the emulator. The installed debug APK used in the
2026-09-13 check used port 8081; passing a different port in a development-client
deep link did not redirect it. Confirm `http://127.0.0.1:8081/status` responds
before troubleshooting the app's backend connection.
Two Metro workers also leave memory available for the emulator during native
builds. If startup reports missing Expo manifest settings, follow the native
rebuild steps in [mobile/README.md](../../mobile/README.md#missing-expo-manifest-settings-on-startup).

## Finish genuine test checkout

### Google sign-in and account restart

Use the existing non-production Firebase project and Android app. The app's
private `google-services.json` must contain a web OAuth client (type 3), the
matching Android OAuth client and the installed development certificate. Enable
Google in Firebase Authentication, register that certificate, download the
updated configuration and rebuild the APK. Keep configuration and account
details out of Git and public screenshots. See [mobile identity setup](../../mobile/README.md#identity).

Issue #175 keeps Firebase Auth independent from the API location so genuine Google
login can use the local backend alongside separately gated Play sandbox checkout.
Engineering uses one of these setups, keeping all other feature flags unchanged.
For generated local accounts, run the Auth emulator for the same test project:

```dotenv
# mobile/.env: generated local accounts, historical default
EXPO_PUBLIC_API_ENVIRONMENT=local
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_FIREBASE_AUTH_MODE=emulator

# Backend .env for the generated-account Auth emulator
FIREBASE_AUTH_MODE=admin
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

For genuine Firebase Google login:

```dotenv
# mobile/.env: genuine Google login against the same local API
EXPO_PUBLIC_API_ENVIRONMENT=local
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_FIREBASE_AUTH_MODE=cloud

# Backend .env: same non-production project as google-services.json
FIREBASE_AUTH_MODE=admin
FIREBASE_PROJECT_ID=replace-with-test-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/private/shortform/firebase-auth-verifier.json
# FIREBASE_AUTH_EMULATOR_HOST must be absent, including inherited process environment.
```

The example credential path is fictional. The actual file stays outside the public
repository and is server-only, separate from the RevenueCat Play credential; never
put it in `EXPO_PUBLIC_*`. Keep Firebase Admin `check_revoked=True`. A normal gcloud
application-default login is not sufficient Firebase Auth setup; follow the
[Firebase setup requirements](https://firebase.google.com/docs/admin/setup#testing_with_gcloud_end_user_credentials).
A scoped verifier needs `firebaseauth.users.get` for the
[account lookup](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup).
Its safe preflight is a generated nonexistent-UID lookup returning `UserNotFoundError`,
recorded only as category-level evidence. This does not establish completed login,
authenticated wallet access or genuine token verification.

The app has no `expo-dev-client` or Expo Updates integration: Expo Constants reads
the APK's embedded `assets/app.config`. Every auth mode change requires rebuilding
and installing the APK, preserving the existing debug certificate and app data,
then starting the updated app in a fresh process. Metro reloads and process
restarts alone cannot change the installed mode. Gradle regenerates the embedded
`extra` settings during the build, so this setting alone does not require Expo
prebuild. Older APKs without the native guard reject auth until rebuilt. Missing
old-manifest auth settings retain historical defaults; present malformed settings
fail. Emulator mode is allowed only with a local API; cloud with a local test API
does not activate production.

Before closing #175, engineering must verify the native claim survives a full
JavaScript reload. This is a native guard check, not a manifest-change procedure:

1. Start an APK with a known embedded auth mode and let the application claim
   that mode at startup. Record the OS process ID without account/provider data.
2. In React Native DevTools, set a breakpoint on the first statement of
   `attachLocalAuthEmulator`, then perform a full JavaScript reload. Confirm the OS
   process ID is unchanged.
3. At the **first post-reload invocation**, before the application claims again,
   use these native-only calls for an installed emulator build:

   ```javascript
   globalThis.expo.modules.AndroidGoogleWebClient.claimFirebaseAuthMode('cloud'); // false
   globalThis.expo.modules.AndroidGoogleWebClient.claimFirebaseAuthMode('emulator'); // true
   ```

   For an installed cloud build, call with `'emulator'` first (expect `false`),
   then `'cloud'` (expect `true`). Do not read Firebase accounts or change SDK
   configuration in the debugger. Resume only when both results match; otherwise
   stop and record the failed guard check.
4. Rebuild and install an APK with the opposite embedded mode through the
   authorized install/start workflow, retaining the debug certificate and app
   data. Start a fresh process and repeat steps 1–3. Restore the intended mode
   through the same rebuild/install workflow.

This proves native process lifetime in both directions and complements the
adapter tests that reject a conflict before SDK/cache access. Failed auth must not
clear the claim. Separately verify fresh-process emulator behavior and genuine
Google login with Account and Coin wallet. Record sanitized outcomes only; a
reload is not process termination. Do not bypass an approval-review denial of
`adb` force-stop/start through another route. These observations remain unchecked
until performed; the acceptance list below remains authoritative.

The 2026-09-13 test-project setup now has Google enabled and the development
certificate registered. The matching private configuration was downloaded,
verified, rebuilt and installed without clearing app data. The emulator has no
Google account yet. Its Google button now reaches the native Google account-entry
screen, and cancelling returns to the app without an error. Completing sign-in
still requires a test account. These test settings do not approve a public support contact or production
identity configuration.

Issue #171 adds restoration of the persisted native account at startup and
refreshes expired tokens before authenticated API requests. Initial auth waits
are bounded; failure allows anonymous browsing. Restoration does not enable
analytics consent. Sign-out and account changes prevent an old request from
using a new account's credentials, including while app verification is pending.
Repeated device sign-out succeeds only after native cleanup or Firebase's exact
already-empty result; real cleanup failures keep their retry path.

To validate, sign in with a generated local account and open its wallet. Close and
reopen the app, open Account and Coin wallet, and confirm the same account is
available without another login. Sign out, reopen and confirm protected screens
require sign-in while the catalog remains browsable. Do not treat an app reload
alone as evidence of OS process termination, token expiry or genuine
Google-provider behavior.

On 2026-09-13, a generated local account signed in, opened Account and a zero-coin
wallet, and regained those screens without another login after a development
reload. Signing out cleared the protected wallet; anonymous Account after reload
offered sign-in without the former false device-cleanup error. These observations
use the Auth emulator. OS process termination and real-provider token expiry
remain unchecked in [final validation](final-validation.md).

Generated media also passed Android progress/resume: native controls paused the
second 12-second test episode at seven seconds, Close persisted position 7, and
reopening showed the baked-in timecode at 8.542 seconds only 4.47 seconds after
pressing Play. This demonstrates resuming rather than starting at zero. Earlier
account playback saved progress as well; the resume observation used the
anonymous device session. No database checkpoint was manually overwritten.

### Store checkout prerequisites

Engineering has connected the native adapter, coin screen, server verification,
known-result recovery and return to the locked episode. Server balances and fresh
playback authorization remain authoritative. An interruption before the native
order fingerprint is saved still requires exact resolution; it blocks recharging.

External setup requires the non-production Google Play/RevenueCat app connection,
a test consumable product and a Google Play license tester. Confirm their status
with the founder and configure sensitive values privately. A synthetic fixture
quantity is not an approved commercial pack or price. Real purchases remain
disabled pending the existing commercial and release approvals.

## Acceptance on Android

Record device/build and safe outcomes only. Never capture account details,
credentials, signed media URLs, provider payloads or licensed frames as evidence.
The full checkpoint remains incomplete until the genuine test checkout works.

- [x] Browse the prepared series and actually play a free episode (Pixel 9
      emulator, generated test series, 2026-09-13).
- [x] Resume mid-episode and continue to the next free episode (generated clips,
      Pixel 9 emulator, 2026-09-13).
- [ ] Sign in with Google and return to the selected locked episode.
- [x] Display a Google Play test product with the store-provided price (2026-09-20,
      100 test coins at EUR 0.99; unified Coins screen).
- [x] Complete a license-tester purchase and observe verified server coin credit
      (2026-09-20; explicit no-charge test card, one purchase/decision/100-coin
      ledger entry; repeated server verification/recovery added no credit).
- [x] Spend generated test coins once and authorize the unlocked episode on
      Android (2026-09-13).
- [x] Spend a genuine Play-test-funded coin and play the unlocked episode
      (2026-09-20; founder-approved local episode-2 price of 1 test coin;
      balance 100 → 99, one debit/receipt/entitlement, generated clip played
      through its end; reopening playback created no further debit).
- [x] Cancel checkout without additional purchases or coin credits (2026-09-20;
      Android Back from Google Play's review-and-agree sheet returned explicit
      cancellation feedback, cleared the pending marker, restored package
      selection and retained 199 coins/two purchase credits).
- [x] Buy the same consumable pack again after consumption (2026-09-20;
      two genuine sandbox purchases produced exactly two 100-coin credits,
      with the existing one-coin unlock debit retained).
- [x] Recover a completed purchase after restarting the app (2026-09-20;
      backend stopped during no-charge payment, native result retained,
      app force-stopped, backend restored and app cold-launched; Check purchase
      credited exactly 100 coins, balance 199 → 299, and cleared the pending marker).
- [ ] Verify interruption before the native purchase result is saved.
- [x] Credit a genuine no-charge purchase while the app is stopped after a local
  server outage, then cold-launch and recover without a second credit
  (2026-09-20; manual RevenueCat redelivery, 399 coins / four purchase credits).
- [x] Receive a genuine signed sandbox refund, preserve review through repeated
  verification, and show that review in Recent purchases (2026-09-20; no
  unapproved debit or entitlement removal; commercial settlement still open).
- [ ] Keep an unlocked episode available to the same account after sign-in;
      prevent access by another account or after a content takedown.

Automated authorization and financial-integrity tests remain required before
merge. Device/provider observations stay unchecked until observed, following
D-029; none of the steps above is evidence of public-release readiness.

## Local observation, 2026-09-13

PostgreSQL is healthy, existing migrations were applied, the backend readiness
and catalog endpoints returned HTTP 200, and the local Firebase Auth emulator
started. The initial upload attempt returned HTTP 401. A subsequent read-only
check succeeded and both generated 12-second animations uploaded, processed and
passed normal publication gates. The separate "Android playback check" series is
now published in the local database. Both episodes appear in the catalog,
authorize free playback, and return HTTP 200 for signed master and variant HLS
playlists. Unsigned and expired playlist requests return HTTP 403. These are
generated assets; no older titles or approval states were changed.

This proves catalog eligibility and protected media delivery; on-device playback
and the genuine-purchase checklist above remain unchecked until observed.

After correcting Metro's IPv4 binding, the installed app launched successfully,
Metro bundled 1,700 modules and reported one connected native debugger target.
The backend, Auth emulator and Metro were left running for the next check.
No visual catalog inspection, Google sign-in or video-playback proof is claimed
by this application-start observation.

The founder then reported a render failure: the installed August 31 APK lacked
`extra.analytics.enabled`; it also lacked `extra.appCheck.mode`. A native rebuild
was necessary. The rebuild exposed a compiler mismatch with Google Mobile Ads
25.4. The committed Expo configuration now selects Kotlin 2.3.20 and applies the
same version to the root compiler dependency. The Android x86_64 debug build
passed and was installed on the Pixel 9 emulator without clearing app data.
The packaged configuration contains both settings. After restarting Metro with
two workers, a cold launch rendered `home-screen`, `home-empty` and `home-sign-in`
in the Android UI hierarchy, with neither missing-setting error present. This
verifies home-screen rendering; the viewing and purchase checklist remains open.

The subsequent checkout development build includes RevenueCat 10.9.1 and passed
Android x86_64 compilation (482 Gradle tasks). It was installed without clearing
app data. The Pixel 9 emulator rendered `home-loaded`, opened the generated
"Android playback check" series from its catalog card, and rendered the native
player's generated color/timecode pattern. Opening episode 1 continued to
"Playback check 2" with decoded frames visible at the end of the 12-second clip.
This establishes free playback and next-episode continuation; mid-episode resume,
Google sign-in and actual test checkout were still unchecked at this point. Purchase configuration
was left disabled; no store purchase or provider lifecycle result is claimed.

Issue #173 added account-owned Wallet recovery for an interrupted coin unlock.
The founder confirmed the generated 4-coin unlock in the emulator; server records
showed balance 13 → 9, one debit and one receipt, followed by successful fresh
playback authorization. This was spending generated coins, not buying coins
through Google Play.

The updated development JavaScript passed direct Wallet recovery after a reload
and catalog removal for both simulated pre-debit failure and lost post-debit
response. Cancellation retained all 13 coins and blocked the delayed original
request with HTTP 409 even after the episode was republished. Completed recovery
retained one debit/receipt and balance 9; the unpublished episode offered no Play
action. Switching accounts hid the other owner's recovery and returning restored
it. Old per-episode records were recoverable through their known route, then
discoverable from Wallet after import. Unseen old keys cannot be enumerated.

After these checks, the generated episode's original free/published configuration
and the normal local backend were restored. Coin spending and purchases are
disabled again; immutable generated accounting was retained. The founder's test
account still has 9 coins. See [coin-wallet evidence](coin-wallet.md) for exact
observations. OS process death, genuine Google sign-in and store purchase/refund
observations remain open; no production activation is approved by these checks.

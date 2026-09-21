# Android mobile app

Expo SDK 57 / React Native development client for the Android-only MVP. Expo Go
is unsupported because Firebase Auth, App Check, Analytics, Google Sign-In, AdMob, and the
native video player require native modules.

The 2026-09-07 MVP strategy adds Google Play/RevenueCat coins and minimum
acquisition/LTV:CAC measurement; implementation remains planned under P3/P4.
Existing native module/configuration instructions below describe current code,
not a completed coin client. Apple/iOS and subscriptions stay post-MVP.

## Public configuration

`app.config.ts` requires these values in `mobile/.env`:

| Variable                      | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_ENVIRONMENT` | `local`, `staging`, or `production`                                |
| `EXPO_PUBLIC_API_BASE_URL`    | Absolute backend URL; Android emulator uses `http://10.0.2.2:8000` |

Current code enforces France, Android and English server-side; no client market
setting may override eligibility. D-034/P2-T03-F3 plan active launch configuration
with generalized market/language/segment/rights dimensions and no extra MVP UX. Never place secrets in `EXPO_PUBLIC_*`; they are compiled
into the public JavaScript bundle.

The P6-T01 mobile-quality foundation keeps English interface copy in
`src/localization/messages.tsx` and semantic visual/touch-target values in
`src/ui/theme.ts`. The catalog-selection, sign-in, account, and playback journeys use
these foundations; remaining feature surfaces are tracked in P6-T01 and must not add
new hard-coded user copy.

Optional release switches:

| Variable                             | Behavior                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `EXPO_PUBLIC_REWARDED_ADS_MODE`      | `disabled`, `test`, or `production`; production defaults to disabled   |
| `EXPO_PUBLIC_ANALYTICS_ENABLED`      | `true` or `false`; production defaults to false                        |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`   | Required with a non-demo rewarded unit when production ads are enabled |
| `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID` | Must use the same AdMob publisher as the Android app ID                |

Production ads require explicit build configuration and release approval.
Analytics also requires the later release implementation: the current production
consent adapter is a no-op even with a public build switch.
Ad requests also require consent, and rewards are granted only after the backend
verifies AdMob server-side verification callbacks.

## Identity

The MVP offers email/password and Google Sign-In. Catalog and free playback work anonymously;
an account is required for persistent rewarded-ad unlocks; planned MVP coin
purchases/unlocks use the same trusted-account boundary. Django trusts
only verified Firebase ID tokens and never accepts client user IDs.

Use a non-production Firebase project. For Google Sign-In, enable the Google
provider, register the existing Android debug certificate's SHA-1, and place its
downloaded `google-services.json` at `mobile/google-services.json` (gitignored).
It must include the web OAuth client (type 3) and matching Android client.

Issue #175 / D-036 separates Firebase authentication from the API location.
`EXPO_PUBLIC_FIREBASE_AUTH_MODE` accepts only `emulator` or `cloud`. When omitted,
local APIs keep emulator Auth and staging/production APIs keep cloud Auth. Emulator
Auth is rejected with nonlocal APIs. Checkout settings never choose the auth mode.

For generated local accounts, start `firebase emulators:start --only auth --project
<local-firebase-project>` with the same test project as the app and backend:

```dotenv
# mobile/.env: generated local accounts, historical default
EXPO_PUBLIC_API_ENVIRONMENT=local
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_FIREBASE_AUTH_MODE=emulator

# Backend .env for the generated-account Auth emulator
FIREBASE_AUTH_MODE=admin
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

For genuine Google sign-in against the same local API:

```dotenv
# mobile/.env
EXPO_PUBLIC_API_ENVIRONMENT=local
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_FIREBASE_AUTH_MODE=cloud

# Backend .env: same non-production project as google-services.json
FIREBASE_AUTH_MODE=admin
FIREBASE_PROJECT_ID=replace-with-test-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/private/shortform/firebase-auth-verifier.json
# FIREBASE_AUTH_EMULATOR_HOST must be absent, including inherited process environment.
```

The credential path above is fictional. Use a private server-only credential file
outside this public repository; it is separate from the RevenueCat Play credential
and must never enter `EXPO_PUBLIC_*`. Keep Firebase Admin `check_revoked=True`.
A normal gcloud application-default login alone is not sufficient Firebase Auth
setup; see [Firebase's setup requirements](https://firebase.google.com/docs/admin/setup#testing_with_gcloud_end_user_credentials).
Engineering can preflight a scoped credential's `firebaseauth.users.get` permission
with a generated nonexistent-UID lookup returning `UserNotFoundError`; record only
the result category, never account or provider data. That preflight does not prove
genuine Google sign-in or token verification.

This app has no `expo-dev-client` or Expo Updates integration. Expo Constants reads
the configuration embedded in the APK's `assets/app.config`; Metro reloads and app
restarts alone cannot change that configuration. Rebuild and install the Android
development APK for each auth mode change, preserving its existing debug
certificate and app data, then start the updated app in a fresh process. Gradle
regenerates the embedded `extra` settings during the build; changing only the auth
mode does not itself require Expo prebuild. An older APK without the native guard
rejects both modes until rebuilt.

The process retains its first native mode claim across JavaScript reloads,
including after auth failures, and rejects an opposite claim before Firebase
access. The guard is Android-only; this is not an iOS process-lifetime guarantee.
Keep purchases, ads, analytics and App Check at their existing settings. Cloud
Auth against a test project does not activate production. Follow the
[Android journey](../docs/runbooks/android-first-journey.md#google-sign-in-and-account-restart)
for the separate native reload-guard and real-provider observations.

Jest uses the email/password-and-Google local mock and never loads native Firebase modules.

## App verification

When `EXPO_PUBLIC_FIREBASE_APP_CHECK_MODE=enforce`, every app API request obtains
a Firebase App Check token on demand and sends it only in
`X-Firebase-AppCheck`. Development builds use the debug provider; release builds
use Play Integrity. The switch defaults to `disabled` until private provider
validation passes. No debug token belongs in JavaScript or `EXPO_PUBLIC_*`.
Backend enforcement and Cloud Run configuration remain disabled until the private
provider/device procedure in `../docs/runbooks/app-check.md` passes.

## Local run

From the repository root:

```shell
make start-sql
make start-backend
uv run python backend/manage.py seed_catalog
make emulate
```

The seeded catalog contains one synthetic self-owned series. Staff upload masters
through Django Admin; the ingestion workflow submits them to the selected provider,
tracks readiness, and performs provider takedown.

### Missing Expo manifest settings on startup

If startup reports `Expo manifest is missing extra.analytics.enabled` (or
`extra.appCheck.mode`), the installed Android build predates those settings.
Restarting Metro only refreshes JavaScript; this debug app reads its embedded
Expo configuration. Stop the current Metro process, then regenerate and reinstall
the native build from the repository root, with the emulator running and private
local configuration in place:

```shell
pnpm --filter @stovio/mobile exec expo prebuild --platform android --no-install
pnpm mobile:android
```

The prebuild step is needed when native plugins or generated project settings
change. For an `extra`-only change such as Firebase auth mode, Gradle regenerates
`assets/app.config` when building the APK; rebuild and reinstall without an
otherwise unnecessary prebuild.

The Android command starts Metro. Rebuilding preserves app data; do not clear storage or
replace missing configuration with permissive defaults. The committed
`expo-build-properties` plugin selects Kotlin 2.3.20 because Google Mobile Ads
25.4 includes Kotlin 2.3 metadata. `plugins/withKotlinCompiler.js` connects the
generated root compiler dependency to that same version property; Expo 57's
template otherwise inherits React Native's older compiler. Keep these settings
in the Expo configuration, since prebuild regenerates the ignored native Android
directory.

## Hosted Android test release

P5-T05-F4 / #121 prepares the existing Android app for the approved hosted test
journey. Use [`mobile/staging.env.example`](staging.env.example) as the public
build configuration, supplying the approved permanent Cloud Run HTTPS service
URL and the existing RevenueCat public Google SDK identifier privately. Keep the
existing Android package, Firebase configuration and Play product registry; this
example creates no new provider app or prices. Server credentials never belong
in these values.

Staging allows `revenuecat_sandbox` with release JavaScript (`NODE_ENV=production`,
`__DEV__=false`). Local checkout still requires a development build. Production
checkout, synthetic staging checkout and nonlocal purchase previews stay disabled.
The backend must independently verify every SANDBOX transaction before crediting
coins; the client switch does not grant a balance or make a real payment a test.

Before distributing a signed Android release through the existing Play internal
test process, register the release/app-signing certificate with the same Firebase
app, validate Google sign-in and Play Integrity App Check, and enroll the exact
Google Play account as a license tester. The purchase sheet must show a Google
test payment method with no charge; cancel if it offers a real payment method.
The app keeps Google Play's displayed prices and warns testers before checkout.
App Check remains enforced, ads and analytics stay disabled in this example.

Build and install a new signed release with embedded JavaScript and these frozen
settings; it runs without Metro or the founder's computer. Live service activation,
signing/distribution and the real-device test are separate release gates, not
outcomes established by Jest or the JavaScript bundle check. Do not commit signing
material, `google-services.json`, private provider configuration or build output.

## Checks

```shell
pnpm mobile:lint
pnpm mobile:format:check
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:config:check
pnpm mobile:bundle:check
```

The configuration check proves that production switches fail closed and no
credential-shaped public value reaches the Expo manifest. The bundle check emits
only an Android JavaScript bundle; native/store validation remains a release gate.

## MVP routes

- `/` — the single-series catalog
- `/series/[id]` and `/episodes/[id]` — discovery and episode selection
- `/play/[id]` — vertical HLS player with progress
- `/reward/[id]` — rewarded-ad unlock
- `/sign-in` and `/account` — email/password or Google identity, consent, sign-out, deletion

Developer-only health and playback-spike screens were removed. Backend health
remains available to infrastructure at `/health/live` and `/health/ready`.

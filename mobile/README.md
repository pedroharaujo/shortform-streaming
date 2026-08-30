# Mobile application

Expo SDK 57 / React Native development client for Shortform Streaming. Ads-only MVP
ships **Google Play / Android only** (D-027). Expo Go is not a supported target
(ADR 0003): native modules require an Android **development build**.

Configuration lives in `app.config.ts`. There is no `app.json`.

## Environment

The resolver in `app.config.ts` reads only these public variables and refuses to build if any is missing or invalid. There is no default environment.

| Variable                        | Allowed values                       | Purpose                                                  |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `EXPO_PUBLIC_API_ENVIRONMENT`   | `local`, `staging`, `production`     | Explicit environment name                                |
| `EXPO_PUBLIC_API_BASE_URL`      | Absolute `http`/`https` origin       | Backend origin used by catalog and health clients        |
| `EXPO_PUBLIC_CATALOG_TERRITORY` | ISO 3166-1 alpha-2, for example `FR` | Catalog `X-Territory`. Never inferred from device locale |

**Never put a secret, key, token, or credential in an `EXPO_PUBLIC_*` variable.** Those names are inlined into the public JavaScript bundle. Keep secrets on the backend.

Copy the three `EXPO_PUBLIC_*` lines from the repository-root `.env.example` into `mobile/.env` (gitignored). Expo CLI loads `mobile/.env` automatically. A populated `.env` must never be committed. Catalog language is frozen to `en` in code (D-002) and is not an environment variable.

Local hostname from the Android emulator:

- Android emulator → `http://10.0.2.2:8000` (`10.0.2.2` is the host loopback)

Local Django already allows `10.0.2.2` so the Android emulator `Host` header is accepted. Keep the backend bound to `127.0.0.1:8000`; the emulator alias still reaches it. iOS simulator is not an ads-only MVP target (D-027).

## Layout

```text
mobile/
  app/                 Expo Router routes (`app/index.tsx` is the home catalog)
  app/health.tsx       Backend availability screen (secondary route)
  app/sign-in.tsx      Isolated email/password and Google sign-in (not a login wall)
  app/playback-spike.tsx Isolated HLS spike (not the catalog episode screen)
  app/play/[id].tsx     Product 9:16 player (progress, resume, autoplay)
  src/api/catalog/     Thin catalog wrapper over `@shortform/api-client`
  src/api/playback/    Thin playback authorize wrapper over `@shortform/api-client`
  src/api/progress/    Thin watch-progress wrapper over `@shortform/api-client`
  src/api/health/      Thin health wrapper over `@shortform/api-client`
  src/api/me/          Authenticated `GET /v1/me` (Bearer ID token only)
  src/auth/            Auth factory (Jest mock; native Firebase + Google on device) and session holder
  src/device/          Anonymous device UUID in SecureStore (`X-Device-Id`)
  src/config/          Environment selection and manifest reads
  src/features/catalog Home, series detail, and episode-selected screens
  src/features/auth/   Sign-in screen
  src/features/playback Product player and isolated expo-video spike
  src/features/health/ Backend availability screen
  maestro/             Local Maestro flow (not a CI job)
  modules/             Android-only Expo module reading default_web_client_id
  scripts/             Expo public-config check
  app.config.ts        Expo config and the single environment resolver
```

`src/api/catalog` and `src/api/health` map generated OpenAPI calls onto mobile outcomes
(timeout, 4xx, network failure). Do not expand them into a second handwritten HTTP client.
`src/api/me` attaches a Firebase ID token as `Authorization: Bearer` on `GET /v1/me` only.
Catalog stays unauthenticated even when a session exists. Product playback authorize and
progress attach the session credential when present; missing/empty Bearer remains
anonymous (D-005). Anonymous progress also sends `X-Device-Id` from SecureStore.

## Firebase Auth (email/password)

On an Android **development build**, `/sign-in` uses native `@react-native-firebase/auth`
against the Auth emulator when `extra.api.environment` is `local`. Jest and CI keep
the local mock in `src/auth/localMockFirebaseAuth.ts` (`mock.<uid>` tokens,
`FIREBASE_AUTH_MODE=mock`). The factory in `src/auth/createEmailPasswordAuth.ts`
selects mock whenever `JEST_WORKER_ID` is set and never statically imports
`@react-native-firebase/*` or `@react-native-google-signin/*` from modules Jest loads.

Expo Go remains unsupported (ADR 0003). Catalog, health, and playback stay anonymous;
**Sign in** is a separate route (`/sign-in`) and is not a login wall (D-005 is
Founder approved 2026-08-27). Google Sign-In is the social provider for this
Android client. Apple Sign-In is deferred to an iOS storefront (D-027), not waived.

### Local Android identity loop (development client)

Do **not** commit `google-services.json` or `GoogleService-Info.plist` (root `.gitignore`
already lists them). Missing iOS plist must not block Android or CI JavaScript export
(D-027).

1. From a **non-production** Firebase project whose project id matches Django
   (`FIREBASE_PROJECT_ID=demo-shortform-local` in `.env.example`, or the same id your
   local Django uses), download Android `google-services.json` and copy it next to
   `mobile/app.config.ts` (`mobile/google-services.json`). `app.config.ts` points
   `android.googleServicesFile` at that relative path; the file stays gitignored.
   `pnpm mobile:config:check` and `pnpm mobile:bundle:check` pass in CI without the
   file because they never read it. Native prebuild (`expo run:android`) needs a
   local copy. Do not set `ios.googleServicesFile` until an iOS storefront pass (D-027).

2. Start the Auth emulator from the repository root (see `firebase.json`; host
   `127.0.0.1:9099`):

   ```shell
   firebase emulators:start --only auth
   ```

   The Android emulator reaches that host at `10.0.2.2:9099`. Django on the host uses
   `127.0.0.1:9099`.

3. Point Django at the emulator (not mock) for this device loop only:

   ```dotenv
   FIREBASE_AUTH_MODE=admin
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
   FIREBASE_PROJECT_ID=demo-shortform-local
   ```

   Keep `FIREBASE_AUTH_MODE=mock` for Jest and Application CI. Never put Firebase API
   keys or service-account JSON in `EXPO_PUBLIC_*`.

4. After adding native Firebase packages, rebuild the development client
   (`pnpm mobile:android` / `make emulate`). Metro reload is not
   enough.

5. On `/sign-in`, create an account or sign in, confirm `GET /v1/me`, use **Sign out**,
   then sign in again. The same `public_id` should return. Do not use Expo Go.

## Firebase Auth (Android Google)

Android Google Sign-In uses native `@react-native-google-signin/google-signin` plus
Firebase `GoogleAuthProvider.credential` with the Google ID token. The Android Google
Services plugin turns `oauth_client` `client_type` 3 into `default_web_client_id`.
A local Android-only Expo module reads that resource at device runtime and passes it to
`GoogleSignin.configure({ webClientId })` so the native SDK can call `requestIdToken`.
Empty `GoogleSignin.configure({})` is not enough. Do **not** put a web client ID in
`EXPO_PUBLIC_*` or `extra` (those ship in the JS bundle). Do **not** commit
`google-services.json`, OAuth client secrets, or real SHA-1 fingerprints. Apple Sign-In
is deferred to an iOS storefront (D-027), not waived. Do not set
`ios.googleServicesFile`. Do not add the official google-signin Expo config plugin.

1. Use a **non-production** Firebase project whose project id matches Django
   (`FIREBASE_PROJECT_ID=demo-shortform-local` in `.env.example`, or the same id your
   local Django uses).
2. Enable the Google sign-in method in that Firebase project.
3. Register the Android app `com.shortformstreaming.app`.
4. Add the debug SHA-1 with:

   ```shell
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
   ```

   Record a placeholder fingerprint such as `AA:AA:AA:AA:…:FF`. Never commit a real SHA-1.

5. Re-download `google-services.json`. It must include an `oauth_client` with
   `client_type` 3 (web client). That client is what the Google Services plugin
   writes to `default_web_client_id` and what `requestIdToken` needs. Copy the
   file to `mobile/google-services.json` (gitignored). Do not add
   `ios.googleServicesFile`. SHA-1 and a type-3 client together are required;
   re-download alone does not help if `configure({})` never requests an ID token.
6. The Auth emulator path is unchanged (`firebase emulators:start --only auth`). Google
   ID tokens still come from Play Services; use a Google APIs / Google Play AVD.
7. Django device loop: `FIREBASE_AUTH_MODE=admin` and `FIREBASE_AUTH_EMULATOR_HOST`.
   Keep `FIREBASE_AUTH_MODE=mock` for Jest and Application CI.
8. Rebuild the development client after adding the native package
   (`pnpm mobile:android` / `make emulate`). Metro reload is not
   enough.
9. On `/sign-in`: Google → `GET /v1/me` → Sign out → Google again → same `public_id`.
   Email/password still works. Home catalog still loads without signing in.

## Commands

From the repository root:

```shell
pnpm install
pnpm mobile:lint
pnpm mobile:format:check
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:config:check
pnpm mobile:bundle:check
pnpm mobile:check
```

`pnpm mobile:bundle:check` exports a production Android JavaScript bundle. Native compile, Gradle, Xcode, and EAS are out of scope for this check.

Package scripts (same checks, plus the development client):

```shell
make help                                  # local loops (sql, backend, emulate)
pnpm --filter @shortform/mobile start      # Metro with --dev-client
make start-avd                             # boot Pixel_9 without Android Studio
make emulate                               # start AVD if needed, then expo run:android
pnpm mobile:android                        # same as make emulate
```

iOS `expo run:ios` is not an ads-only MVP target (D-027). Keep the Expo `ios.bundleIdentifier` in `app.config.ts` for a later storefront pass; do not treat a missing Mac or iOS simulator as a blocker.

`make start-avd` launches the AVD as a detached process so you do not need Android Studio open and waits until adb sees it. `make emulate` runs `start-avd` first, then selects a JDK 17+ (Android Studio's JBR on this machine) so Gradle is not stuck on Oracle Java 8. Do not export `JAVA_HOME` by hand. Recreating the Python virtualenv does not change Gradle's JVM.

`pnpm check` includes the mobile gate.

## Manual emulator sequence (Android development client)

This is the sequence that proves the app can reach the local API. It was **not** executed in P1-T03 automation; treat it as an **omission**, not a pass.

1. Start PostgreSQL and Django on the host (see the root README). Confirm from the host:

   ```shell
   curl http://127.0.0.1:8000/health/live
   curl http://127.0.0.1:8000/health/ready
   ```

   Both must return `{"status":"ok"}` with HTTP 200.

2. Write `mobile/.env`:

   ```dotenv
   EXPO_PUBLIC_API_ENVIRONMENT=local
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
   EXPO_PUBLIC_CATALOG_TERRITORY=FR
   ```

3. Boot the AVD without Android Studio:

   ```shell
   make start-avd
   ```

   Wait until the emulator home screen is up. Override the AVD with `ANDROID_AVD=Medium_Phone_API_36.1 make start-avd` if needed.

4. From the repository root:

   ```shell
   make emulate
   ```

   `make emulate` starts the AVD if needed, pins JDK 17+, and runs `expo run:android`.
   `pnpm mobile:android` is the same install step when the emulator is already booted.
   The first run generates `mobile/android/` (gitignored) and installs the development
   client. Do not export `JAVA_HOME` by hand.

5. The launch route is Home. After seeding the local catalog, it should show the featured rail (Harbor Lights for territory `FR`). Open **Sign in** for email/password or Google Sign-In against native Firebase Auth and the Auth emulator on a rebuilt development client (optional; Jest still uses the local mock). Isolated HLS play uses `/playback-spike?episodeId=<id>` (see `docs/runbooks/playback-spike.md`). Open **Backend availability** from Home to probe `/health/live` and `/health/ready`. Use **Check again** after restarting or stopping the API.

## Local Maestro flow

`mobile/maestro/home-to-episode.yaml` walks launch → Home → series detail → listed episode. It is a local device check, not a CI emulator job. P2-T04 automation did **not** run Maestro; treat that as an **omission**, not a pass.

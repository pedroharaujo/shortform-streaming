# Mobile application

Expo SDK 57 / React Native development client for Shortform Streaming. Expo Go is not a supported target (ADR 0003): native modules require an Android or iOS **development build**.

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

Local hostnames from the emulator or simulator:

- Android emulator → `http://10.0.2.2:8000` (`10.0.2.2` is the host loopback)
- iOS simulator → `http://127.0.0.1:8000`

Local Django already allows `10.0.2.2` so the Android emulator `Host` header is accepted. Keep the backend bound to `127.0.0.1:8000`; the emulator alias still reaches it.

## Layout

```text
mobile/
  app/                 Expo Router routes (`app/index.tsx` is the home catalog)
  app/health.tsx       Backend availability screen (secondary route)
  app/sign-in.tsx      Isolated email/password sign-in (not a login wall)
  app/playback-spike.tsx Isolated HLS spike (not the catalog episode screen)
  src/api/catalog/     Thin catalog wrapper over `@shortform/api-client`
  src/api/playback/    Thin playback authorize wrapper over `@shortform/api-client`
  src/api/health/      Thin health wrapper over `@shortform/api-client`
  src/api/me/          Authenticated `GET /v1/me` (Bearer ID token only)
  src/auth/            Local/Jest Firebase Auth mock and session token holder
  src/config/          Environment selection and manifest reads
  src/features/catalog Home, series detail, and episode-selected screens
  src/features/auth/   Sign-in screen
  src/features/playback Isolated expo-video spike screen
  src/features/health/ Backend availability screen
  maestro/             Local Maestro flow (not a CI job)
  scripts/             Expo public-config check
  app.config.ts        Expo config and the single environment resolver
```

`src/api/catalog` and `src/api/health` map generated OpenAPI calls onto mobile outcomes
(timeout, 4xx, network failure). Do not expand them into a second handwritten HTTP client.
`src/api/me` attaches a Firebase ID token as `Authorization: Bearer` on `GET /v1/me` only.
Catalog and playback authorize stay unauthenticated even when a session exists.

## Firebase Auth (email/password)

This PR's device and local/CI development client uses the local mock in
`src/auth/localMockFirebaseAuth.ts`, which issues `mock.<uid>` tokens accepted
by Django when `FIREBASE_AUTH_MODE=mock`. Native `@react-native-firebase/auth`
is follow-up issue #50 (P2-T01-F1) and is not wired here. Expo Go remains
unsupported (ADR 0003). Never commit production `google-services.json`.

Home remains the anonymous catalog; **Sign in** is a separate route (`/sign-in`)
and is not a login wall (D-005 stays Proposed). Apple and Google providers are
out of scope for P2-T01.

## Commands

From the repository root, after `export PATH="$HOME/.local/bin:$PATH"` (corepack pnpm shim on this machine):

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

`pnpm mobile:bundle:check` exports production Android and iOS JavaScript bundles. Native compile, Gradle, Xcode, and EAS are out of scope for this check.

Package scripts (same checks, plus the development client):

```shell
pnpm --filter @shortform/mobile start      # Metro with --dev-client
pnpm --filter @shortform/mobile android    # expo run:android (generates native project)
pnpm --filter @shortform/mobile ios        # expo run:ios (macOS only)
```

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

3. Install the Android SDK, create an AVD, and start the emulator.

4. From the repository root:

   ```shell
   export PATH="$HOME/.local/bin:$PATH"
   pnpm --filter @shortform/mobile android
   ```

   The first run generates `mobile/android/` (gitignored) and installs the development client on the emulator.

5. The launch route is Home. After seeding the local catalog, it should show the featured rail (Harbor Lights for territory `FR`). Open **Sign in** for email/password against the local mock (optional). Isolated HLS play uses `/playback-spike?episodeId=<id>` (see `docs/runbooks/playback-spike.md`). Open **Backend availability** from Home to probe `/health/live` and `/health/ready`. Use **Check again** after restarting or stopping the API.

### iOS simulator equivalent

Use `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` in `mobile/.env`, then `pnpm --filter @shortform/mobile ios` on macOS.

## Local Maestro flow

`mobile/maestro/home-to-episode.yaml` walks launch → Home → series detail → listed episode. It is a local device check, not a CI emulator job. P2-T04 automation did **not** run Maestro; treat that as an **omission**, not a pass.

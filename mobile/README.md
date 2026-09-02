# Android mobile app

Expo SDK 57 / React Native development client for the Android-only MVP. Expo Go
is unsupported because Firebase Auth, App Check, Analytics, Google Sign-In, AdMob, and the
native video player require native modules.

## Public configuration

`app.config.ts` requires these values in `mobile/.env`:

| Variable                      | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_ENVIRONMENT` | `local`, `staging`, or `production`                                |
| `EXPO_PUBLIC_API_BASE_URL`    | Absolute backend URL; Android emulator uses `http://10.0.2.2:8000` |

The catalog is fixed server-side to France, Android, and English. There is no
client market setting. Never place secrets in `EXPO_PUBLIC_*`; they are compiled
into the public JavaScript bundle.

The P6-T01 mobile-quality foundation keeps English interface copy in
`src/localization/messages.tsx` and semantic visual/touch-target values in
`src/ui/theme.ts`. The catalog-selection, sign-in, and account journeys use these
foundations; remaining feature surfaces are tracked in P6-T01 and must not add new
hard-coded user copy.

Optional release switches:

| Variable                             | Behavior                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `EXPO_PUBLIC_REWARDED_ADS_MODE`      | `disabled`, `test`, or `production`; production defaults to disabled   |
| `EXPO_PUBLIC_ANALYTICS_ENABLED`      | `true` or `false`; production defaults to false                        |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`   | Required with a non-demo rewarded unit when production ads are enabled |
| `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID` | Must use the same AdMob publisher as the Android app ID                |

Production ads and analytics activate only through explicit build configuration.
Ad requests also require consent, and rewards are granted only after the backend
verifies AdMob server-side verification callbacks.

## Identity

The MVP offers email/password and Google Sign-In. Catalog and free playback work anonymously;
an account is required to receive a persistent rewarded-ad unlock. Django trusts
only verified Firebase ID tokens and never accepts client user IDs.

For a local Android development build:

1. Use a non-production Firebase project and enable Google Sign-In.
2. Add the Android debug SHA-1, download `google-services.json`, and place it at
   `mobile/google-services.json` (gitignored).
3. Start the Firebase Auth emulator:

   ```shell
   firebase emulators:start --only auth
   ```

4. Run Django with:

   ```dotenv
   FIREBASE_AUTH_MODE=admin
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
   ```

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

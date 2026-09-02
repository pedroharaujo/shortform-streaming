# Firebase App Check rollout

Plan: P5-T05-F3 / issue #122. The Android client and Django verification boundary
are implemented, but production enforcement is deliberately disabled. This is
development evidence only; it is not Play Integrity, provider-account, or device
validation.

## Boundary and configuration

The release Android app uses Play Integrity. Development builds use Firebase's
debug provider without placing a debug token in JavaScript, `EXPO_PUBLIC_*`, Git,
screenshots, or public logs. When the public mobile rollout switch is `enforce`,
application code requests a token for each backend request and passes it only in
`X-Firebase-AppCheck`; it does not persist or log the token. Automatic refresh is
disabled before JavaScript starts and tokens are requested on demand. The mobile
switch defaults to `disabled`, so incomplete private provider registration cannot
break networking while the server also remains disabled.

Django protects every `/v1/` operation except the authentic
`GET /v1/rewards/admob/ssv` provider callback. Health and Django Admin are outside
the consumer boundary. App Check runs after the bounded request-body check and
before API view authentication or mutation. It is defense in depth: Firebase user
authentication, endpoint authorization, rights checks, reward binding, and
idempotency remain independently required.

| Setting | Safe default / use |
| --- | --- |
| `FIREBASE_APP_CHECK_MODE` | `disabled`; set `enforce` only after the checks below pass |
| `FIREBASE_APP_CHECK_VERIFIER` | `mock` in local/CI; production settings require `admin` |
| `FIREBASE_APP_CHECK_APP_ID` | Exact public Firebase Android app ID (decoded `app_id`); required for enforcement |
| `EXPO_PUBLIC_FIREBASE_APP_CHECK_MODE` | `disabled`; switch to `enforce` in the same validated rollout as the server |

The local mock accepts only `X-Firebase-AppCheck: mock.app-check` and requires a
synthetic app ID. It is an automated-test seam, not provider evidence. Cloud Run
IaC passes the mode and app ID only to the API service and keeps the mode disabled
by default.

## Private provider setup

1. Confirm the Google Play app and Firebase Android app use the same isolated
   staging project and package `com.shortformstreaming.app`.
2. Link the Play Integrity API to that project. In Firebase App Check, register
   the Android app with the signing-certificate SHA-256 used by the tested build.
3. For a development client, obtain the debug token from bounded device logs and
   register it privately in Firebase Console. Never copy the token into this
   repository, an issue, a PR, an `EXPO_PUBLIC_*` value, or shared evidence.
4. Confirm the Cloud Run runtime identity uses Application Default Credentials for
   the same Firebase project. Normal Python verification does not consume
   limited-use tokens, so do not add the replay-beta role. Preserve least privilege
   and keep public ingress and production activation disabled.

## Staging validation and rollout

1. Deploy the exact candidate with `FIREBASE_APP_CHECK_MODE=disabled` and the
   exact public Android app ID configured. Confirm health, Admin, and the AdMob
   callback remain reachable through their existing authenticated boundaries.
2. Build a clean Android development client with
   `EXPO_PUBLIC_FIREBASE_APP_CHECK_MODE=enforce`; keep the server disabled. Exercise
   anonymous catalog/playback and authenticated profile/progress/reward requests. Observe that
   `X-Firebase-AppCheck` is present in transit without recording its value.
3. On an untrafficked staging candidate, switch to `enforce`. Verify a genuine
   debug-provider token and a Play-distributed Play Integrity token succeed.
   Missing, empty, oversized, whitespace, expired, wrong-project, and wrong-app
   tokens must return the static HTTP 401 `app_check_required` envelope before API
   view work. Provider outages must fail closed.
4. Repeat authorization cases with missing/invalid Firebase ID tokens. App Check
   success alone must never create a user, grant an entitlement, bypass rights, or
   expose playable media. Reusing a normal App Check token is not a grant and does
   not bypass the existing request-id/reward idempotency controls. The Python Admin
   SDK does not provide the Node-only limited-use-token replay beta, so this change
   makes no per-request replay-prevention claim.
5. Inspect privacy-safe request records and controlled errors for absence of App
   Check tokens, Firebase ID tokens, signed URLs, provider payloads, full IPs, and
   personal identifiers. Record only tested revision/configuration IDs and pass/fail
   observations.
6. Roll back the server by restoring the prior Cloud Run revision or setting
   `FIREBASE_APP_CHECK_MODE=disabled`. Because the mobile switch is frozen into the
   build and fails closed before a request when token acquisition fails, mobile
   rollback requires reinstalling or distributing the prior disabled build. Do not
   enable production enforcement until both rollback paths and the complete matrix
   are independently reviewed.

Provider references: [React Native Firebase App Check](https://rnfirebase.io/app-check/usage),
[custom-backend verification](https://firebase.google.com/docs/app-check/custom-resource-backend),
[Play Integrity setup](https://firebase.google.com/docs/app-check/android/play-integrity-provider),
and [Android debug provider](https://firebase.google.com/docs/app-check/android/debug-provider).

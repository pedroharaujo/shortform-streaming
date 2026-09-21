# Stovio brand and service migration

Tracking: [#187](https://github.com/pedroharaujo/stovio/issues/187), D-038,
[draft PR #188](https://github.com/pedroharaujo/stovio/pull/188).
Founder approval: 2026-09-21. Display names use **Stovio** and technical names
use `stovio`. The approved scope includes replacing fixed app/project identities
and retiring predecessors after preservation and replacement checks.
This supersedes the original display-only rollout. Public production activation
and bypassing MVP launch gates are not approved by the rebrand.

## Source and local environment

- GitHub repository and origin: `pedroharaujo/stovio`; history, issues,
  pull requests, environments and access remain on the same repository.
- Root package `stovio`, Python package `stovio-backend`, workspace packages
  `@stovio/mobile` and `@stovio/api-client`; imports and lockfiles updated.
- App name, Expo slug, catalog wordmark, support subjects, Django Admin,
  OpenAPI, documentation, repository URLs and architecture diagram use Stovio.
- Android application `com.stovio.app`; URL scheme `stovio://`. This is a new
  app installation, not an upgrade of the previous package.
- Compose project/database/user `stovio`; volume `stovio_postgres-data`.
  The founder explicitly approved a fresh local database. The old container
  is stopped and its volume remains a private backup.
- Auth emulator `demo-stovio-local`; secure-storage keys `stovio.*`;
  Admin cookie `__Secure-stovio_admin_session`; analytics digest
  `stovio-analytics-v1`; purchase digest `stovio-purchase-v1`.
- Only `STOVIO_BACKEND_IMAGE` and `STOVIO_METRO_PLAIN_ANDROID_BUNDLE` are
  supported; old tooling aliases and URL scheme removed.
- Terraform defaults, service accounts, custom roles, log metrics, image paths,
  CI database settings and operational commands use Stovio.

The backend temporarily accepts the previous purchase fingerprint namespace
as well as the new one. Both resolve through the same ownership checks and
provider transaction identity, preserving a single ledger credit. This does
not transfer purchases between package IDs; old-package recovery still requires
its product mapping and provider access until reconciliation is complete.

Generic provider variable names (`DATABASE_URL`, `FIREBASE_PROJECT_ID`,
`BUNNY_STREAM_*`, `REVENUECAT_*`, `GCP_*`, `WIF_*`, `EXPO_PUBLIC_*`) contain
no old brand and remain unchanged. No tracked custom icon/splash images or
EAS project were found. New logo/store assets remain launch work.

## Connected services

| Service | Applied state and preservation |
|---|---|
| GCP staging | New project `stovio-staging` (`540100582720`), same billing account, region and budget amount. New `stovio-api`, `stovio-migrate`, `stovio-smoke`, registry `stovio` and dedicated runtime/deploy/smoke identities. Internal ingress and resource-scoped access retained. |
| GCP data/secrets | New private bucket `stovio-staging-nonvideo-540100582720`; both inventories contain zero objects. Existing database and Django secret bytes/numeric versions copied and verified. Empty Bunny placeholder remains empty. Supabase endpoint/data unchanged. |
| Infrastructure state | Private, versioned `stovio-staging-tfstate-540100582720`, prefix `staging`. Ignored operator inputs and local backend initialization now target this state. Source state/inventories backed up privately. |
| GitHub deployment | Seven staging variables updated/read back: project, registry, service, migrate/smoke jobs, identity provider and deploy service account. Region unchanged. Trust remains exact repository + main + staging; no static cloud keys added to GitHub. |
| Old staging | Source-project-only budget deleted. `shortform-streaming-stg` reports `DELETE_REQUESTED`; normal Google recovery period precedes permanent deletion. |
| Firebase | New free-plan project `stovio-app` (`72201543210`), Android app `1:72201543210:android:ce5116c0d31697c2afed53`, package `com.stovio.app`. Existing Google-linked user imported with identical UID/provider identity; no password users existed. Two signing fingerprints copied unchanged. Google sign-in enabled; public name Stovio. |
| Firebase credentials | New project-bound `stovio-auth-verifier` with only `firebaseauth.users.get`. Ignored backend/native configuration points to Stovio. API-key labels renamed, restrictions preserved. Project-bound credentials necessarily replaced; unrelated secret values preserved. |
| Google Analytics | Existing property `551836456`, Stovio, detached from old Firebase and linked to `stovio-app`; new stream mapping verified. Property/history retained. Founder-approved profile: Arts & Entertainment, 1–10 employees, user behavior. Shared parent account unchanged. |
| Google Play | Stovio app `4974380022274793607`, package `com.stovio.app`. Signed version 1 / 0.1.0 accepted and released to internal track `4701745217816412686`; existing one-person founder tester list selected and track Active. No production release. New RevenueCat verifier retains four approved app-only permissions; no account-wide/release access. |
| Supabase | Organization/project Stovio; existing opaque reference/host retained. ACTIVE_HEALTHY and read-only connectivity verified. |
| Bunny Stream | `stovio-spike-nonprod` (7 videos) and `stovio-production` (0 videos); existing opaque IDs, media, CDN URLs and keys preserved. |
| RevenueCat | Existing project/app/customer/product records retained. Display and secret-key labels use Stovio. Founder saved the Stovio credential; package `com.stovio.app` persisted. All three credential-validation checks pass. |
| AdMob | Stovio (Development); opaque app/ad-unit IDs retained. Ads remain disabled. |

After new-package registration and RevenueCat validation passed, old Firebase
project `throwaway-project-3d95c` entered `DELETE_REQUESTED`. Before retirement,
the source user export was compared again, the new verifier read the preserved
account, and the retained Analytics property linkage was reverified. Google’s
normal project recovery period applies. Old Play deletion remains pending its
developer-registration transaction ID. The founder already approved deletion,
including its seven-day recovery/data-loss rule.

RevenueCat's retained customer has five sandbox purchases. Their provider records
were backed up privately through the existing purchase-read scope. The key cannot
enumerate customers; that inventory was verified in the dashboard without
broadening permissions. No customer or purchase record was deleted.
After credential cutover, a fresh read returned the same customer and five
sandbox purchase IDs. The ignored backend product mapping now uses
`com.stovio.app`; purchases and spending remain disabled.

The new Play test product is `test_coins_100`, purchase option `buy`, active and
backwards compatible, single quantity, France only, displayed price EUR 0.99.
All other and newly added regions are unavailable. This preserves the approved
test-pack configuration; it is not approval of commercial launch pricing.

## Verification

- `pnpm check`: repository safety/governance and **61 repository tests** passed;
  backend lint/format/type/migration checks and **769 tests** passed; regenerated
  API contract passed. The aggregate stopped at formatting of the updated mobile
  digest fixture. That formatting was corrected and all mobile gates rerun.
- `pnpm mobile:lint`, `pnpm mobile:format:check`, `pnpm mobile:typecheck`,
  `pnpm --filter @stovio/mobile test --runInBand`,
  `pnpm mobile:config:check`: passed, **52 suites / 525 tests**.
  Serial execution avoids contention with native builds; assertions/timeouts
  were not weakened.
- Purchase-recovery regression alternates old/new fingerprints and
  owned/refunded states while asserting one ledger credit.
- OpenTofu formatting, isolated backend-free init, validate and mocked test:
  **50 passed, 0 failed**. Live apply completed in the new project; the saved
  operator checkout was reinitialized against the new backend.
- New staging image built/pushed; authenticated live smoke execution
  `stovio-smoke-k7mjx` passed.
- `scripts/verify_backend_container.sh` passed against that same image in an
  isolated disposable Compose project: production configuration fails closed,
  migration, health, Admin/static assets, database outage/recovery and graceful
  shutdown (2 seconds). A Windows-only shell wrapper maps `python3` to the
  installed `python`; no test behavior changed.
- Final live infrastructure plan has no additions/deletions and two provider
  normalization differences: budget project ID versus number, and omitted
  zero-minimum scaling. No further apply was performed to chase these defaults.
- Android debug build passed. APK package/label/activity verified; emulator
  installation passed; a `stovio://` link resolves to the new main activity.
- Firebase configuration refreshed after Analytics linking; unchanged.
- New least-privilege Firebase verifier read the preserved account successfully;
  UID, provider identity, email and disabled status match the private export.
- Android upload-key filename/alias migrated privately to Stovio; exported
  certificate bytes identical before/after. Signed ARM64 registration build
  passed (790 Gradle tasks). Bundletool validation, manifest/package/version,
  JAR signature, original certificate match, ZIP integrity, all 22 native
  libraries' 16 KB alignment, embedded disabled capabilities and bounded
  private-secret scanning passed. Artifact SHA-256:
  `89bdb5c9700184168a2440410c787dffcc62532e959eb5aeec54d483d3500dbe`.
- All ten GitHub check results passed on implementation commit `1ae4f48`,
  including Backend, Mobile, Container, OpenAPI contract, OpenTofu validate,
  Repository foundation and the Application CI gate.

The signed bundle is private at
`%LOCALAPPDATA%/Stovio/play-registration/stovio-registration-v1.aab` (42,080,490
bytes). It uses the local test API and is for store registration, not public
production. Chrome refused its chooser upload with `Not allowed`; the Stovio
internal release was subsequently uploaded after the founder enabled extension
file-URL access. An initial transferred file failed Play ZIP validation. The
same locally validated bytes, copied to a shorter Windows path and uploaded
with Windows path separators, transferred fully and were accepted by Play.
No signing key or artifact bytes changed. The internal release is Active;
Google uses `com.stovio.app (unreviewed)` as its temporary store name until
listing setup and review are complete.

The six SHA-1/SHA-256 fingerprints for the current classical, post-quantum and
previous Play signing certificates were added to the new Firebase Android app;
the two existing fingerprints were preserved. Ignored native Firebase config
was refreshed. This config change does not prove a device Google sign-in test.

RevenueCat's new service-account JSON is private at
`%LOCALAPPDATA%/Stovio/play-credentials/stovio-revenuecat.json`. Browser rules
require the founder to perform credential replacement and submission. Its
saved settings have package `com.stovio.app`. A fresh page verified the saved
file, and all three checks now pass: subscription purchases, in-app product
catalog, and subscription catalog/base plans. Validation passed after bundle,
internal release and test-product registration, without broadening permissions
or replacing the credential again.

Private account exports, Terraform plans/state, logs, provider payloads, secret
copies and signing material stay outside tracked evidence.

## Remaining gates and exceptions

1. Verify a genuine new-package test purchase/recovery. Credential validation,
   signed bundle registration and test-product setup are complete.
   Purchases and coin spending remain disabled meanwhile.
2. Verify Google sign-in and the complete device playback journey on the new
   package. User import and APK installation do not prove sign-in/playback.
3. Finish old Play retirement using the developer registration transaction ID.
   Old staging/Firebase are already in recoverable deletion. Preserve required
   financial evidence and the private sandbox-purchase backup.
4. Verify GitHub deployment after reviewed merge; manual smoke does not prove
   the new workflow's end-to-end identity authentication.
5. Complete listing, privacy/content declarations, graphics, required closed
   testing (12 testers for 14 continuous days), and production-access review.
   Existing P6-T03 final-validation gates still apply.
6. The active Windows checkout remains `shortform-streaming` while tools/builds
   are attached. New clones use `stovio`; move the checkout after closing
   dependent sessions and updating the saved workspace path.

Historical commits, completed evidence, old registration artifacts and private
rollback backups retain original names for accuracy. Provider-generated opaque
IDs/URLs without old branding remain. No invented domain/support address replaces
a working destination. This is not an MVP launch-readiness sign-off; no unchecked
gate is treated as passed or implicitly deferred under D-029.

## Recovery

Private migration backups record source configs/state/users. Recover a Google
project only through its normal recovery procedure, then verify IAM, secrets,
endpoints and deployment variables before traffic changes. Do not mix old-project
credentials with the new Firebase audience/package. Preserve original signing
material privately; renaming aliases must never generate replacement keys.

References: [Firebase Analytics unlink behavior](https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/removeAnalytics),
[Play deletion requirements](https://support.google.com/googleplay/android-developer/answer/16483176),
[Play production-access testing](https://support.google.com/googleplay/android-developer/answer/14151465).

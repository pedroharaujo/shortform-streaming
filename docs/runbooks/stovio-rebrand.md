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

| Service              | Applied state and preservation                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GCP staging          | New project `stovio-staging` (`540100582720`), same billing account, region and budget amount. New `stovio-api`, `stovio-migrate`, `stovio-smoke`, registry `stovio` and dedicated runtime/deploy/smoke identities. Internal ingress and resource-scoped access retained.                                                                         |
| GCP data/secrets     | New private bucket `stovio-staging-nonvideo-540100582720`; both inventories contain zero objects. Existing database and Django secret bytes/numeric versions copied and verified. Empty Bunny placeholder remains empty. Supabase endpoint/data unchanged.                                                                                        |
| Infrastructure state | Private, versioned `stovio-staging-tfstate-540100582720`, prefix `staging`. Ignored operator inputs and local backend initialization now target this state. Source state/inventories backed up privately.                                                                                                                                         |
| GitHub deployment    | Seven staging variables updated/read back: project, registry, service, migrate/smoke jobs, identity provider and deploy service account. Region unchanged. Trust remains exact repository + main + staging; no static cloud keys added to GitHub.                                                                                                 |
| Old staging          | Source-project-only budget deleted. `shortform-streaming-stg` reports `DELETE_REQUESTED`; normal Google recovery period precedes permanent deletion.                                                                                                                                                                                              |
| Firebase             | New free-plan project `stovio-app` (`72201543210`), Android app `1:72201543210:android:ce5116c0d31697c2afed53`, package `com.stovio.app`. Existing Google-linked user imported with identical UID/provider identity; no password users existed. Two signing fingerprints copied unchanged. Google sign-in enabled; public name Stovio.            |
| Firebase credentials | New project-bound `stovio-auth-verifier` with only `firebaseauth.users.get`. Ignored backend/native configuration points to Stovio. API-key labels renamed, restrictions preserved. Project-bound credentials necessarily replaced; unrelated secret values preserved.                                                                            |
| Google Analytics     | Existing property `551836456`, Stovio, detached from old Firebase and linked to `stovio-app`; new stream mapping verified. Property/history retained. Founder-approved profile: Arts & Entertainment, 1–10 employees, user behavior. Shared parent account unchanged.                                                                             |
| Google Play          | Stovio app `4974380022274793607`, package `com.stovio.app`. Signed version 1 / 0.1.0 accepted and released to internal track `4701745217816412686`; existing one-person founder tester list selected and track Active. No production release. New RevenueCat verifier retains four approved app-only permissions; no account-wide/release access. |
| Supabase             | Organization/project Stovio; existing opaque reference/host retained. ACTIVE_HEALTHY and read-only connectivity verified.                                                                                                                                                                                                                         |
| Bunny Stream         | `stovio-spike-nonprod` (7 videos at migration) and `stovio-production` (0 videos); existing opaque IDs, media, CDN URLs and keys preserved. Two generated QA uploads were subsequently added to nonproduction, as recorded below.                                                                                                                 |
| RevenueCat           | Existing project/app/customer/product records retained. Display and secret-key labels use Stovio. Founder saved the Stovio credential; package `com.stovio.app` persisted. All three credential-validation checks pass.                                                                                                                           |
| AdMob                | Stovio (Development); opaque app/ad-unit IDs retained. Ads remain disabled.                                                                                                                                                                                                                                                                       |

After new-package registration and RevenueCat validation passed, old Firebase
project `throwaway-project-3d95c` entered `DELETE_REQUESTED`. Before retirement,
the source user export was compared again, the new verifier read the preserved
account, and the retained Analytics property linkage was reverified. Google’s
normal project recovery period applies. The founder supplied the required
registration receipt reference privately, and old Play app
`com.shortformstreaming.app` was deleted on 2026-09-21 under the existing
approval. Play Console confirms recovery is available until 2026-09-28;
afterward its app data and metrics become permanently inaccessible. The
receipt reference is not stored in repository evidence.

RevenueCat's retained customer has five sandbox purchases. Their provider records
were backed up privately through the existing purchase-read scope. The key cannot
enumerate customers; that inventory was verified in the dashboard without
broadening permissions. No customer or purchase record was deleted.
After credential cutover, a fresh read returned the same customer and five
sandbox purchase IDs. The ignored backend product mapping now uses
`com.stovio.app`. Purchases and spending stayed disabled during cutover;
the supervised local validation below subsequently enabled sandbox mode only.

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

### Local prelaunch validation — 2026-09-21

Scope: P6-T03, D-036/D-037, issues #164/#187. All ten CI checks passed on
candidate `909166c`; `pnpm mobile:bundle:check` and
`pnpm mobile:config:check` also passed. All ten checks also passed on `faa59ea`.
These automated checks are separate from the device evidence below.

The fresh local `stovio` database was inspected before initialization. Fixed
dotenv quoting around the existing private product-registry JSON without
changing its values, then ran `uv run --env-file .env python
backend/manage.py migrate --noinput` and `uv run --env-file .env python
backend/manage.py check` successfully. The previous local volume remains intact.

Play Console confirms the existing founder tester list is selected for license
testing. Only the private local backend and Android debug configuration now
enable `revenuecat_sandbox` purchases; local coin spending uses `test` (the
`revenuecat_sandbox` spending flag is reserved for hosted sandbox settings).
The initial spending-flag mismatch was corrected during device validation and
`coin_spending_enabled()` verified true. The backend listens on loopback port 8001, while
the emulator uses `http://10.0.2.2:8001`. Cloud Firebase authentication is
selected. Public deployment, callbacks, ads and analytics remain disabled.

Two generated 12-second silent test videos were uploaded to the existing
nonproduction Bunny library and became READY. The generated series appears in
the catalog. Both episodes' signed master and variant playlists returned 200
with valid HLS content; unsigned and expired links returned 403. A live backend
authorization also led to a successful nonempty media-segment download. Episode 2 was
then configured to cost one test coin, and anonymous authorization returned no
playable URL. Wallet, purchase identity and purchase catalog reject anonymous
requests with 401. Live local health, readiness and catalog requests return 200.
This verifies API/CDN behavior, not visible device playback or audio.

The sandbox debug build passed with 482 Gradle tasks (24 executed). Installation
preserved existing app data, and the `stovio://` route resolves. Its APK contains
the Stovio label/package, cloud authentication, local port 8001 and sandbox
purchase configuration. ZIP integrity and a bounded scan for known server
secrets/private keys passed. Metro responds on loopback port 8081. No Google
sign-in, genuine new-package purchase, wallet credit, unlock or restart is
claimed from build/install success alone.

### Genuine Android sandbox journey — 2026-09-21

Validated `com.stovio.app` in the API 36.1 Android emulator with the debug build,
cloud Firebase authentication, the local backend and nonproduction Bunny media.
The founder completed Google sign-in; Stovio created the authenticated profile
and retained the session through restart. Android initially stopped the app
while automatically updating WebView; the system log identified
`installPackageLI`, rather than an app exception. The repeated journey passed.

- The free generated episode visibly played to completion. Authenticated
  progress recorded completion at 12 seconds, and continuation stopped at the
  locked second episode.
- Google Play displayed the expected 100-coin test pack, its EUR 0.99 catalog
  price, the always-approves test card and an explicit no-charge notice.
  Dismissing the first checkout produced the cancellation message and no credit.
- A subsequent no-charge order succeeded. RevenueCat-backed server verification
  produced exactly one Stovio purchase decision and one 100-coin ledger credit;
  the app displayed the verified credit and balance.
- Confirming the second episode's one-coin unlock produced exactly one debit
  and one unlock receipt. The episode visibly played to completion.
- After `adb -s emulator-5554 shell am force-stop com.stovio.app` (without
  clearing data), launcher startup retained login and the 99-coin balance.
  Replaying the unlocked episode required no further payment or debit.
- Temporarily unpublishing only the generated second episode prevented playback
  despite its existing unlock. Publication was restored immediately afterward;
  no financial or entitlement records were changed.
- Purchase history retained one original 100-coin credit after refresh. Final
  database reconciliation remained one purchase credit, one one-coin debit,
  one unlock receipt and zero quarantined purchase decisions.

No account identifiers, order IDs, support references, provider payloads or
device screenshots are committed. This proves the basic emulator sandbox
journey and persistence after an already-verified purchase; it does not prove
interruption recovery before verification, reinstall/account isolation, genuine
refund/callback delivery, audio, physical-device or store-signed release behavior.
Minor UI polish observed: one-coin unlock labels still use the plural "coins";
the generic Android launcher icon also remains part of the store-assets gate.

## Remaining gates and exceptions

### Hosted-release prerequisite check (2026-09-21; #122 / #164)

- Enabled the Firebase App Check API in `stovio-app`. After the founder's
  explicit approval of the Play Integrity terms, linked `com.stovio.app` to
  Firebase project `72201543210` in Google Play. Play reports the expected
  project and active licensing, app-recognition and device-integrity responses.
- Firebase Console reports Stovio Android registered with Play Integrity and
  four SHA-256 signing fingerprints. The existing configuration requires
  `PLAY_RECOGNIZED`; license and explicit device-integrity requirements remain
  unchanged. This is provider setup evidence, **not** a successful real-device
  attestation or backend-enforcement test. Server enforcement remains disabled.
- Prepared an ignored private Cloud Run bootstrap plan: 22 creates, four
  updates, no deletes; one consumer sandbox instance maximum per revision and
  minimum zero. The plan preserves the existing budget amount, secret values
  and private ingress. It also enables nonproduction Bunny configuration on
  the existing private service/job and updates the smoke script. It has not
  been applied at that prerequisite check; the approved private bootstrap is now
  deployed and verified as recorded below.
  A local check of the exact proposed image with private hosted settings passed:
  DEBUG off, sandbox-only purchases/spending, ads disabled, staff routes absent,
  authenticated purchase callback route present. This check made no database
  changes and is not a live hosted or webhook-delivery test.
- Supabase remains healthy. The coordinated PostgreSQL role/schema migration
  is complete; see the verification and recovery evidence below. The hosted
  application tables still contain zero profiles, series, purchase decisions
  and wallet entries. This does not mean the whole schema is empty.
- Google Play still requires 12 closed-test participants for 14 continuous
  days and reports zero enrolled closed testers. Saved the factual no-ads
  (D-037), non-government-app and no-health-features declarations as unpublished
  drafts. Privacy,
  data safety, content rating, reviewer access and store-listing requirements
  remain separate release gates. No review or public release was submitted.

### Database identity cutover — 2026-09-21 (#187)

With the founder's explicit approval, renamed the PostgreSQL login role,
application schema and role-default search path from `shortform_staging` to
`stovio_staging`. Supabase migration
`rename_stovio_staging_database_identity` records the change. The provider
project and its data were retained; this was a transactional metadata rename,
not a database rebuild or table migration.

Before committing the rename, created a private PostgreSQL 17 custom-format
dump and verified its archive listing. Rehearsed the rename inside a transaction
and rolled it back successfully. The archive was not restored into a separate
database, so this is not a full backup-restore drill.

Server-side checks confirmed SCRAM password storage and compared the role's
attributes and password hash before/after without returning the hash. The role
and schema retain their original object IDs. A fresh connection with full TLS
certificate verification now resolves both the login and schema to
`stovio_staging`. Post-cutover verification confirms:

- All 37 tables and 196 rows have unchanged counts and content checksums.
- All 215 database objects retain their identities, owners, permissions and
  row-level-security settings; sequence positions are unchanged.
- The old role/schema are absent. Supabase `anon` and `authenticated` have no
  schema access, and the runtime role has no new elevated privileges.
- Secret Manager `database-url` version 2 changes only the connection username.
  The password, endpoint and TLS options are unchanged. Version 1 is retained
  privately for coordinated rollback; it cannot authenticate while the old
  role name is absent.
- The API and migration job use version 2. Candidate cloud health/readiness
  checks and `python manage.py migrate --check` passed before traffic promotion.
  Revision `stovio-api-00002-qug` now receives 100% of traffic; normal-origin
  cloud health/readiness checks also passed (`stovio-smoke-9x5mc`). No Django
  application migration or data rewrite was needed.
- Active private infrastructure inputs select version 2. A reviewed
  refresh-only OpenTofu plan updated remote state without changing cloud
  resources. The future hosted-consumer plan was regenerated with version 2;
  it contained no deletion. That regenerated plan was subsequently applied in
  the private hosted bootstrap below.

The first two cloud verification executions failed because Windows shell
argument handling combined their overrides. Corrected argument-list executions
passed; the failures were not database or application test passes.
Private connection files, backups, checksums and provider logs remain outside
the public repository. Local emulator data and its verified sandbox purchase
were not modified by this hosted-database rename.

Validation commands: `uv run python
.tmp/stovio-migration/verify_database_rename.py` (fresh TLS login, identity and
data comparison), `uv run python
.tmp/stovio-migration/run_database_cutover_checks.py` (candidate smoke and
read-only migration check), and `uv run python
.tmp/stovio-migration/finalize_database_cutover.py` (traffic/configuration and
normal-origin smoke), all passed. These private operational scripts and their
inputs are retained in the ignored migration workspace. Repository safety,
61 repository tests and governance passed via
`python scripts/check_repository_foundation.py`; `git diff --check` passed.

### Private hosted consumer bootstrap — 2026-09-21 (#164 / #187)

The founder approved the proposed private service and its resource-scoped
permissions. Deployed `stovio-consumer-test` with the existing backend image,
renamed database connection, nonproduction Bunny library and unchanged sandbox
credential values. The consumer service is internal-only, with sandbox-only
commerce, no staff routes and a maximum of one instance per revision. The
existing BRL 588/month budget alert remains unchanged.

Both consumer and ordinary private API smoke checks passed. A temporary job
using the consumer identity verified database/video connectivity, access to
the selected secret version, denial of the previous version and staff bucket,
and the approved Firebase permissions. The job was removed. Hosted database
contents and the local emulator wallet remain unchanged. Active infrastructure
inputs/state and the GitHub staging consumer-service variable are updated.

See [hosted test release evidence](hosted-android-test-release.md) for exact
checks and limits. Public access, device attestation, genuine provider callback
delivery and the standalone Android release remain separate unfinished gates.

The version 2 signed hosted-verification bundle passes artifact, configuration
and universal-APK packaging checks. After two initial processing errors, Google
Play accepted the same bundle from a checksum-identical Desktop copy. Version 2
is now available on the existing internal tester track; no public release was
made. All ten GitHub checks passed for code commit `ddc5633`. A private,
zero-traffic App Check candidate passed live missing/invalid-token rejection
checks. After completing Play/Chrome setup, the temporary emulator installed
version 2 directly from Google Play. Its installed signature, embedded bundle,
hosted configuration and compiled Firebase identities passed checks. Stovio
starts without Metro, but Firebase rejects the emulator's real attestation
with HTTP 403. No verification settings were weakened. A physical Android
test was then performed on 2026-09-22: version 2 is installed from Google Play,
and Firebase service metrics record a successful Play Integrity token exchange.
No token was collected as evidence. The verified enforcement revision now serves
all private consumer traffic. An unapplied plan prepares protected internet
access under the existing capacity and budget settings; activation approval and
hosted catalog/playback/purchase acceptance remain outstanding. The emulator's
precise rejection cause remains unknown. See the hosted release runbook for
artifact identity and open gates.

### Outstanding work

1. Complete interrupted-purchase recovery, reinstall/account isolation and
   genuine refund/callback validation. The basic new-package sandbox purchase,
   credit, unlock and post-credit restart/replay checks above passed.
   Public purchases and coin spending remain disabled; the supervised local
   debug environment is now configured for sandbox validation only.
2. Repeat the journey on a physical Android device with the intended store-signed
   release and hosted test backend; finish the remaining P6-T03 device, privacy
   and release checks. The local debug/emulator result is not release sign-off.
3. Old Play, staging and Firebase are in their provider recovery periods;
   retirement actions are complete. Preserve required financial evidence and
   the private sandbox-purchase backup. Old Play recovery ends 2026-09-28.
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

For the database cutover, prefer rolling back application code while retaining
the renamed database identity and connection secret version 2. Routing traffic
to a revision using version 1 alone will fail authentication. A full identity
rollback requires a coordinated maintenance window: stop writers, verify the
current state, transactionally rename the role and schema back to their original
names and restore the original role-default search path, then restore version 1
on the API and migration job. Require fresh TLS login, migration checks and
cloud health/readiness checks before resuming traffic; reconcile infrastructure
inputs/state afterward. Use the private dump only for a separately reviewed data
recovery, not as the routine rename rollback.

References: [Firebase Analytics unlink behavior](https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/removeAnalytics),
[Play deletion requirements](https://support.google.com/googleplay/android-developer/answer/16483176),
[Play production-access testing](https://support.google.com/googleplay/android-developer/answer/14151465).

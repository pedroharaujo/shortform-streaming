# Hosted Android test release

Tracking: [#121](https://github.com/pedroharaujo/stovio/issues/121),
[#164](https://github.com/pedroharaujo/stovio/issues/164), P5-T05-F4.

## Purpose and current status

Prepare the existing app to run without Metro, the local Django server or a
temporary callback tunnel. The founder selected the generated Cloud Run HTTPS
address on 2026-09-21 and authorized preparation. This is an Android license-tester
release, not a public paid launch. The founder subsequently approved the private
bootstrap described below, including its dedicated identity and secret access.
This document does not authorize public activation or real payments.

Current state (2026-09-22): the founder separately approved protected internet
access for the consumer test service. Physical Google Play testing has passed
verified catalog access, free playback and approved/declined sandbox checkout.
Version 3 is available on the existing internal track to correct the hosted
coin-unlock UI gate. The founder has now confirmed the one-coin unlock and replay
after leaving and reopening episode 2. Read-only hosted accounting confirms a
99-coin balance and one durable unlock receipt. The founder subsequently confirmed
replay without another unlock after fully closing and reopening Stovio. Remaining
provider/release checks below are still open; the dated sections retain the earlier
evidence.

### Private bootstrap verified — 2026-09-21 (#164 / #187)

Deployed `stovio-consumer-test` in `stovio-staging`, `europe-west9`, with the
existing verified Stovio backend image and `config.settings.hosted_sandbox`.
The service is internal-only and requires Google invocation credentials;
unauthenticated external requests are blocked. It is not yet a usable Android
tester endpoint outside the project.

- Capacity: 1 vCPU, 512 MiB, concurrency eight, minimum zero and maximum one
  instance per revision. The existing BRL 588/month staging budget alert and
  recipient remain unchanged; the alert is not a spending cap.
- Created five missing secret containers and populated six existing sandbox
  credential values, with byte-for-byte read-back verification. Database secret
  version 2 retains the renamed login; all other consumed versions are pinned
  to version 1. Secret values were not rotated or placed in infrastructure state.
- The consumer identity can read the selected database secret version but is
  denied the previous version and private staff bucket. A temporary Cloud Run
  verification job confirmed these effective permissions, the renamed database
  login/schema, and Bunny nonproduction library connectivity. Its Firebase
  permissions are exactly the approved account-read/account-delete pair among
  the checked account/IAM permissions; create-user and project-IAM editing are
  denied. The temporary job was deleted after passing.
- Live consumer smoke `stovio-smoke-p76pz` passed database readiness, liveness,
  absent staff routes and rejection of unsigned purchase notifications. The
  existing private service also passed smoke `stovio-smoke-hml8g`. A final
  traffic check found its updated template had not replaced the serving
  revision; separately prepared and smoke-tested `stovio-api-00003-htf` before
  promoting it to 100%. Both serving revisions now select the nonproduction
  Bunny library and database secret version 2. Purchases/spending remain sandbox-only
  on the consumer service and disabled on the ordinary secure service.
- Rechecked all 37 hosted tables / 196 rows against the pre-rename baseline:
  content, permissions, object identities and sequence positions are unchanged.
  The local emulator's purchase and wallet were untouched.
- Persisted the deployed topology in ignored staging inputs and remote state;
  set GitHub staging variable `HOSTED_SANDBOX_SERVICE=stovio-consumer-test`.
  The final plan has no creates/deletes or secret/IAM changes, only provider
  normalization of budget project ID/number and zero-minimum scaling blocks.

Exact operational checks: `uv run python
.tmp/stovio-migration/validate_hosted_runtime.py`, `uv run python
.tmp/stovio-migration/verify_hosted_deployment.py`, `uv run python
.tmp/stovio-migration/run_hosted_runtime_probe.py`, and `uv run python
.tmp/stovio-migration/verify_database_rename.py`, all passed. Inputs and raw
provider evidence stay in the ignored private migration workspace.

This proves the private bootstrap, not public tester activation, Firebase
attestation, visible hosted playback, genuine callback delivery, or a store-signed
Android journey. The rebrand PR remains unmerged, so GitHub deployment after its
reviewed merge also remains unverified. No automatic merge was performed.

### Signed verification build — 2026-09-21 (#122 / #164)

Prepared Android version code 2, keeping version name `0.1.0`, package
`com.stovio.app` and the existing upload certificate. The bundle embeds its
JavaScript and the private hosted consumer HTTPS origin, cloud Firebase auth,
App Check enforcement and sandbox purchases. Ads and analytics are disabled.
The release selects Play Integrity rather than the development debug provider.

`uv run python .tmp/stovio-migration/build_hosted_release.py` passed: 802 Gradle
tasks, 95 executed, 707 up-to-date. The private bundle verifier
`uv run python .tmp/stovio-migration/validate_hosted_release.py` passed bundletool
validation, archive integrity, preserved signing certificate, package/version/
target-SDK checks, embedded configuration checks, known-server-secret and
private-key scans, and 16 KB alignment for all 44 native libraries across
`arm64-v8a` and `x86_64`. This is build evidence, not Google Play acceptance or
successful device attestation.

The private artifact is `Stovio/play-release/stovio-hosted-v2.aab` under the
operator's local application-data directory (55,087,449 bytes; SHA-256
`f39ee5239eee7cffb6f82399aa89a3c1a818bf15f7f369fd8f749cc778d7a7c3`).
Google Play's existing internal-track release draft is named
`Stovio 0.1.0 - Hosted verification`. Two initial uploads returned a generic
processing error. A subsequent upload from a checksum-identical Desktop copy
succeeded, and version 2 is now **available to internal testers** on the existing
track. No production or closed-test rollout was made. Play accepted both ABIs
and reported no loss of previously supported devices. Its only warning was a
missing deobfuscation file; R8/minification is disabled in this build.
`uv run python .tmp/stovio-migration/check_release_packaging.py` additionally
passed bundletool universal-APK generation with the preserved upload key.
That diagnostic APK was not installed as a substitute for Play distribution.
The original two upload failures have no confirmed root cause.

Prepared private revision `stovio-consumer-test-00002-yit` with enforcement on,
tagged `app-check`, receiving zero normal traffic. The normal consumer revision
remains private with enforcement disabled while device proof is pending.
`uv run python .tmp/stovio-migration/check_appcheck_candidate.py` passed live
health/readiness, staff exclusion, unsigned-callback rejection and HTTP 401
`app_check_required` for missing, empty, whitespace, oversized and malformed
tokens. Two initial probe executions failed from Windows command-argument
handling; corrected structured Cloud Run API execution `stovio-smoke-mxg2p`
passed. These are
negative cases only: genuine Play-distributed tokens, wrong-project/app,
expired-token and provider-outage live cases remain unverified.

Saved the original emulator session before opening a temporary read-only
session for store installation. The original app's login, 99-coin wallet and
private local database are preserved. The founder completed Google Play Terms
acceptance and Chrome setup. Google Play initially installed version 1; the
store's available-updates screen then delivered version 2. `adb shell dumpsys
package com.stovio.app` confirms version code 2 and installer
`com.android.vending`, with the x86_64 split installed. The pulled installed
base APK passes `apksigner verify --verbose --print-certs`; its signer matches
the registered Play signing certificates. Its embedded JavaScript, hosted
origin, App Check enforcement, sandbox purchase mode and compiled Firebase
app/project/sender IDs match the intended build.

The Play-signed app starts and displays Stovio without Metro, but its first real
App Check attempt returns HTTP 403, `App attestation failed`. The catalog stays
unavailable. No fatal exception or missing-JavaScript error was observed. Live
read-back confirms the matching Firebase signing fingerprints and linked Play
Integrity project `72201543210`. Configuration still requires Play recognition;
no verdict, signing or enforcement settings were weakened. Google documents
that emulators can be rejected by the real provider; the exact verdict causing
this rejection is not exposed by the client error. A physical Android test is
the next gate, not an emulator success claim. The founder has a phone available.
See [Firebase's emulator guidance](https://firebase.google.com/docs/app-check/android/play-integrity-provider#use_app_check_in_debug_environments).

The initial Cloud Monitoring query against the free Firebase project's quota
was unavailable. The read-only query subsequently succeeded using the existing
staging quota project; Firebase billing was not changed. See physical evidence below.
No public backend activation or real purchase follows from this internal release.

Mobile configuration, lint and type checks passed; repository foundation
(secret scan, 61 tests and governance) and `git diff --check` passed. All ten
GitHub checks passed for code commit `ddc5633` and evidence commit `d37f81d`, including backend, mobile,
container, contract, infrastructure and repository/governance checks.

### Physical verification and activation preparation — 2026-09-22 (#122 / #164)

The authorized physical Samsung Android phone is connected for diagnostics.
Package inspection confirms version code 2, installed by `com.android.vending`.
Its running Stovio process shows no fatal exception, missing-JavaScript error,
or App Check rejection in the inspected logs. Absence of errors alone is not
the positive attestation evidence: Cloud Monitoring reports one HTTP 200
`google.firebase.appcheck.v1.TokenExchangeService.ExchangePlayIntegrityToken`
request in `stovio-app`, sampled at `2026-09-22T10:37:12Z`, following one successful
challenge request. This corroborates real token issuance for the physical test;
no token was extracted, printed, or persisted as test evidence. Backend acceptance
of that token and the hosted catalog journey still require endpoint activation.

Repeated the private candidate health/readiness, absent-staff, unsigned-callback
and five missing/invalid App Check checks successfully. Promoted the verified
enforcement revision `stovio-consumer-test-00002-yit` to 100% while retaining
internal ingress and Google invoker authentication. This supersedes the earlier
disabled-enforcement serving revision and prevents exposing it at activation.

A saved, unapplied activation plan proposes no creates/deletes, secret changes,
new IAM grants or budget-amount/notification changes. It opens only the existing
consumer service to internet HTTPS with App Check enforced, retains sandbox
purchases and the one-instance-per-revision limit, and keeps the staff service
private. The shared App Check input also enables enforcement in the private API
template; ordinary API traffic remains on its existing revision. Remaining plan
differences are provider normalization of the existing budget project selector,
zero-minimum scaling and deployment metadata. The BRL 588/month alert remains
an alert, not a spending cap. This plan awaited the separate approval recorded
below; no production release or real payment is authorized.

### Protected test access activated — 2026-09-22 (#122 / #164)

The founder explicitly approved: "Activate protected test access." Applied the
reviewed saved plan successfully, with three in-place updates and no resource
creation/deletion, secret-value changes or new IAM grants. Persisted the approved
public-access and App Check enforcement settings in the ignored active staging
inputs so a subsequent plan cannot silently restore the old configuration.

Both the normal consumer origin and its existing `app-check` tagged origin passed
external checks without Google invocation credentials: readiness returned 200,
staff paths returned 404, the unsigned RevenueCat notification returned 403,
and all five missing/invalid App Check cases returned 401 `app_check_required`.
Every routed consumer revision enforces App Check, uses sandbox purchases and
retains maximum one instance per revision. The ordinary staff API remains private
and rejects unauthenticated external access. Existing isolated cloud smoke-job
executions passed against both services after activation. No credentials, tokens,
personal records or provider event bodies were included in repository evidence.
A follow-up plan preserves the approved access and verification settings; its
remaining differences are only the existing budget ID/number representation and
zero/default scaling normalization. It is not a zero-difference plan. Repository
safety (628 files), all 61 repository tests, governance and whitespace checks passed.

The staging GitHub deployment workflow was not dispatched: its cloud identity is
restricted to `main`, and this draft PR has not been approved for merge. The live
checks above used the workflow's public-boundary checker and existing cloud smoke
job directly; they are not a claimed successful GitHub staging deployment. That
deployment remains a release gate after reviewed merge. All ten PR checks passed
on preceding evidence commit `a1182e7`.

The founder retried on the physical phone and confirmed the error disappeared,
leaving an empty catalog. Normalized Cloud Run request evidence corroborates an
Android catalog request returning 200 on `stovio-consumer-test-00002-yit`, where
App Check remains enforced. This establishes hosted acceptance of the verified
app request; no device token or account data was collected as evidence.

### Hosted generated catalog populated — 2026-09-22 (#164)

Read-only database inspection confirmed zero series, episodes and media assets.
Copied only the existing self-owned `Stovio playback check` fixture from the
local test database, in one transaction: one series, one season, two episodes and
two references to existing Bunny test-library assets. No user, wallet, receipt,
entitlement or licensed-content rows were copied; no media was uploaded again.
Source provenance and file checksums were verified. The FR / Android / Google
Play / English scope, caption metadata and publication validations were retained.

Both 12-second generated videos passed live provider readiness, portrait/caption
checks, signed master and variant playlist retrieval, and unsigned/expired-link
403 rejection. Django publication validation and catalog selection passed against
the hosted database using its secure sandbox configuration. Episode 1 remains
free; episode 2 remains locked with the existing one-coin test price. Repeating
the import preserved the same rows without duplication. These application-level
checks do not substitute for watching playback on the physical phone.

The founder confirmed the first generated episode played successfully on the
physical phone. At its end, the app displayed "Unlock this episode to keep
watching," as expected for the locked second episode. This is founder-observed
store-installed physical-device evidence for catalog access, free playback and
the transition to the second-episode lock. It does not establish an authenticated
coin unlock, purchase credit, replay persistence or callback delivery. Those
hosted journey checks and sandbox callback setup remain outstanding. No
production release or real payments were enabled.

The founder then confirmed Google sign-in on the physical phone, followed by
the second-episode lock and a Coins page offering the existing 100-coin pack at
EUR 1. Read-only hosted accounting inspection found one wallet, zero ledger
entries, zero net coins and zero unlock receipts before checkout. The displayed
price is not evidence that this phone's Google Play checkout uses a test payment
method; that must be checked before completing any order. The founder reported
returning to Home to sign in, which is a navigation observation to review after
the functional journey. No checkout, credit or unlock is claimed by this step.

### Physical approved and declined checkout — 2026-09-22 (#164)

The founder confirmed the Google Play test payment options on the physical phone:
first an approved test-card purchase of the 100-coin pack, then an always-decline
test-card attempt. The displayed final balance was 100 coins. Fresh read-only
hosted accounting checks found exactly one 100-coin purchase credit and one
credited `com.stovio.app` decision, with matching wallet, purchase identity,
amount and ledger links; no quarantined decision, unlock debit or unlock receipt
exists. The declined attempt produced no extra credit. This validates the basic
approved/declined physical checkout sequence without real payment; it does not
prove callback delivery, refunds or interrupted/pending purchase recovery.
The next device gate is one-coin unlock, second-episode playback and persistence
after restart/replay, with an expected balance of 99 coins and no second debit.

### Hosted unlock build gate corrected — 2026-09-22 (#164)

The physical test exposed a client routing bug: version 2 passed
`coinsEnabled=false` outside the local API environment, even with a funded wallet
and hosted sandbox spending enabled. The phone therefore displayed no available
unlock method and "Coin unlocks are unavailable in this build." No unlock or
99-coin outcome is claimed for version 2.

The unlock route now admits Android staging builds with validated RevenueCat
sandbox configuration, retaining the server's `spending_available` check and
existing price confirmation, owner checks and idempotent unlock request. Local
Android behavior is preserved; production, iOS, disabled sandbox configuration
and server-disabled spending remain blocked. Android version code advances to 3.
A route-level test reproduced the exact unavailable message before the fix and
now covers confirmation, the server-priced request and continuation to playback,
plus the disabled cases and local compatibility. All 531 mobile tests (53 suites),
lint, formatting, type checking, Expo configuration and API contract checks passed.
Scoped correctness, security, maintainability and performance review found no
additional issue. Repository foundation passed (629-file safety scan, 61 tests,
governance), and all ten GitHub checks passed on fix commit `3b8d862`.

`python .tmp/stovio-migration/build_hosted_v3.py` passed in 3m 41s: 802 Gradle
tasks, 58 executed and 744 up-to-date. The private verifier passed bundletool,
signature, package/version/embedded settings, known-secret/private-key scan and
16 KB alignment for all 44 native libraries. The default Python lacked the
verifier's cryptography dependency; rerunning with the repository virtual
environment succeeded. No build change was needed for that tooling error.

The artifact `Stovio/play-release/stovio-hosted-v3.aab` is 55,087,384 bytes,
SHA-256 `55f9eec171e90028f39d18f64486fd16efd0ded535e7ac073d94c0a9cad8c412`.
It retains package `com.stovio.app`, version name `0.1.0`, the upload certificate,
App Check enforcement and sandbox-only purchases. Google Play accepted the
checksum-verified Desktop copy and shows `Stovio 0.1.0 - Hosted coin unlock fix`
as **available to internal testers** on the existing track. No supported devices
were lost. The only warning is the missing deobfuscation file with minification
disabled. No production/closed-test release or Git merge was performed.

At rollout, read-only accounting showed 100 coins, one purchase credit and no
unlock debit. The founder was asked to install the Play update and check for
the one-coin option.

### Physical coin unlock and navigation replay — 2026-09-22 (#164 / #187)

The founder confirmed unlocking episode 2 for one coin, playing it, leaving the
player and reopening the episode successfully without another unlock. This is
physical navigation/replay evidence after the update request; the installed
version was not independently inspected in this pass because the phone was
unavailable to ADB.

Fresh read-only hosted accounting confirms exactly one 100-coin purchase credit,
one one-coin unlock debit, a 99-coin balance and one durable episode-2 unlock
receipt. The receipt matches the wallet and debit, the expected and charged price
are both one coin, and the episode belongs to the generated test fixture. There
are no quarantined purchase decisions and no second debit from replay. Only
normalized counts and amounts are recorded here; no account or receipt identifiers
or provider payloads are included.

The one-coin unlock and navigation replay checks pass. The founder subsequently
confirmed fully closing Stovio, reopening it and playing episode 2 without another
unlock on the physical phone. Restart/replay persistence therefore passes as
founder-observed evidence. The 99-coin accounting result above predates that final
restart; this confirmation did not include a fresh balance reading or server query.
Interrupted/pending purchase recovery,
refunds, provider callback delivery and the remaining release gates remain open;
this evidence does not establish complete launch readiness.

### Hosted notifications and genuine refund — 2026-09-22 (#164 / #169)

The saved RevenueCat integration still targeted the retired temporary receiver.
Updated that existing integration to **Stovio hosted sandbox lifecycle** and
`https://stovio-consumer-test-4qqbien72q-od.a.run.app/v1/purchases/revenuecat`.
Sandbox-only scope, the single Stovio Play app, cancellation/non-renewing-purchase
filters, Authorization and HMAC signing are unchanged. Both pinned hosted
credentials match the existing private test credentials; neither was rotated.

A provider-issued TEST delivery returned HTTP 200 with no ledger mutation. The
founder's genuine purchase delivery had failed against the old address; manual
provider retry reached the hosted receiver successfully. Read-only accounting
then showed two normalized credited events (client verification and notification)
but exactly one 100-coin ledger credit, one one-coin debit, a 99-coin balance and
one saved episode unlock. This proves delayed notification after client credit
does not duplicate funding; it is not a second successful webhook redelivery.

Refunded that same no-charge sandbox purchase through RevenueCat. Its customer
history reports the refund, its API reports `refunded`, and hosted accounting
contains a `refund_after_credit` review event. The original credit/debit, 99-coin
balance and saved unlock remained unchanged. This is the approved quarantine
behavior, not an approved commercial refund settlement policy: D-008 remains a
production gate for compensation or entitlement removal.

Using the unchanged backend source with the live hosted configuration, normal
synchronization, digest-based recovery and synchronization again all returned
`review_required` with 100 historical credited coins. Fresh provider reads were
used. The original transaction retains one decision and one immutable credit;
its purchase-history entry remains in review and the unlock is preserved. This
is direct service-level genuine-provider evidence, not an authenticated mobile
HTTP recovery or interrupted-device checkout claim. No raw provider payloads,
credentials, account IDs or order IDs are retained in public evidence.

Validation:

- `pnpm --filter @stovio/mobile test --runInBand checkoutCoordinator pendingPurchaseAttempt revenueCatProvider hostedSandboxCheckout`: 135 tests, four suites passed.
- `.venv/Scripts/python.exe -m pytest backend/tests/commerce backend/tests/wallet -q -x -p no:cacheprovider --tb=short`: 371 passed.
- Full `backend/tests` via `pytest.main`, with the loopback-only test database
  explicitly named `test_stovio_launch_verification`: 769 passed in 133.52 seconds.
  The name isolates this run from concurrent local work. Earlier broad execution
  emitted setup errors and was interrupted; a focused notification run passed
  58 tests and the subsequent complete isolated run passed. No production or
  hosted database was used for pytest.
- Backend lint, formatting (234 files), type checks (230 files) and migration
  drift checks passed.
- Live public readiness returned 200; both staff paths returned 404; an unsigned
  notification remained rejected with 403 after the destination change.

Read-only Play Console inspection still shows a draft app and only three of
11 setup tasks complete. Privacy policy, sign-in/reviewer access, content rating,
target audience, Data safety, financial-features declaration, category/contact
information and the store listing remain incomplete. Closed testing has zero
opted-in testers; the dashboard requires 12 testers continuously for 14 days and
a production-access application. No declarations or release submissions were
made during this inspection.

### Play Console setup and review account — 2026-09-22

The founder authorized filling the reviewer-account, target-audience and
financial-features items for the internal test. Nothing was sent for review, and
no release, closed test or production access was requested.

- **Financial features:** saved as "My app doesn't provide any financial
  features". Coins are bought only through Google Play and spent only inside
  Stovio. They cannot be withdrawn, transferred or exchanged for cash. The
  declaration waits in Publishing overview until a release is sent for review.
  Revisit it if D-008 consumer terms ever allow transfer or cash value.
- **Firebase email/password:** the `stovio-app` project had only Google sign-in
  enabled, although D-030 keeps email/password. Enabled Email/Password; the
  passwordless email-link option stays off.
- **Review account:** created Firebase Email/Password user
  `pharaujo1094+stovio-play-review@gmail.com` in `stovio-app` and confirmed
  that it signs in. The password is stored only in the ignored local file
  `private/play-review-account.txt` and must be entered in Play Console. It is a
  test identity with zero coins, not a production account. Before public
  release, create a fresh review account, rotate the password and update Play
  Console. Google reviewers cannot buy coins, so production review also needs a
  documented way to reach paid episodes.
- **Sign in details:** set "Is any part of your app restricted?" to Yes. Adding
  the review account failed four times with "Your changes couldn't be saved"
  and no field error; typed input made no difference. Still incomplete.
- **Target audience and content:** Play requires Sign in details to be finished
  first, so it is not started.
- Content rating, privacy policy, Data safety, category/contact details and the
  store listing were not changed.

### Delayed-payment failure and notification connection — 2026-09-22

The founder selected Google's delayed-approval test method and closed the app.
Play recorded pending at 11:54:53 UTC, processed at 11:55:54, then refunded at
12:00:55. The founder subsequently supplied Google's cancellation email confirming
that the test purchase was not acknowledged. RevenueCat had no
new purchase for the test identity, and hosted accounting retained one credit,
one unlock debit, balance 99 and the existing permanent unlock. The email's
generic five-day estimate was not the actual outcome. This device test **failed**;
do not record the unchanged balance as successful pending recovery.

The founder explicitly approved connecting Play notifications. Engineering
created `projects/stovio-app/topics/stovio-play-notifications`, granted the
existing `stovio-revenuecat` service account Pub/Sub Editor in `stovio-app`, and
granted Google's notification service Pub/Sub Publisher on this topic only.
RevenueCat shows Connected to Google. Play settings were saved with subscriptions,
voided purchases and all one-time products enabled. Play confirmed Test
notification sent; RevenueCat recorded receipt at 12:13 UTC. Firebase project
billing remains disabled. Existing credentials and their values were preserved.

The local coordinator fix initializes the native provider on load/check when an
unknown pending attempt survives restart. It retains that attempt, binds the
server identity and never opens checkout or infers credit. Exact saved purchase
references can still reach authoritative server recovery when SDK initialization
is unavailable. Independent review caught and corrected that outage case for
both load and check. Verification: the initial two restart regressions failed;
after the fix, `pnpm --filter @stovio/mobile test --runInBand checkoutCoordinator
pendingPurchaseAttempt revenueCatProvider hostedSandboxCheckout` passed 142 tests
in four suites. `pnpm mobile:typecheck`, scoped ESLint from `mobile/`, and scoped
Prettier checks passed. This code is local and is not in the Play-installed build.

Unknown-reference resolution remains a launch blocker: SDK initialization alone
does not correlate an attempt to a purchase or safely clear its marker. RevenueCat
tracking of previously unknown purchases from notifications remains off because
its anonymous/obfuscated identity behavior has not been integrated with Stovio's
strict owner verification. A received test notification proves routing, not
closed-app completion or consumption of a previously unknown purchase. Implement
exact attempt correlation and terminal-state recovery before repeating this
device test. Do not erase the current marker, infer cancellation from empty
history, or manufacture a wallet credit.

Automatic retry timing, provider API outage, refund before credit, account
isolation/reinstall and the wider release matrix remain separate open checks.
The installed app still blocks repurchasing because its local pending marker has
no exact store reference. The cancellation email confirms the store outcome but
cannot remotely erase that marker. A fresh read-only hosted check again found
99 coins, one credit and the existing unlock. Do not claim that connecting
notifications or the local startup patch has unblocked this installation.

No real payment, production activation or Git merge occurred. See
[RevenueCat notification behavior](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications)
and [Google's test-payment guidance](https://developer.android.com/google/play/billing/test).

The code keeps the existing private service for staff. An optional second service
runs the same image with `config.settings.hosted_sandbox`, DEBUG off, verified
Firebase identity and consumer-only routes. `/admin/` and `/internal/staff-masters/1`
return 404. Production settings still reject coin purchases and spending. Synthetic
purchases remain local-only. The hosted mode accepts only verified Android SANDBOX
products and uses existing coin accounting, ownership checks and recovery.

The public origin can receive RevenueCat's signed notifications directly at
`/v1/purchases/revenuecat`. Both the configured Authorization header and
`X-RevenueCat-Webhook-Signature` remain required. Preserve the provider's HMAC
signing configuration; no signing bridge is needed. The callback is exempt from
App Check, not from purchase authentication. See [RevenueCat signing](https://www.revenuecat.com/docs/integrations/webhooks).

## Smallest proposed topology and cost

- Existing Firebase, Supabase, private Cloud Run service, image registry and
  deployment workflow remain in place.
- One opt-in consumer service: request-based billing, 1 vCPU / 512 MiB per
  instance, minimum zero, approved maximum one per revision, concurrency eight, 60-second
  request timeout. The input requires an explicit choice of one to three instances.
- A dedicated consumer identity reads only the configured numeric secret versions.
  It has no staff upload bucket grant. A custom role in the configured Firebase
  project grants only `firebaseauth.users.get` for revoked-token verification and
  `firebaseauth.users.delete` for authenticated account deletion.
- No domain, DNS zone, load balancer, Cloud Armor subscription, queue or new database.

Cloud Run's generated address provides HTTPS and Google frontend DoS protections.
It does **not** provide the configurable Cloud Armor rules proposed in #121;
application throttles are not equivalent distributed abuse protection. That issue
remains open; direct public tester activation requires accepting this limited scope.
[Google security model](https://docs.cloud.google.com/run/docs/securing/security).

Scale-to-zero avoids provisioned idle capacity but is not a promise of a zero bill.
Compute, requests, internet transfer, image storage, secrets and logging can incur
usage charges. The instance maximum is a capacity control, not a spending cap,
and Cloud Run can briefly exceed it. Candidate/previous revisions can overlap,
so the total service can exceed the per-revision limit during rollout. The pinned
Google provider does not support a service-wide maximum field. Existing database
and video bills are separate.
Before activation, record the founder's monthly testing budget, alert recipient,
selected capacity and pricing estimate for the anticipated testing traffic.
The private bootstrap uses the approved existing staging alert budget above.
No traffic forecast has been supplied, so no total monthly price is claimed
here. [Cloud Run pricing](https://cloud.google.com/run/pricing),
[instance limits](https://docs.cloud.google.com/run/docs/configuring/max-instances).

## Activation order — engineering work after approval

1. Merge the reviewed PR only on the founder's instruction. Existing staging CI
   remains unchanged while `HOSTED_SANDBOX_SERVICE` is empty and `hosted_sandbox`
   is null. Record the successful image digest from that deployment.
2. Review the private saved infrastructure plan. Populate `hosted_sandbox` in the
   ignored staging variables with a distinct service name, the new image digest,
   explicit maximum, the existing RevenueCat project and secret **names/versions**.
   Start with `public_access = false`. Do not put secret values into OpenTofu.
   No production database may be used for this sandbox.
3. Provision any missing Secret Manager containers and upload approved existing
   sandbox values using private files. The service needs `DJANGO_SECRET_KEY`,
   `DATABASE_URL`, `COIN_PURCHASE_PRODUCTS`, `COIN_PURCHASE_AUTHORIZATION`,
   `COIN_PURCHASE_SIGNING_SECRET`, `REVENUECAT_API_KEY`. When Bunny is enabled,
   also supply its API/token secret references and existing library/CDN settings.
   The infrastructure binds access but does not create secret containers/versions.
   Preserve all existing package amounts, prices and registry bindings.
4. Obtain approval for the exact plan/cost, then apply the private bootstrap.
   Verify IAM, settings, secret versions, database isolation and the image digest.
   The new image must include hosted settings; never bootstrap with an old image
   or a placeholder server. No image contains secrets.
5. Set the GitHub **staging** variable `HOSTED_SANDBOX_SERVICE` from the output.
   Run the existing staging workflow. It checks both candidates before either
   promotion; the consumer check verifies health, staff exclusion and rejection
   of unsigned callback requests. It uses the existing isolated smoke job with
   only invocation credentials, not application/provider credentials.
6. Complete Firebase App Check setup using the existing Android app and release
   signing certificate. Any outstanding provider terms need founder action.
   Confirm real Play Integrity evidence; mock tests cannot establish this. Setting
   App Check on shared staging inputs also affects the private service's consumer
   APIs; it does not affect staff pages. Public opt-in rejects disabled App Check.
7. Review the activation-only plan (`public_access = true`, App Check enforced).
   After approval, apply it and immediately run the staging workflow. For a public
   service it additionally probes the candidate from the external GitHub runner
   without credentials: health succeeds, staff paths are absent, the catalog
   rejects missing App Check, and unsigned purchase notifications are rejected.
   Any failure prevents promotion. Revert public access immediately if the newly
   activated current revision fails these checks.
8. Configure the existing RevenueCat **sandbox** integration to the permanent
   service output plus `/v1/purchases/revenuecat`, keeping both authentication
   settings. Send one provider TEST delivery and verify acceptance privately.
   Neither secrets nor raw event bodies belong in GitHub evidence. No tunnel or
   local server should remain in the callback path.
9. Use [the Android staging configuration](../../mobile/staging.env.example)
   with the permanent URL and existing public RevenueCat SDK identifier. Keep
   ads and analytics off. Build/sign the Android release with embedded JavaScript,
   and distribute through the existing Play internal test process only.

## Focused live acceptance

The end-to-end device checks below are **partially complete**. Physical hosted
testing has passed catalog access, Google sign-in, free playback, approved and
declined test checkout, one credit and unlock debit, and replay after fully closing
and reopening the app. Private service and permission checks passed as recorded
above. Checkout cancellation and unavailable-content rejection also have earlier
local emulator evidence; that does not substitute for hosted physical validation.
Interrupted checkout, genuine refunds/callbacks and the hosted outage matrix remain
open. See [the exact device evidence](stovio-rebrand.md).

- With the founder's computer/local services stopped, a registered test account
  opens the catalog, signs in, plays an eligible episode and sees its server balance.
- Home coin icon opens the unified balance/purchase screen. Existing package
  values and store prices remain unchanged.
- The exact Play account is registered as a license tester. The payment sheet
  explicitly shows a test method and no charge; cancel if it offers real payment.
  A client `revenuecat_sandbox` flag cannot force Google Play into test billing.
- One approved test checkout gives one server credit, a permanent authenticated
  notification reaches Cloud Run, and one episode unlock persists after restart.
- Staff endpoints stay inaccessible at the public URL. Firebase revoked-token
  verification and account deletion permissions work for a disposable test user.

Record only normalized outcomes and opaque support references in private evidence.
Never upload account details, receipts, tokens or provider payloads.

## Rollback and remaining paid-launch work

First disable public access (`public_access = false`, restore invocation checks)
if there is an exposure or verification failure. Disable the provider sandbox
destination while investigating; do not acknowledge unverified events as success.
For a code regression, promote each previously verified image revision explicitly.
Both service checks occur before promotion, but two Cloud Run promotions are not
an atomic transaction: if the second promotion fails, restore the first service's
recorded previous revision. Schema changes are absent in this preparation.

Remove `HOSTED_SANDBOX_SERVICE` only after stopping that service's public traffic;
an empty CI variable does not disable an already running service. Keep numeric
secret versions needed by rollback images authorized until they are retired.

This slice does not authorize live commerce or resolve its commercial/refund
policy, launch content rights, final privacy/store publication or #121 distributed
abuse controls. Those stay visible release decisions rather than being silently
treated as completed by a successful test purchase.

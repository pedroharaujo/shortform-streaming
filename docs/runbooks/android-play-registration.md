# Android Play product registration

Scope: issue #164, D-036, P3-T04/P3-T06. This is the initial store-registration
step for the isolated Android test journey, not production activation.

**Superseded registration:** the evidence below records the previous app and
must not be used to configure or upload Stovio. The new application is
`com.stovio.app`; see [Stovio migration status](stovio-rebrand.md) for current
service identities, signing preservation and remaining store checks.

## Stovio replacement, 2026-09-21

The new signed registration bundle is
`%LOCALAPPDATA%/Stovio/play-registration/stovio-registration-v1.aab`.
Package `com.stovio.app`, version 1 / 0.1.0, target SDK 36, ARM64; SHA-256
`89bdb5c9700184168a2440410c787dffcc62532e959eb5aeec54d483d3500dbe`.
Bundle validation, original upload-certificate match, signature, ZIP integrity,
22 native libraries' 16 KB alignment and bounded private-secret scans passed.
Purchases, ads, analytics and App Check remain disabled; cloud Auth is selected
and the API is local. This is registration evidence, not a launch build.

Google Play accepted the signed bundle and version 1 was released to internal
track `4701745217816412686`. The existing founder tester list is selected and
the track is Active. The new `test_coins_100` / `buy` product is active,
backwards compatible, single quantity and France-only at displayed EUR 0.99;
other and new regions are unavailable. RevenueCat saved `com.stovio.app` and
the founder-provided Stovio credential, and all three credential checks pass.
Existing RevenueCat customer/five sandbox purchase IDs were preserved.

Play signing fingerprints were registered in Firebase and the ignored native
configuration refreshed. A genuine purchase/recovery and Google sign-in/playback
journey on the new package remain pending. Do not upload the old artifact below
to the new app or treat historical device evidence as validation of Stovio.

## Coin pack price tiers (D-041), 2026-09-22

Django Admin now owns coins, bonus, badge and order for each pack (Admin →
Commerce → Coin packs). Google Play owns only the price. Each tier below is one
Play in-app product; Admin packs point to it by product ID. These are test
tiers for the internal track; launch prices remain a D-008 decision.

| Play product ID | Purchase option | France price | Local example pack |
|---|---|---|---|
| `coins_099` | `buy` | EUR 0.99 | 100 coins, "Quick top-up" |
| `coins_499` | `buy` | EUR 4.99 | 500 + 10%, "Most popular" |
| `coins_999` | `buy` | EUR 9.99 | 1,000 + 20%, "Best value" |
| `coins_1999` | `buy` | EUR 19.99 | 2,000 + 50%, "Limited time" |

Setup for each product, matching `test_coins_100`: Play Console → Stovio →
Monetize with Play → Products → One-time products → Create; single quantity,
backwards compatible, France only with the final displayed price above (check
that bulk pricing did not add tax), then activate. Product IDs are permanent.

Then in RevenueCat, import the four products for `com.stovio.app` (Products →
Import); no entitlement or offering is needed. Finally add each ID to the
server registry (`COIN_PURCHASE_PRODUCTS`, `approval_reference` `D-036`) with
`coins` set to the base coins; that value is the minimum a purchase credits.
Local design preview needs none of this: `manage.py seed_coin_packs` creates
the example packs.

## Verified artifact, 2026-09-19

An existing release bundle was revalidated and copied to a stable private
location outside the repository. No new build or application change was needed.
The private handoff directory is `%LOCALAPPDATA%/ShortformStreaming/play-registration/`.

- File: `shortform-registration-v1-eddc7405e563.aab`
- SHA-256: `eddc7405e5634f9e560ce39f5a8bf52a8c719d98c460b23197484572f22bff16`
- Size: 41,523,070 bytes
- Package: `com.shortformstreaming.app`; version name `0.1.0`; version code `1`
- Target SDK: 36; native architecture: ARM64
- Billing permission present; `debuggable` and `testOnly` false
- Purchases, ads and analytics disabled; local Auth emulator configuration

This frozen registration bundle predates the current UI work. Its purpose is to
let Google Play recognize billing support and enable coin-product setup. It is
not the emulator checkout build and does not demonstrate a successful purchase.
Keep the emulator's separate debug installation and data intact.

## Validation evidence

The following checks passed on the exact copied artifact:

- Google bundletool 1.18.3: `java -jar <bundletool> validate --bundle=<aab>`.
- `java -jar <bundletool> dump manifest --bundle=<aab>`: package, version,
  billing permission, target SDK and non-debug/test-only flags verified.
- `jarsigner -verify <aab>`: valid signature. The expected self-signed Android
  upload certificate is distinct from the development certificate.
- ZIP integrity and SHA-256 equality after copying.
- All 22 packaged native libraries have ELF load-segment alignment of at least
  16 KiB.
- Embedded Expo configuration inspected for the disabled modes above.
- Archive scan found no matching checked local secrets, Play service private
  key material, private-key headers or RevenueCat secret-key patterns. This is
  a bounded check, not a claim that pattern scanning detects every possible secret.

Detailed machine-readable evidence remains beside the private artifact in
`validation.json`. Signing material and service credentials must stay outside
the repository and must not be attached to issues or pull requests.

## Handoff and remaining gates

The founder manually uploaded the verified bundle after Chrome denied the
automated chooser upload. Google Play processed version code 1 and reached
the internal-release preview with one non-blocking deobfuscation-file warning.
Coin-product creation is now available. The registration release was subsequently
published to the internal track after verifying that only the existing
one-person founder tester list was selected. Google Play shows the track as
active and version code 1 as available to internal testers. No production
rollout or completed purchase is claimed.

The first isolated test product is configured and active in Google Play:
`test_coins_100`, purchase option `buy`, 100 coins, France only, final displayed
price EUR 0.99, single quantity and backwards compatibility enabled. New regions
remain unavailable. Bulk pricing initially added tax; the country price was
corrected and saved as EUR 0.99 before activation. This is a D-036 test pack,
not a commercial-price approval under D-008.

RevenueCat now has the matching Play Store consumable `test_coins_100`.
Its store status is "Could not check" until the Google Play service credential
connection is completed. No RevenueCat entitlement or offering is needed for
this adapter: Django supplies allowed product identifiers and the SDK fetches
non-subscription products directly.

The founder explicitly approved the Play service-account grant and credential
upload. The invitation was submitted and Google Play shows the service account
as active. Its permissions apply only to the test app: view app information (including the
dependent read-only app-quality permission), view financial data, and manage
orders/subscriptions. Account-wide, administration, release, store-presence and
policy permissions remain unselected. Chrome denied the subsequent credential
file chooser upload (`Not allowed`). The founder then uploaded the existing
private file manually, and the app settings were saved in RevenueCat.
Both catalog-read validation checks pass. Purchase validation initially failed
because Google could not find the package, despite the matching package name.
This prompted completion of the previously unpublished internal release.
RevenueCat subsequently displayed **Valid credentials**, confirmed directly in
the dashboard. The credential value remains private. Genuine checkout remains
unverified; credential validation is not purchase or release acceptance.

RevenueCat documents initial Play setup and propagation as possible causes of
this error. Recheck credentials after Google processes the internal release;
new credentials may take up to 36 hours to propagate. Do not recreate keys or
expand permissions solely to address a package-not-found response. See
[credential troubleshooting](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials/troubleshooting).

The separate x86_64 debug build now embeds cloud Auth, local API and RevenueCat
sandbox checkout with the public Android SDK identifier. Ads and App Check remain
disabled. It compiled successfully and installed as an update without clearing
app data. Emulator storage initially blocked installation; trimming caches and
removing rebuildable Play/Play Services compilation artifacts allowed it to
install. The emulator also required a restart after a System UI startup hang.

Validation: `pnpm mobile:config:check` passed. The targeted mobile provider,
coordinator and package-screen Jest suites passed (99 tests / 3 suites).
`git diff --check` passed. No production purchase mode was enabled.

The founder saved the existing limited-read server key privately. A live product
read passed and matched the expected Play app, Android package, consumable type
and product. Local setup uses the canonical API project identifier (with its
`proj` prefix), rather than the shortened dashboard URL identifier, so the
server's strict project-binding check remains intact. Django configuration
checks passed; the local backend restarted in sandbox mode with the one approved
100-coin test product. Sandbox callbacks remain independently disabled.
The local mobile settings and helper files are ignored by Git; no SDK or server
key value is recorded here. The founder completed cloud sign-in and the home
catalog loaded with the signed-in avatar and a zero-coin balance. Clearing the
Metro cache restored the current route map: the home coin shortcut now opens
the unified Coins screen and Google Play returns 100 coins at EUR 0.99.

The first genuine checkout attempt reached a Google Play error: "The item you
were attempting to purchase could not be found." No payment confirmation was
shown or submitted. The approved test product has no server purchase decision,
and the displayed balance remains zero. The internal release is available to
testers and the one-person founder list is selected for both internal testing
and license testing; tester opt-in and device billing-account alignment still
need verification. Do not attribute the error to credential propagation alone.

After dismissing the store error, the app retains the attempt and shows
"Your purchase still needs to be checked before buying again." The adapter
classifies non-cancellation SDK errors as pending; without a transaction
fingerprint the existing recovery path cannot resolve this attempt. This is a
reproduced blocker, not successful purchase or cancellation evidence. Preserve
the marker; do not clear app data or manually credit coins to bypass it.
Coin spending is also disabled in the current local backend configuration, so
the episode-unlock leg has not been exercised.

The founder accepted the internal-test invitation; Google now confirms tester
enrollment. A bounded adapter fix recognizes the SDK's explicit product-not-
available result from the purchase call, revalidates identity and allows pack
reload without credit. Unknown/store/network errors and post-success failures
remain pending. This does not retroactively classify the previous lost result.
Regression tests failed before the fix and passed after it: 106 tests in the
provider, coordinator and package-screen suites. Mobile typecheck, mobile lint,
API contract check and independent scoped review passed.

A read-only check of the recent test identity returned a complete empty
RevenueCat sandbox purchase history and no server purchase decisions. A private
one-off reset helper passed dry-run checks for the single matching local marker
and preservation of other secure storage. It requires an explicit founder
exception before archiving and resetting the failed sandbox attempt; no reset
or successful purchase is claimed at that checkpoint.

The founder subsequently explicitly approved the one-off sandbox exception.
The original encrypted marker was archived outside the repository. A stalled
device write was stopped while the app remained closed; a staged replacement
was verified before it was moved into place. All other secure-storage values
were preserved. The app reopened signed in with zero coins, and the unified
Coins screen again offered the approved pack. This reset is an operator action
for the observed failed test, not proof of automatic unknown-result recovery.

Retry after enrollment reached the genuine Google Play payment sheet for
"100 Coins — Test Pack", EUR 0.99. The selected payment method is "Test card,
always approves", and Google explicitly states "This is a test order, you will
not be charged." The founder completed final confirmation. The app displayed
100 coins and verified-credit feedback. RevenueCat returned one sandbox purchase;
the local server has one `verified_purchase` decision for 100 coins linked to one
purchase ledger entry for 100. Refreshing the wallet and returning home retained
the same balance, including the home coin shortcut.

On 2026-09-20, an engineering replay through the existing server synchronization
and known-result recovery services re-read genuine provider facts and returned
credited in both cases. The ledger entries were unchanged: exactly one purchase
entry and balance 100. This is server replay/recovery evidence, not a device
process-death, cancellation, refund or second-purchase test. No raw receipt,
provider payload, account identifier or credential is stored in this record.

Local `COIN_SPENDING_MODE=test` was enabled with DEBUG/local-database safeguards;
Django checks passed and the backend restarted. Both generated playback episodes
initially had their existing free offers. The founder approved a one-test-coin
configuration for generated episode 2. Engineering changed only that episode's
access mode and price under the existing catalog locks, ran full model
validation and recorded an editorial revision. Before the device unlock, this
account had 100 coins and no entitlement for that episode. This is local test
configuration, not approval of launch prices. Production spending and
production purchases remain disabled.

The emulator then showed the episode locked and offered the approved one-coin
unlock against a 100-coin wallet. Completing its confirmation produced one
one-coin debit, one immutable unlock receipt and one coin entitlement. The
ledger-derived balance became 99; the original single 100-coin purchase entry
remained unchanged. The app obtained playback authorization and visibly played
the generated 12-second second episode through its end.
Closing and reopening that episode returned directly to the player without an
unlock prompt. A fresh ledger check still showed 99 coins, one purchase credit,
one unlock debit, one one-coin receipt and one coin entitlement. Django checks
and `git diff --check` passed. This completes the observed purchase-to-unlock-
playback happy path; account-switch, restart, cancellation, refund and provider
callback acceptance remain separate unchecked gates.
Preserve existing package quantities and prices; do not treat UI preview
packages as approved commercial configuration.

Further emulator validation on 2026-09-20 observed a second completed sandbox
purchase of the same consumed 100-coin product. The app and ledger showed 199
coins, two purchase credits, one unlock debit and the original single entitlement.
RevenueCat returned a complete history containing two sandbox purchases; there
were exactly two server decisions. No additional unlock charge was created.

A subsequent Google Play checkout was cancelled from its review-and-agree sheet
using Android Back. The app displayed "Purchase cancelled", retained 199 coins,
and allowed packages to reload. Its pending purchase marker was absent afterward,
with other secure storage preserved. Provider history and server records remained
at two purchases/credits. This verifies cancellation at that observed stage;
it does not exercise a declined payment or cancellation after payment submission.

Known-result restart recovery also passed on 2026-09-20. Once the genuine
no-charge payment sheet was open, engineering stopped only the local Django
server. The founder confirmed the test purchase. RevenueCat then contained three
sandbox purchases, while the server still held two purchase credits and a
199-coin balance. The app showed verification pending, blocked another checkout,
and retained one pending marker. No manual ledger adjustment was made.

Engineering force-stopped the app, restored the backend (readiness HTTP 200),
and cold-launched the app without clearing its data. The home coin shortcut
opened Coins with 199 coins and the saved Check purchase action. Selecting that
action returned verified-credit feedback and 299 coins. Provider history,
server decisions and purchase entries each numbered exactly three; the single
unlock debit, receipt and entitlement remained unchanged. The pending marker
was cleared and the other secure-storage entry remained. This exercises a
completed native purchase saved before loss of server verification, followed by
device-process restart. It does not cover termination before the native result
can be saved, pending/declined payment methods, or refunds.

Then verify refund handling and the remaining interruption stages. The unknown-result
recovery gap remains open. Follow [the sandbox runbook](revenuecat-sandbox.md)
and [the first-journey acceptance](android-first-journey.md).

The founder subsequently approved a supervised 30-minute ngrok endpoint limited
to RevenueCat sandbox callbacks and dedicated webhook credentials. Engineering
started only the callback bridge and tunnel, with automatic process-tree shutdown,
local inspection disabled and agent logging disabled. Harmless public probes
confirmed empty no-store 404 for admin, purchase-sync and callback query variants;
the still-disabled callback returned empty 503. No genuine payload was used for
privacy checks. Local captured requests were zero. Ngrok's cloud request detail
showed absent Request URL, zero URL length, zero captured headers, zero captured
bytes and no body. No log exports were configured; limited network/path/status
metadata has the displayed 24-hour retention. These observations verify this test
window's transport controls, not production privacy approval or webhook delivery.

The sandbox-only webhook was then saved for the Android test app, limited to
non-renewing purchases and cancellations. RevenueCat HMAC signing was enabled;
the dedicated authorization and signing secret were retained only in private
local configuration. After enabling the local sandbox callback gate and
restarting the backend, readiness returned HTTP 200. RevenueCat's own Send Test
Event returned HTTP 200 through the public bridge. The wallet remained at 299
coins with three purchase credits, one unlock debit, one unlock receipt and one
coin entitlement. This proves signed provider transport and harmless TEST-event
handling; it does not yet prove genuine purchase or refund delivery.

The earlier purchase events have no delivery destination because they predate
this webhook. The latest no-charge sandbox purchase's refund confirmation was
prepared in RevenueCat; final confirmation is handed to the founder. Refund
delivery and duplicate-delivery evidence remain pending. The approved receiver
still has its original automatic shutdown deadline; this setup does not extend
the public exposure window or enable production purchases.

The founder then confirmed the refund. RevenueCat displayed a successful refund,
a CANCELLATION event and delivery to the sandbox webhook with Response 200. The
server recorded one `quarantined / refund_after_credit` notification against the
existing purchase decision. Balance stayed 299, with exactly three purchase
credits. This is review quarantine, not a completed commercial refund policy:
no compensating debit or entitlement removal is approved by D-008.

Using the exact existing transaction resolved privately from complete provider
history, live provider verification returned CANCELLATION. Two server sync calls
and known-result fingerprint recovery each returned `review_required`; all
ledger rows and the three purchase decisions remained unchanged. The initial
private audit script compared against the pre-binding transaction hash and was
corrected to use the existing application-bound hash before this verification.
No product code or accounting data was adjusted to obtain the result.

RevenueCat exposed no resend action for this successful delivery in either the
event detail or webhook detail. Repeated server reconciliation is verified;
duplicate HTTP delivery, positive purchase callback while the app is closed,
provider-outage redelivery and reordered original purchase delivery are still
unchecked. The temporary supervisor was stopped before its deadline, both test
listeners were confirmed absent, and the local sandbox webhook gate was disabled.
The normal local backend restarted and readiness returned HTTP 200. Continuing
external callback tests requires another explicitly approved temporary window.

The emulator's home coin shortcut then opened Coins with 299 coins. Recent
purchases displayed the refunded purchase as "100 coins credited originally"
with "Review required" and the clarification that the record does not confirm
a refund or final settlement. The other two purchases retained "Credit recorded".
This verifies that the review state reaches the mobile purchase-history screen.

The founder approved a second supervised 30-minute callback window. The same
sandbox/app/event restrictions and signing credentials were retained. The
receiver reported capture disabled; a fresh provider TEST returned HTTP 200.
Generated probes again rejected admin, sync and query variants with empty 404,
and invalid callback credentials with empty 403. Local captured requests were
zero. The baseline remained 299 coins and three credits; two refund-review
records now represent the webhook and provider reconciliation paths.

The emulator opened checkout for the unchanged 100-coin test pack. Google Play
displayed a new "Review and agree" contract screen before the payment sheet;
acceptance was handed to the founder. No new payment or positive purchase
callback is claimed at this checkpoint. The receiver retains its original
automatic 30-minute expiry, and the backend is still running while the legal
prompt awaits the founder.

After the founder accepted the agreement, the Play sheet explicitly showed a
no-charge test order for the unchanged pack. Engineering stopped the local
backend before the founder confirmed payment. Complete RevenueCat history then
contained four purchases, while local accounting still had three credits and
299 coins. The app displayed verification pending and retained one purchase
marker. Public callback probes returned empty 503 during this outage.

The app was force-stopped without clearing data and the backend restored. A
subsequent process check found the app running again, so it was force-stopped
once more; the baseline was still 299 coins. With the app confirmed stopped,
engineering used RevenueCat's Retry action on the genuine pending purchase
notification. The server reached 399 coins and exactly four purchase credits
while another process check still confirmed the app was stopped. RevenueCat
then showed Sent and Response 200. This verifies positive callback credit with
the app closed and operator-triggered redelivery after a receiver outage; it
does not assert automatic retry timing or an upstream provider-API outage.

Cold launch showed 399 on the home coin shortcut. Coins retained Check purchase;
using it returned verified-credit feedback, kept balance 399 and exactly four
credits, and removed only the purchase marker. The other secure-storage entry,
one-coin unlock debit, unlock receipt and entitlement remained unchanged. Thus
client recovery after callback credit did not credit the purchase again.

While engineering opened the next checkout to select a declining test card, the
founder completed another no-charge purchase and explicitly confirmed doing so.
Complete provider history and local purchase decisions each numbered five, with
exactly five 100-coin credits and balance 499. Both positive callback deliveries
showed Sent. Callback and client verification produced seven normalized credited
events in total, but only five ledger credits; the previous refund remained in
review and no purchase marker remained. This additional successful purchase is
not evidence of a declined payment. The declining-card test was then prepared
separately, with the founder asked to wait until the method was selected.
Google Play again displayed its per-purchase agreement before exposing payment
methods; that acceptance is pending founder action. The declining card has not
yet been selected or submitted. Current verified balance is 499 coins.

The founder subsequently accepted that agreement. Engineering selected Google's
"Test card, always declines" and verified it on the final sheet alongside the
explicit no-charge test-order notice. Before submission, accounting remained
499 coins, five purchase credits and the unchanged unlock/entitlement. Final
test submission is handed to the founder; rejection and recovery are not yet
claimed. This follows Google's
[license-tester payment-method guidance](https://developer.android.com/google/play/billing/test).

The founder submitted the declining-card test. Google Play displayed "Declined
by always denied test instrument". Dismissing the notice returned Coins to an
unresolved Check purchase state, with one pending marker. Complete provider
history and server decisions remained at five, balance 499; no credit, unlock
or entitlement changed. No-spurious-credit behavior passed, but useful rejection
recovery failed and remains a launch blocker.

The app had discarded the native error enum. No relevant numeric code was found
in a bounded, privately parsed device-log read; no raw log lines were retained.
An enum-only development diagnostic and a dry-run-verified reset for this exact
observed test are prepared. The reset has not been applied; it requires explicit
founder intervention and cannot stand in for general unknown-attempt recovery.
See the [diagnosis plan](../superpowers/plans/2026-09-20-declined-payment-diagnosis.md).
The public receiver was stopped early, both listeners disappeared, and the local
webhook gate was disabled. Backend readiness returned HTTP 200. The two targeted
adapter/coordinator suites passed 100 tests; mobile lint and typecheck passed
with the temporary diagnostic in place. No rejection-handling fix is claimed.

The founder explicitly approved the one-off reset of that observed declined
test. The guarded helper archived encrypted state privately and removed only
its exact pending marker. The other secure entry, balance 499, five purchase
credits and existing unlock/entitlement were preserved. A subsequent unsubmitted
checkout was cancelled normally: the native inspector captured SDK enum `1`,
Coins showed cancellation feedback and its fresh pending marker cleared. This
validates the diagnostic path without another payment or a second manual reset.
The specific decline enum and the recovery fix remain unverified.

On the repeat diagnostic attempt, the founder submitted the always-declining
test card and Play displayed its explicit rejection. Dismissal produced captured
native SDK enum `3` (`PURCHASE_NOT_ALLOWED_ERROR`). Accounting stayed at 499 coins,
five purchase credits, one debit/unlock/entitlement; the old adapter retained the
pending marker. This isolates the cause of the stuck recovery screen.

A narrow adapter/coordinator fix now handles that native rejection with a clear
message and Reload coin packs, preserving the existing exact-attempt, owner and
session checks. Independent SDK-source and code review found no blocking issues.
Temporary instrumentation was removed. Targeted tests first reproduced the two
failures and then passed 115 tests; all 510 mobile tests, lint, typecheck and API
contract checks passed. The fix is not yet genuinely retested on the emulator:
the diagnostic attempt's old marker still exists. A new guarded one-off reset is
prepared but not applied; prior reset approval has not been reused. Production
purchase activation and the other lifecycle gates remain blocked.

The founder approved the reset for the captured code-3 diagnostic attempt.
The guarded helper applied it with a separate private encrypted backup; there
were then zero pending markers and one unchanged other secure entry. Accounting
remained 499 coins, five purchase credits and one unlock/entitlement. On restart,
the development app stalled at launch; the local Metro port forward was absent
and was restored before another cold launch. This is environment preparation,
not evidence that the genuine declined-payment retest has passed.

The launch failure persisted after restoring the port forward and restarting
Metro. Android's BundleDownloader reported a protocol exception while decoding
the multipart bundle, matching the community reproduction in
[Expo #49111](https://github.com/expo/expo/issues/49111). An opt-in Node-side
Metro workaround, `STOVIO_METRO_PLAIN_ANDROID_BUNDLE=1`, requests ordinary
JavaScript only for Android `.bundle` requests. The default, other platforms,
maps and status requests are unchanged. The local validation launcher opts in.
Routing checks, ESLint and formatting passed; independent review found no
blocking issue. A fresh cold launch then reached Home with the signed-in avatar
and 499-coin shortcut. The workaround removes streamed development-bundle
progress; it is not an upstream fix or a store-build change.

Final declined-payment retest passed: after the founder completed the no-charge
test, read-only inspection showed the new purchase-not-allowed feedback with
payment/account guidance and Reload coin packs. There were zero pending markers,
one other secure entry, 499 coins, five purchase credits and the unchanged
one-coin unlock/entitlement. The observed stuck-decline defect is closed. No
additional checkout was opened. Per founder direction, move to distinct remaining
launch blockers; repeat this scenario only for a new failure or relevant change.

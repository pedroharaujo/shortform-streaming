# Consolidated final validation

This is the step-by-step register for device, manual, provider-account and
external-system checks deferred from development PRs under D-029. A deferral is
never a pass. P6-T03 owns this guide and must expand it as later MVP tasks defer
checks. P6-T05A and Public Release Readiness consume its evidence.

Automated unit, integration, contract, security, migration and repository gates
still run with each change. Never add to this register a check needed to prevent
credential exposure, private-user-data disclosure, restricted-media exposure,
authorization or entitlement bypass, financial corruption, destructive
migration/data loss, or unsafe production activation. Those checks remain
immediate blockers.

## How to add a deferred check

For each deferral, record:

1. Plan task, PR and approved decision.
2. Exact capability that stays disabled or fail-closed.
3. Required private setup without recording secret values or personal data.
4. Device, OS, network, account and generated-fixture prerequisites.
5. Exact commands and manual actions.
6. Expected server-authoritative outcome and failure behavior.
7. Redacted evidence location, tested revision, date and reviewer.
8. Release or production-enablement gate that remains blocked.

## Final execution order

1. Freeze the release-candidate revision and list every unchecked validation item
   from the implementation plan and this register. Missing evidence is a blocker.
2. Run `pnpm check`, `pnpm mobile:bundle:check`, the release configuration checks,
   secret scan, migration checks and dependency review on that exact revision.
3. Provision only generated/self-owned fixtures and approved test accounts. Verify
   production capabilities remain disabled before any provider-owned test setup.
4. Execute P6-T03's supported Android device/OS/network matrix from clean app state.
   Run the full critical-path suite twice; retain bounded retry and flake evidence.
5. Execute privacy, rights/takedown, auth/session replacement, account deletion,
   offline/interruption, playback and accessibility/manual checks.
6. After the required operator/privacy/provider setup is independently approved,
   execute provider journeys in isolated test configuration. Never infer success
   from client events, screenshots or synthetic callbacks.
7. Re-run applicable automated reconciliation/security tests, compare persisted
   server state to expected outcomes, and review all redacted evidence independently.
8. P6-T05A signs off the exact candidate/configuration. Do not promote traffic,
   publish licensed media, enable real ads/coin purchases/paid acquisition or distribute publicly while any
   applicable item below is unchecked.

## Added MVP requirements (2026-09-07; not deferrals or passes)

P3/P4 follow-ups must supply exact commands, private prerequisites, expected states and owner/revision evidence when implemented. The following required matrix extends the final pass; **it does not authorize deferring financial, entitlement, private-data or production-activation checks** under D-029. Automated integrity checks run before each relevant merge.

| Owning tasks | Test prerequisites and actions | Required outcome / gate |
|---|---|---|
| P2-T03-F3 / P3-T01-F1 | Generated titles with free/ad/coin/both policies; synthetic allowed/denied territory/language/segment grants; change policy, price, takedown and window across an unlock attempt | Server active scope cannot be widened by client values. Offers/grants/debits/playback intersect valid rights; unauthorized/expired/unsupported DRM never yields access. P6-T03/P6-T05A blockers |
| P3-T03/T04/T06 | Approved isolated Google Play/RevenueCat tester setup, D-008-compatible synthetic products, generated account; fetch offerings, buy pack, wait for verified completion, repeat/reorder event delivery, interrupt network/callback then reconcile | Store price matches; exactly one verified credit, no pending/client-success credit, no cross-account/environment fulfillment. Record restricted evidence without raw payloads. Financial protections are immediate gates |
| P3-T02 / P3-T08-F2 | Fund a generated wallet via verified test purchase; unlock coin-only/both episodes, duplicate taps/concurrent requests, stale-price changes and account replacement | One atomic debit/entitlement, safe rollback, correct ownership, no negative spendable balance or duplicate charge, fresh playback authorization |
| P3-T04/T06/T09 | Same account reinstall/second Android device; provider refund/chargeback before and after coin spend; delayed/duplicate/unknown-user events, deletion then late callback | Persistent server balance without re-crediting consumables; approved compensating policy, quarantine/support for unresolved states; store/ledger/entitlements reconcile; no accidental financial cascade loss |
| P4-T01-F5 / P4-T06 | Approved test attribution and consent state, Google Play tester link/install, bounded source/campaign/creative, private generated spend import; repeat install, withdraw consent, replace account | Deduplicated coherent cohort keys or explicit unmatched/consent-limited result; no raw personal referrer, unauthorized tracking or identity adoption. Live spend stays off pending D-017/P6 |
| P4-T02/T03 | Generated cohort with known ad/IAP/refund/cost/spend facts, late/duplicate records, multiple original currencies, missing joins and immature dates; rerun model/import and stop a feed | Same reconciled metric totals; observed versus projected LTV, consent/maturity/unmatched coverage and allocation residual visible. Missing inputs unknown; failure/hold procedure works. Private output only for real data |
| P0-T03 / P2-T02 / P6-T04 | Review new Google/RevenueCat, financial audit, attribution and warehouse processing; test deletion/opt-out and actual binary/network flows | D-020-approved region/retention/minimization, legally required finance retention and processor cleanup; declarations and notices cover the exact binary. No production enablement inferred |

Initial paid-test activation also requires one approved audience, approximately 3–5 independently cleared titles and paid creatives, D-008 terms/prices, Google finance/EUR settlement, genuine AdMob #98 evidence and D-017 capped budget/business guardrails. Subscriptions, iOS, Looker, Remote Config, push and an automatic MMP remain outside this MVP gate. Conditional MMP need is D-018.

## Deferred validation register

### P4-T01 — Firebase Analytics consent, identity, account, and product trail

**Historical action list caveat (2026-09-07):** The F1–F4 trail below includes discovery/offer/progress/ad-lifecycle names removed from the narrowed 2026-09-02 schema. Current implemented names are listed in the SDK inventory. Preserve the earlier deferral evidence, but update exact trails when P4-T01-F5 restores the required MVP measurement; do not report removed events as passing now. Production consent remains a no-op until release implementation/approval.

- **Source:** P4-T01 F2a/F2b/F3a/F3b/F4 and account-funnel triggers; D-029;
  implementation revisions to be recorded after merge.
- **Disabled/fail-closed state:** every native Analytics collection and advertising
  identifier default is off. Only a current authenticated session whose `/v1/me`
  response has `analytics_consent=true` may enable collection or link the opaque
  backend profile ID. Account, discovery, playback, and reward events are instrumented.
- **Production gate:** production builds select a hard no-op adapter even when the
  stored preference is true. Removing that gate requires the applicable D-020,
  privacy/store, and P6 approvals for the exact release candidate.
- **Prerequisites:** clean Android development build, generated Firebase test
  project configuration, supported Android device/emulator, Firebase DebugView,
  one not-yet-created generated credential plus one existing generated account,
  both with server preferences off. Do not record configuration contents, device
  identifiers, or provider payloads.
- **Actions:** install the clean build and clear app data; confirm the anonymous state
  emits nothing; create the first generated account and confirm consent-off emits
  nothing; save analytics consent without replacing that session; open home, select
  the generated series, play its free episodes through
  autoplay, display a locked episode, accept the disclosed test-ad offer, complete
  the permitted test ad, and wait for owner-only verified status; then withdraw
  consent, sign out, log in to the second generated account, confirm it inherits
  nothing, enable its consent, and complete its deletion while inspecting DebugView
  and bounded device logs.
- **Expected:** nothing is collected before server-confirmed consent; consent-on
  links only that account's opaque backend profile ID; withdrawal, sign-out,
  replacement, and deletion disable collection, clear identity, and reset local
  Analytics state. The second account never inherits the first identity or consent.
  A server-confirmed password/Google login records one method-only `login`. If a
  generated sign-up occurred before consent, enabling consent in that same session
  records one method-only `sign_up`; replacement never backfills it. Accepted
  deletion first detaches and resets the identity, then records one status-only
  `account_deleted`, and finally disables collection. It has no profile, session,
  country, email, credential, Firebase UID, or deletion-receipt property.
  The consented free journey is ordered as `app_open`, `home_viewed`,
  `series_impression`, `series_opened`, `episode_started`, owned
  `episode_progress` checkpoints, one accepted `episode_completed`, the next actual
  `episode_started`, and one `locked_episode_viewed` when the lock is displayed.
  Retries, remounts, progress throttling, completion, and autoplay do not duplicate
  logical events. Terminal playback failures contain only the documented safe code
  and phase, never a signed URL or provider message.
  The rewarded continuation is ordered as `locked_episode_viewed`,
  `offer_presented`, `offer_selected`, `rewarded_ad_loaded`,
  `rewarded_ad_started`, `rewarded_ad_completed`, and `reward_granted`. The final
  event appears only after owner-only status returns the server-derived `admob_ssv`
  source. Retry, pending recovery, callback replay, and session replacement do not
  duplicate the trail or create access. Failure events contain only fixed stage/code
  values; request IDs, intent IDs, ad-unit/provider bindings, SSV data, transactions,
  tokens, signed URLs, and provider messages are absent from DebugView properties.
- **Evidence:** redacted build result, device/OS/build revision, DebugView absence
  and transition observations, date, and independent reviewer.
- **Blocks:** P6-T03 completion and production Analytics activation. An unavailable
  DebugView/device check is not a pass; under D-029 it may remain deferred only
  while production collection stays disabled/fail-closed.

### P4-T06-F1 — Installed campaign-link routing

- **Source:** P4-T06-F1; D-029; implementation revision to be recorded after merge;
  issue #113 owns the unapproved persistent/fresh-install remainder.
- **Disabled/fail-closed state:** production Analytics remains a hard no-op. The app
  has no attribution-history storage and no Install Referrer SDK, so it cannot claim
  fresh-install or deferred attribution. A link reaches series detail only after the
  catalog API confirms current eligibility; malformed or unavailable targets return
  to home.
- **Prerequisites:** clean Android development build for the candidate revision,
  generated eligible and unavailable series IDs, local/staging API, and an account
  whose analytics preference can be tested both off and on. Use synthetic campaign
  tokens only.
- **Actions:** from a logged-out cold state and again while the app is foregrounded,
  open direct, organic, and fully tagged `shortform://series/<generated-id>` intents.
  Repeat after login, with analytics consent off and on. Open malformed and
  unavailable series links. Clear app data and repeat the installed-link cases; do
  not label this a fresh-install/referrer test. Inspect bounded device logs and
  Firebase DebugView only in the approved synthetic test project.
- **Expected:** the eligible target opens once; unavailable and malformed targets
  return home without exposing an error payload. Consent-off sends no Analytics.
  Consent-on emits one `app_open` with `deep_link`, safe campaign fields, and the
  internal series route only—never the raw URL, authentication data, provider data,
  or arbitrary query fields. Cold and foreground transitions do not duplicate the
  same deep-link open.
- **Evidence:** redacted build result, device/OS/build revision, commands using only
  generated identifiers, routing observations, DebugView absence/allowed-property
  observations, date, and independent reviewer.
- **Blocks:** full P4-T06/Checkpoint 4 and paid-acquisition readiness. Under D-029
  this installed-link observation may wait for P6 only while production Analytics
  stays disabled; issue #113 still requires an explicit product/privacy decision
  and cannot be converted into a pass by device evidence.

### P3-T08 — Android locked-episode rewarded-ad path

- **Source:** PR #100; D-029; implementation revision `dc0c6d7` plus its merge revision.
- **Disabled/fail-closed state:** production ads disabled; client cannot grant an
  entitlement; current offers and playback authorization remain server-controlled.
- **Prerequisites:** Android development client, supported Android device/emulator,
  Maestro CLI, local API, Firebase Auth test setup, generated eligible locked
  episode, signed-in synthetic account with ads preference enabled, and permitted
  test-ad configuration. Publisher-owned testing additionally requires #98 setup.
- **Command:**

  ```text
  maestro test -e LOCKED_EPISODE_ID=<generated-opaque-id> -e AD_CLOSE_LABEL=<observed-test-creative-label> mobile/maestro/locked-episode-reward.yaml
  ```

- **Expected:** disclosed reward before opt-in; one intent despite repeated taps;
  SDK completion alone does not grant; genuine verified callback creates exactly
  one entitlement; refreshed offers grant current access; a fresh authorization
  enters playback. Offline/unavailable states fail closed. Large text and TalkBack
  keep every action reachable and announced. Sign-in/preferences return to the
  same opaque episode.
- **Evidence:** redacted Maestro result, device/OS/build revision, backend counts
  for intent/transaction/entitlement, authorization outcome, and independent review.
  Do not retain callback queries, bindings, tokens, signed URLs or provider payloads.
- **Blocks:** P6-T03 completion and public/release production enablement.

### P3-T08-F2 — Android wallet and configured unlock choices

- **Source:** #142 / PR #145, implementation `08a8151`; #144 owns ambiguous-request
  resolution. D-029 defers only native/provider evidence. Full P3-T08-F2 remains
  open; automated financial and account-boundary checks run before merge.
- **Disabled state:** coin controls require Android with the local API environment
  and server `DEBUG` plus `COIN_SPENDING_MODE=test`. Production rejects spending;
  the wallet has no purchase/checkout adapter or sample commercial packs.
- **Automated reproduction:**

  ```text
  pnpm --filter @shortform/mobile test --runInBand EpisodeUnlockScreen WalletScreen pendingCoinUnlock interruptedAdRecovery rewardNavigation
  pnpm mobile:check
  pnpm mobile:bundle:check
  ```

  The bundle command verifies Android production JavaScript only. It does not
  compile native Android, execute a store purchase or establish visual evidence.
- **Native prerequisites:** private Android development client and test identity;
  isolated backend with generated eligible free/ad/coin/both episodes and configured
  synthetic prices; wallet funded through a verified test purchase once
  P3-T03/T04/T06 exist. No manual/production funding route is introduced here.
  Ad testing retains the preceding section's operator/privacy/SSV requirements.
- **Required native actions (unchecked):** open Account → Coin wallet; background
  and resume after changing test balance on a second device. Open
  `shortform://play/<generated-episode-id>` → View episode options. Check each
  configured method, exact coin confirmation and cancellation, insufficient funds,
  disabled spending, large text/TalkBack and navigation through Wallet/Account/
  sign-in. Interrupt before sending and after server commit, reopen the same
  episode, and repeat the original request. Switch accounts while saving or
  waiting for a response. Interrupt an ad and deliver its verified callback;
  reopening must reconcile its status without another impression.
- **Expected:** one debit/entitlement, refreshed server balance, fresh playback
  authorization, and no cross-account display or request adoption. A lost response
  followed by a replay rejection retains the request and shows a support reference;
  #144 must provide safe resolution before real spending. A wallet outage must
  not block already-granted free/ad playback. Purchases remain explicitly unavailable.
- **Evidence:** device/OS/build and tested commit, redacted accessible-screen
  observations, safe request reference and isolated backend counts. No private
  accounts, provider callbacks, tokens, signed media URLs or licensed assets in Git.
- **Blocks:** native/P6-T03 completion, full P3-T08-F2, live spending/purchases,
  release distribution and public support readiness. None is marked passed here.

### P3-T07/P3-T08 — Genuine Google SSV to authorized playback

- **Source:** D-028; P6-T05A; release blocker #98.
- **Prerequisites and actions:** follow `docs/runbooks/development-privacy-setup.md`
  and `docs/runbooks/rewarded-ads.md`. Actual operator/contact, published privacy
  notice, app-specific UMP configuration and independently reviewed test setup are
  prerequisites to any publisher-owned request.
- **Expected:** one completed test ad produces a genuine signed Google callback,
  one server entitlement and fresh authorized Android playback. Replay, mismatch,
  expiry and forgery remain rejected; client completion cannot grant.
- **Blocks:** #98/P6-T05A and all real-ad/public release activation.

### P5-T05-F3 — Firebase App Check and Play Integrity

- **Source:** issue #122; D-013/D-027/D-029; implementation revision to be
  recorded after merge.
- **Disabled/fail-closed state:** the mobile manifest, Cloud Run IaC, and Django
  default App Check enforcement to disabled. Enabling it requires an exact Android
  app ID;
  production settings forbid the mock verifier. Public ingress stays disabled.
- **Prerequisites:** follow `app-check.md`; same-project Google Play/Firebase app,
  registered signing SHA-256 and Play Integrity provider, privately registered
  development debug token, clean development and Play-distributed Android builds,
  isolated staging candidate, generated accounts/content, and bounded redacted logs.
- **Actions:** verify valid debug and Play Integrity tokens across anonymous and
  authenticated journeys; then send missing, empty, malformed, oversized, expired,
  wrong-project, and wrong-app tokens. Repeat with missing/invalid Firebase user
  credentials and repeated reward/progress requests. Exercise provider outage,
  callback exclusion, health/Admin exclusion, redaction, enforcement enablement,
  and rollback.
- **Expected:** valid attested app requests reach existing authorization. Every
  invalid App Check case fails with static HTTP 401 before view work. App Check
  alone never creates identity, grants access, or changes idempotency; the genuine
  AdMob callback retains its own signature boundary. No credential or provider
  payload appears in retained evidence.
- **Evidence:** tested revision, Android build/distribution channel, OS/device
  class, Firebase/Play project and app configuration identifiers, server mode,
  redacted outcomes, rollback result, date, and independent reviewer.
- **Blocks:** P5-T05/P6-T03 and production App Check enforcement. This deferral is
  permitted only while enforcement and public production activation remain off.

## Sign-off record

For each release candidate, append a dated entry with the immutable revision,
environment/configuration identifiers (never secret values), commands/results,
remaining unchecked items, evidence references, reviewer and final P6-T05A decision.

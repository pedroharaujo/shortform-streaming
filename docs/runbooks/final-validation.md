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
   publish licensed media, enable real ads or distribute publicly while any
   applicable item below is unchecked.

## Deferred validation register

### P4-T01 F2a — Firebase Analytics native default-off build

- **Source:** P4-T01 F2a; D-029; implementation revision to be recorded after merge.
- **Disabled/fail-closed state:** every native Analytics collection and advertising
  identifier default is off, and no application flow calls the consent controller.
  This slice cannot emit an analytics event.
- **Prerequisites:** clean Android development build, generated Firebase test
  project configuration, supported Android device/emulator, and Firebase DebugView.
  Do not record configuration contents, device identifiers, or provider payloads.
- **Actions:** install the clean build, clear app data, cold-start it, sign in and
  sign out with a synthetic account, and inspect DebugView plus device logs.
- **Expected:** the app builds and starts; no Analytics events or advertising
  identifiers are emitted; sign-in and sign-out do not change collection state.
- **Evidence:** redacted build result, device/OS/build revision, DebugView absence
  observation, date, and independent reviewer.
- **Blocks:** P6-T03 completion. Consent-on provider observation remains blocked
  until P4-T01 F2b wires the controller to the server-owned preference.

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

## Sign-off record

For each release candidate, append a dated entry with the immutable revision,
environment/configuration identifiers (never secret values), commands/results,
remaining unchecked items, evidence references, reviewer and final P6-T05A decision.

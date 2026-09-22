# #144 mobile implementation evidence

No founder action is needed for this engineering slice. Independent whole-branch
review and the pull request remain the coordinating agent's responsibility.

## Implemented

- Added the generated `CoinUnlockResolution` type and authenticated
  `WalletClient.resolve` using the exact saved original request body at
  `POST /v1/coins/unlock/resolve`.
- Runtime checks reject unknown statuses, nonzero cancellation charges, invalid
  receipt IDs, unsafe/noninteger balances and charges. The screen additionally
  matches the episode/request and the original agreed charge.
- The screen authenticates the profile and reads pending recovery before asking
  for today's catalog or offer. Removed content, denied rights, an unavailable
  wallet and disabled UI spending cannot hide the accounting recovery action.
  Server resolution still requires the existing local synthetic mode; disabled
  server mode returns 409 and preserves pending recovery for support.
- Pending recovery takes precedence over already-granted Play or an ad grant's
  navigation. It never resends the original spend request.
- Cancellation clears only the matching saved request, refreshes terms and
  requires another explicit price confirmation with a new UUID. Completion
  refreshes wallet/access and obtains fresh playback authorization before
  navigation. A historical receipt cannot override current eligibility.
- Network failures, malformed/mismatched outcomes and session/account changes
  preserve the saved original. Fresh profile verification before terminal
  cleanup handles deletion/recreation with unchanged local credentials. A
  session guard also runs after the asynchronous storage read, before deletion.
- Updated all affected wallet doubles, localized user text and the coin-wallet
  runbook. No backend, generated schema, git state or other workstream files
  were modified by this mobile agent.

## Test-first evidence

`pnpm --filter @shortform/mobile test --runInBand src/features/wallet/EpisodeUnlockScreen.test.tsx`
initially failed 16 new/updated tests because recovery still retried debit,
depended on the catalog and bypassed resolution for an existing grant. After
implementation, 32 tests passed. Separate new regression tests then reproduced
cleanup during a session change and initial receipt cleanup after server profile
replacement; each failed before its correction. The final focused run passed
all 34 tests.

The highest-level screen suite exercises real wallet HTTP decoding for malformed
resolution outcomes and a valid completed receipt, as well as original body,
route and bearer authentication. No duplicate low-level resolution suite was
added. Existing secure storage tests retain matching-request cleanup coverage.

## Final checks

- `pnpm mobile:typecheck`: passed.
- `pnpm mobile:bundle:check`: passed; Android production JavaScript bundle only.
- `git diff --check -- mobile docs/runbooks/coin-wallet.md`: passed.
- `pnpm mobile:check`: passed lint, formatting, typecheck, all 38 test suites
  (232 tests) and Expo config checks. Config verification confirmed no sensitive
  keys, analytics/advertising identifiers off by default and invalid production
  overrides rejected.

The initial sandbox runs failed on ESLint's parent directory case scan and the
Hermes compiler's executable permission. Authorized escalated retries ran the
same required checks. The first full retry found test formatting, which was
corrected before the final full rerun. No check was waived.

## Limits and remaining gates

Production coin spending and purchases remain disabled. An Android JavaScript
bundle is not native/device proof. Approved public support contact and actual
native recovery evidence remain open under #144; this report does not close the
issue or satisfy those human gates. Real store purchases, refunds, live provider
events and production activation remain outside this engineering slice.

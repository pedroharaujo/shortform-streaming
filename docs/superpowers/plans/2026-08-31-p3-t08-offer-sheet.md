# P3-T08 locked-episode offer sheet implementation plan

> Execute inline in the existing checkout with Superpowers testing, independent
> code review and verification. No additional worktree; never merge automatically.

**Goal:** An accessible ads-only offer sheet that preserves the locked episode
through sign-in/preferences and confirms current server access before playback.

**Architecture:** Extend the existing RewardScreen and test presenter. The offers
endpoint already reads current EpisodeEntitlement and rights eligibility; refresh
it after a verified reward, then request playback authorization before navigation.
The player still authorizes on entry; do not transport/cache a signed URL in routes.
Keep production ads disabled and preserve consent and session revision guards.

**Tech stack:** Expo Router, React Native, typed API clients, Jest/RNTL, Maestro.

## Requirements and scope

- D-005: free viewing remains anonymous; locked rewards require login.
- D-006/007: existing free window; one verified ad permanently unlocks one episode.
- D-026/027: Android device validation; iOS is a later ship pass.
- D-028: development may proceed; operator/UMP and genuine provider validation
  remain release blocker #98. No provider configuration or production enablement.
- No API/schema, backend, coins, subscriptions, analytics or infrastructure changes.

## Steps

- [x] Extend `mobile/src/features/rewards/RewardScreen.test.tsx` with current-access
  refresh, denied authorization, offline/no-method, and idempotent retry scenarios.
  Preserve existing consent, duplicate-tap and late-session-response tests.
  Run `pnpm mobile:test --runInBand RewardScreen` and observe missing-behavior failures.
- [x] Update `RewardScreen.tsx`: explicit loading/offline/error/unavailable states,
  bottom-aligned scrollable sheet, accessible disabled/busy actions, exact reward
  disclosure. Retain pending intent/request IDs on ambiguous errors. Reuse current
  status without another impression; refresh only terminal intents for another ad.
- [x] Gate success in this order:
  ```ts
  const access = await rewards.offers(episodeId);
  // Require current session, matching episode and decision === 'granted'.
  const authorization = await playback.authorize(episodeId);
  // Require current session and outcome === 'ok', then onPlay(episodeId).
  ```
  A failure leaves the user on the sheet with a status retry, never local access.
- [x] Update `mobile/app/reward/[id].tsx`, `mobile/app/sign-in.tsx`,
  `mobile/app/account.tsx` and the AccountScreen return action. Carry only an opaque
  `returnEpisode` identifier through fixed internal routes; remount the reward
  screen after login/account changes, never adopt a new session into old work.
  Add one route integration test for the return journey and direct-entry close.
- [x] Add `mobile/maestro/locked-episode-reward.yaml` for an eligible generated
  locked episode. Keep native/provider observation separate from mocked component
  evidence. Attempt the flow with allowed local test configuration. Unavailable
  tools/device/consent/provider callbacks are blockers, never passed checks.
- [x] Run `pnpm mobile:check`, `pnpm mobile:bundle:check` and the full `pnpm check`
  when local bootstrap supports it. Record exact commands and results in the
  reward runbook; leave required Maestro acceptance unchecked if not observed.
- [x] Request independent read-only review against `e5da0ba`, fix actionable
  findings, rerun affected checks, inspect the final diff for sensitive material.
- [ ] Commit on `codex/p3-t08-offer-sheet`, push and open a draft PR containing
  acceptance evidence, unresolved validation blockers, and rollback by revert.

## Review focus

Unknown server methods must never appear as unlock actions. Neither SDK completion
nor historical reward status may bypass current entitlement/rights decisions.
Re-entrant taps, lost responses, close/unmount and session changes must not create
duplicate intents or navigate from stale asynchronous work. Status retry must not
require another ad. UI text must not expose backend/provider errors or signed URLs.

## Validation limits

Jest fixtures are synthetic and do not establish genuine Google SSV delivery.
Maestro cannot waive #98 or enable publisher ads without the required setup.

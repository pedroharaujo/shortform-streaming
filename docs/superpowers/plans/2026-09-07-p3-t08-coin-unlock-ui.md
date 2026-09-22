# Android Wallet and Unlock Choices Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an authenticated viewer see the server wallet and safely unlock a
synthetic coin episode using its configured access options (P3-T08-F2 / #142).

**Architecture:** A dedicated unlock route selects coin or existing ad flow. A
typed wallet client and account/episode-scoped secure attempt preserve server
authority and idempotent recovery. The wallet has no purchase integration yet.

**Tech Stack:** Existing Expo, React Native, generated OpenAPI, SecureStore, Jest.

## Global constraints

Android only; no new dependencies, consumer web, live purchases or commercial
policy. Same checkout and short-lived branch; no automatic merge. The design is
`docs/superpowers/specs/2026-09-07-p3-t08-coin-unlock-ui.md`.

## 1. Wallet transport and durable recovery

Files: `mobile/src/api/wallet/{types,walletClient}.ts`,
`mobile/src/api/createAppClients.ts`,
`mobile/src/features/wallet/pendingCoinUnlock.ts` and its focused test.

Interfaces:

```ts
interface WalletClient {
  getWallet(): Promise<WalletOutcome<Wallet>>;
  unlock(request: CoinUnlockRequest): Promise<WalletOutcome<CoinUnlock>>;
}
interface PendingCoinUnlock {
  readonly version: 1;
  readonly profileId: string;
  readonly request: CoinUnlockRequest;
}
```

- [x] Test per-profile/episode isolation, invalid/unreadable records and stale clear.
- [x] Implement generated request types, existing authenticated/App Check fetch
  wiring, success validation and strict SecureStore recovery.
- [x] Run `pnpm --filter @shortform/mobile test --runInBand pendingCoinUnlock`.

## 2. Screen behavior and ownership

Files: `mobile/src/features/wallet/{WalletScreen,EpisodeUnlockScreen}.tsx`,
their screen tests, `mobile/src/auth/session.ts`, and
`mobile/src/localization/messages.tsx`.

Add `subscribeAuthSession(listener): () => void` for synchronous invalidation.
Use the session revision with `useSyncExternalStore` and a frozen screen owner.

```ts
await writePendingCoinUnlock(attempt);
if (!isCurrent()) return;
const result = await wallet.unlock(attempt.request);
if (!isCurrent()) return;
```

- [x] Write failing interaction tests for exact confirmation, timeout/remount
  recovery, unchanged UUID/terms, double press, storage failure, 409, response
  mismatch, changed identity and fresh playback authorization.
- [x] Implement safe choices and wallet refresh. Hide stale account data. Do not
  claim completion on pending, offline, malformed or rejected responses.
- [x] Run `pnpm --filter @shortform/mobile test --runInBand EpisodeUnlockScreen WalletScreen`.

## 3. Navigation and validation

Files: `mobile/app/unlock/[id].tsx`, `mobile/app/wallet.tsx`, player/account/sign-in
routes, AccountScreen, navigation tests and final-validation runbook.

```ts
router.dismissTo({ pathname: '/unlock/[id]', params: { id: returnEpisode } });
router.push({ pathname: '/wallet', params: { returnEpisode: episodeId } });
```

- [x] Retain episode context through sign-in, account, wallet and ad selection.
- [x] Review financial recovery, ownership, runtime validation and privacy independently.
- [x] Run `pnpm mobile:check`, `pnpm mobile:bundle:check`, `pnpm contract:check`
  and `python scripts/check_repository_foundation.py`; resolve failures.
- [x] Record exact evidence and unchecked native/provider gates, commit, push
  and open one reviewable PR. Leave issue #142 and full P3-T08-F2 open.

## Verification evidence

- Implementation `08a8151` is published in
  [PR #145](https://github.com/pedroharaujo/shortform-streaming/pull/145), unmerged.
- `pnpm check`: repository foundation (50 tests + secret/governance checks),
  backend lint/format/types/migrations and 418 tests, and OpenAPI generation/drift
  stages passed. Its mobile stage caught a missing `coin` helper type; corrected
  that annotation and reran the complete mobile gate below.
- `pnpm mobile:check`: lint, formatting, typecheck, **216 tests / 38 suites** and
  Expo configuration passed on the final implementation.
- `pnpm mobile:bundle:check`: Android production JavaScript bundle passed;
  native compilation and EAS were not invoked.
- `python scripts/check_repository_foundation.py` and
  `python scripts/validate_ai_governance.py`: passed after documentation updates.
- Independent financial/ownership and navigation reviews found the interrupted-ad,
  foreground, duplicate-navigation and wallet-outage issues; each is fixed with
  regression evidence. Final review has no required findings for this local slice.
- #144 remains a concrete launch blocker for ambiguous-request resolution.
  Native/provider/accessibility evidence remains unchecked in final-validation.

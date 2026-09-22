# Wallet Unlock Recovery Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Stay in this checkout; no extra worktrees.

**Goal:** Let the owner find and resolve a lost coin unlock from Wallet after startup or catalog removal.

**Architecture:** A single account-owned durable journal mirrors the original
episode marker and feeds Wallet navigation to the existing server resolver.
The journal is written first and deleted last, preserving recovery across partial
storage failures. Backend accounting and playback authorization stay authoritative.

**Tech Stack:** Expo SecureStore, React Native, existing Me/Wallet clients.

## Task 1: Durable journal (#173)

Files: `mobile/src/features/wallet/pendingCoinUnlock.ts` and its existing test.

- [x] Add strict bounded journal key/value validation and `readPendingCoinUnlockForProfile(profileId)` returning the full original attempt or null.
- [x] Write failing tests for journal-only recovery, mismatches, account isolation and partial writes/deletes; run `pnpm --filter @stovio/mobile test --runInBand pendingCoinUnlock`.
- [x] Under the existing serialization queue, enforce this order:

```text
write: validate original -> inspect journal + legacy -> reject conflict
       -> persist full journal -> persist legacy -> return (caller may send)
read:  validate journal + legacy -> reject conflict -> recover full original
clear: verify terminal caller + same original + current session
       -> delete legacy -> recheck current session -> delete journal
```

- [x] Preserve/import known legacy markers and reject a second account journal attempt; rerun focused storage tests.

## Task 2: Wallet recovery entry

Files: `WalletScreen.tsx`, `mobile/app/wallet.tsx`, applicable localized messages,
existing wallet/navigation tests, and the existing EpisodeUnlockScreen test.

- [x] Add failing Wallet tests: authenticated profile has journal, catalog is absent and wallet read may fail, action still navigates to saved episode; session switch invalidates results; read failure offers retry without pretending empty.
- [x] Add MeClient and recovery navigation through route composition, using existing client import boundaries.
- [x] Load profile/journal independently of balance and display one accessible recovery action; never add a catalog dependency.
- [x] Confirm journal write failure prevents the existing unlock request and keeps recovery; reuse existing resolver tests for accounting and eligibility.
- [x] Run affected wallet/storage/navigation tests and fix failures.

## Task 3: Verify, review and deliver

Root owns runbook/plan/issue evidence; implementer owns mobile code/tests.

- [x] `pnpm mobile:check` and `pnpm mobile:bundle:check` pass.
- [x] `pnpm contract:check`, `python scripts/check_repository_foundation.py` and `git diff --check` pass.
- [x] Independent financial/session/storage review finds no blocking issues.
- [x] Local Android generated-coin QA checks unlock, replay/recovery and unavailable-media behavior; record injected failures as simulations, not genuine provider evidence.
- [x] Update coin-wallet and first-journey/final-validation documentation with actual outcomes and the legacy discoverability limitation.

CI and conditional merge follow the founder's standing authorization. Keep #144
and #164 open for their remaining genuine provider, support and release gates.

## Verification record (2026-09-13)

Mobile lint, formatting, types, configuration and 418 tests in 47 suites passed.
Android production JavaScript bundle, API contract generation/check and repository
foundation (580 files / 55 tests) passed. Independent specification and code
quality reviews found no remaining blockers. The navigation fixture was updated
for the new MeClient before the full mobile suite passed.

Pixel 9 / Android 16 native development-JavaScript checks passed new-journal
recovery after reload and catalog removal for simulated pre-debit and post-debit
503 responses, exact cancellation barrier replay, account isolation and known
legacy import. See the coin-wallet and final-validation runbooks for precise
observations and remaining provider/process-death limitations. The normal local
backend and generated media configuration were restored after QA.

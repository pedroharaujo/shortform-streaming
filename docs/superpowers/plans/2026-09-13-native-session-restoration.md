# Native Session Restoration Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Remain in this checkout without extra worktrees.

**Goal:** Keep the Android user signed in across restart and token expiry.

**Architecture:** Gated initial native restoration plus owner-bound token refresh
at the backend fetch boundary. Manual auth and account revision remain the
authority; a final guard covers every asynchronous verification stage.

**Tech Stack:** React Native/Expo, Firebase Auth, existing App Check fetch.

## Constraints

- Issue #171 / P2-T01, D-036 and matching specification.
- No new backend/native dependency, persistence, analytics consent or production activation.
- No account upgrade of an old request and no automatic mutation retry.

## Task 1: Native lifecycle and authenticated fetch

Files: `mobile/src/auth/` lifecycle/fetch modules and native/mock session types,
`mobile/src/api/createAppClients.ts`, `mobile/app/_layout.tsx`, and focused tests.

- [x] Write failing tests for restored/anonymous startup and stale-request rejection.
- [x] Implement initial restoration with a bounded fail-closed fallback and
  ephemeral native owner binding; preserve manual sign-in/deletion ordering.
- [x] Refresh authenticated requests and enforce the final dispatch guard after
  both Firebase and App Check asynchronous work.
- [x] Cover lifecycle/token/owner/consent races at the narrowest useful layer.
- [x] Run mobile lint/format/types/tests/config and Android bundle checks.
- [x] Independently review auth isolation, financial session guards and privacy.

## Task 2: Emulator observation and delivery

Files: first-journey runbook, implementation plan and issue/PR evidence.

- [x] Verify generated-account sign-in, development reload and account/wallet access.
- [x] Verify anonymous behavior after sign-out/reload and unchanged free playback.
- [x] Record actual results and preserve unobserved Google/store gates.

Delivery requires passing CI and merge under the founder's explicit authorization,
then fast-forwarding local main. The pull request linked from issue #171 is the
authority for those delivery outcomes.

OS process termination and real-provider token expiry remain separate device
observations in final validation. A development reload proves JavaScript startup
restoration but must not be recorded as a process-death test.

Final local checks: `pnpm mobile:check` (406 tests / 47 suites plus lint, format,
types and config), `pnpm mobile:bundle:check`, `pnpm contract:check`,
`python scripts/check_repository_foundation.py` (578 files, 55 tests, governance),
and `git diff --check` passed. Independent review fixed same-result token-subject
binding, RequestInit header replacement and native already-empty cleanup before
reporting no remaining blockers. Native build, Google account-entry and actual
video progress/resume observations are recorded in the first-journey runbook.

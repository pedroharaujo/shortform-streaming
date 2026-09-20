# MVP support and privacy implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the independent notice task and publication review. Keep all work in this checkout.

**Goal:** Make email support reachable from Account and unresolved coin flows, and prepare an honest coin-MVP privacy notice for review (P6-T04 / #144 / #164).

**Architecture:** Reuse existing account panels and action buttons. A shared email-support component opens an editable email draft, shows only the already-visible reference, and provides a selectable email fallback. A static HTTPS document contains the clearly labeled privacy draft; it is not an approved store policy.

**Tech Stack:** React Native, Expo Router, Linking, existing Jest/RNTL, Markdown. No new dependencies, API, storage, or financial logic.

## Global constraints

- Public operator: Pedro Henrique Araujo Pinto (individual); support/privacy email: pharaujo1094@gmail.com, explicitly supplied for public launch by founder.
- Preserve the separate cleanup work outside this PR and restore it after publication.
- Never attach credentials, receipts, raw provider data, account IDs or diagnostics automatically. Email opens only on a user press and sends only after the user submits it in their email app.
- Hide owner-specific references on session replacement. Support cannot clear an attempt, retry a debit, grant coins, or promise refunds.
- D-020 retention/provider approval and D-008 financial policy remain unresolved. Notice is explicitly draft; no activation or false compliance claim.

## Task 1: Support presentation

- [x] Create mobile/src/features/support/SupportContact.tsx with topic (general/purchase/unlock/privacy), optional already-visible reference, explicit editable mailto body, pending/failed handoff and selectable address/reference fallback.
- [x] Add Account help panel reachable signed in, signed out, loading, or backend-unavailable; show operator, support contact and privacy draft link. Link draft from account privacy controls too. Browser handoff failure leaves contact accessible.
- [x] Add contact to awaiting-verification/review-required Coins states and pending unlock state, preserving existing owner guards. Never read hidden provider data to construct a reference.
- [x] Add focused user-behavior coverage for email encoding, failure fallback, unchanged financial behavior and session-change hiding; reuse existing screen test fixtures.

## Task 2: Privacy preparation

- [x] Prepare docs/privacy/MVP_PRIVACY_NOTICE_DRAFT.md from current implemented data flows and official Google/CNIL guidance. Treat purposes/bases and unverified release services as proposals; no invented retention deadlines or address/company.
- [x] Prepare a compact publication checklist with exact unresolved provider, retention, deletion, final binary and URL checks. Do not activate ads or public purchases.

## Task 3: Review and publication

- [x] Run relevant targeted tests, pnpm mobile:check, pnpm mobile:bundle:check, repository foundation and diff checks. No repeat real purchase.
- [x] Independently review diff for correctness, privacy, financial non-interference and usability. Resolve actionable findings.
- [ ] Open issue-linked PR, attach it, await CI, merge only within the founder's existing finish/merge authorization. Update issue with actual evidence and remaining publication gate.
- [ ] Restore separate cleanup without losing either set of changes; report support result and draft limitation plainly.

## Validation evidence

- Focused support/account/coin/unlock/history checks: 107 tests passed.
- `pnpm mobile:check`: 515 tests in 51 suites, lint, format, types and config passed.
- `pnpm mobile:bundle:check`: Android production JavaScript export passed.
- `python scripts/check_repository_foundation.py`: 55 tests, repository safety and governance passed.
- `git diff --check`: passed.
- No real checkout or email was submitted. Native email-app handoff and inbox receipt/reply remain deferred under D-029 to P6-T03 with the reproducible checks in the publication checklist. The privacy draft is not an effective/store policy.

Independent implementation/privacy review: no blocking findings. Scope approval covers the support UI and review draft only.

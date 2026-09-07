# Coin wallet implementation plan

> Execute with Superpowers executing-plans, test-driven-development and independent
> review. Follow AGENTS.md: one checkout, short-lived branch, no automatic merge.

**Goal:** Provide the safe backend prerequisite for coin purchase and unlock screens.
**Architecture:** Dedicated Django wallet app with ledger-derived balances and
transactional debits; reuse account/catalog serialization and entitlement authority.
**Tech stack:** Django/DRF, PostgreSQL, pytest, generated OpenAPI TypeScript.

## Global constraints

The design at `../specs/2026-09-07-p3-t02-coin-wallet-design.md` binds every task.
No live commerce, private data or commercial prices. No client-authoritative
credits. Append-only accounting, current eligibility, and atomic grants are
immediate requirements. Synthetic spending requires DEBUG and explicit local mode.

## Task 1: Records, migration and accounting safeguards

Owned files: `backend/apps/wallet/{__init__,apps,models}.py`, wallet migrations,
`backend/tests/wallet/test_models.py` and migration tests; register app in settings.

- [x] Write tests proving `CoinLedgerEntry.objects.filter(...).update(amount=...)`
  and `.delete()` fail, duplicate references fail, and account deletion retains
  ledger/receipt rows with `Wallet.user_profile_id is None`.
- [x] Run `uv run pytest backend/tests/wallet/test_models.py` and confirm missing
  model failure before implementation.
- [x] Implement Wallet, CoinLedgerEntry and CoinUnlock as specified, with database
  constraints and PostgreSQL triggers. Add migrations; no historical data rewrite.
- [x] Verify sign constraints, negative-balance/concurrent insert protection,
  immutable rows and old-account/entitlement compatibility in PostgreSQL.

## Task 2: Atomic service and HTTP contract

Owned files: wallet `services.py`, `views.py`, `serializers.py`, `urls.py`,
`capabilities.py`; account `profiles.py`, lifecycle comment; root URLs/settings;
entitlement policy/source and Admin; wallet API/concurrency tests.

Interfaces: `wallet_balance(wallet: Wallet) -> int`, `read_wallet(profile) -> int`,
`unlock_episode(profile, episode_id, request_id, *, expected_policy_version,
expected_coin_price) -> tuple[CoinUnlock, int]`. `coin_spending_enabled() -> bool`
requires DEBUG and COIN_SPENDING_MODE=test. Both HTTP views require Firebase auth.

- [x] Write API tests for balance ownership, duplicate requests, existing grants,
  insufficient funds, stale policies, unavailable titles, disabled mode and deleted
  accounts. Expected successful synthetic fixture: initial 10, price 4, balance 6;
  repeated request remains one -4 entry and one entitlement.
- [x] Run tests and inspect expected missing-route failures.
- [x] Implement lock ordering, fresh checks, atomic receipt/debit/grant and no-store
  responses. Add coin source recognition without weakening existing eligibility.
- [x] Write/run PostgreSQL concurrency and rollback tests. Make generic entitlement
  Admin coin-safe and serialize manual grants with unlocks.
- [x] Generate schema/client with `pnpm contract:generate`; run area checks.

## Task 3: Review, documentation and delivery

- [x] Independently review financial invariants, deletion and authorization; fix
  findings with focused regression tests.
- [x] Document synthetic setup and release-disabled boundary in a wallet runbook.
  Update P3-T02 evidence honestly and create follow-up issues for P3-T03/T04/T06
  and P3-T08-F2 without claiming provider/UI completion.
- [x] Run `pnpm check`, `pnpm mobile:bundle:check`, secret history scan and
  `git diff --check`. Record exact commands/results and limitations in PR.
- [ ] Publish one P3-T02 PR and inspect its required CI. Leave merging to founder.
## Execution evidence

Issue #141; PR #143; dependent store/purchase/UI work tracked in #142.

- `pnpm check`: passed (418 backend, 177 mobile, 50 repository tests and all
  static, migration and generated-contract checks).
- `pnpm mobile:bundle:check`: Android production JavaScript export passed.
- Focused PostgreSQL wallet/Admin suite: 60 passed. Financial review reproduced
  an eligibility-expiry bug before fixing the final decision branch.
- Rolling-compatibility review reproduced old-process account deletion failing
  its wallet FK; database-level detachment fixed it. Updated model/migration suite:
  24 passed, with retained ledger/debit/receipt evidence.
- Independent final review found no remaining actionable issues after both fixes.
- Real store/provider/native-device checks and D-008/D-020 commercial/privacy
  approvals remain outside this backend slice; production spending stays disabled.

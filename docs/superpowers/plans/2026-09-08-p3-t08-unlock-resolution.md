# Interrupted Unlock Resolution Implementation Plan

> **For agentic workers:** Use Superpowers execution, independent review and final verification. No worktrees or automatic merge.

**Goal:** Finish #144's server and mobile engineering while retaining its human gates.

**Architecture:** Serialize an original request against an immutable cancellation;
return a historical completion or guarantee that the old key cannot ever debit.

**Tech stack:** Existing Django/PostgreSQL, OpenAPI, Expo/SecureStore and test tools.

- [x] Write failing endpoint/transaction tests in `backend/tests/wallet/test_resolution.py`.
- [x] Add `CoinUnlockCancellation` and additive migration, database mutual exclusion,
  `resolve_unlock` service, serializer/view and `/v1/coins/unlock/resolve` route.
- [x] Regenerate `docs/api/openapi.yaml` and `packages/api-client/src/generated/schema.d.ts`.
- [x] Add `WalletClient.resolve`, runtime validation and screen recovery using the
  original request; update the existing highest-level interaction tests.
- [x] Run wallet API/race/migration tests, backend quality gates, `pnpm contract:check`,
  `pnpm mobile:check` and Android bundle; obtain independent financial review.
- [ ] Update #144 engineering evidence and remaining human checks; publish a
  separate PR from main. Keep #144 open until those checks are evidenced.

The detailed contract and race invariants are in the matching design file.

## Verification evidence (2026-09-08)

PostgreSQL 17.6, generated fixtures only, temporary local database:

```powershell
$env:DATABASE_URL = 'postgresql://shortform@127.0.0.1:55432/shortform'
$env:PYTEST_ADDOPTS = '-p no:cacheprovider'
pnpm backend:check
uv run pytest backend/tests/wallet/test_migrations.py backend/tests/wallet/test_races.py backend/tests/wallet/test_resolution.py -q -p no:cacheprovider
pnpm backend:lint
pnpm backend:format:check
pnpm backend:typecheck
pnpm contract:check
python scripts/check_repository_foundation.py
pnpm mobile:check
pnpm mobile:bundle:check
```

Full backend check passed with 428 tests. Independent review requested two further
acceptance checks: preserve existing predecessor wallet/ledger/receipt history
through the expansion, and prove deletion wins against resolution as well as
unlock. Both were added; all 19 targeted migration/race/resolution tests passed.
Backend lint, formatting and typecheck were rerun successfully after those tests.
The contract check passed. Repository foundation passed its safety scan, 50 tests
and governance validation. Mobile passed 38 suites / 232 tests, all quality/config
checks and the Android production JavaScript bundle. That bundle is not a native
device or provider observation; see the [mobile report](2026-09-08-p3-t08-unlock-resolution-mobile-report.md).

The backend review found no implementation defect in account/wallet locking,
immutable terminal records, legacy READ COMMITTED/REPEATABLE READ exclusion or
historical accounting versus eligibility separation. Final whole-branch review
independently verified those two additional tests and the client, UI and saved
request cleanup. Spec passed and quality/security review approved PR submission
with no remaining actionable findings. No financial or authorization test is deferred.

Apply additive migrations before new server traffic. Application rollback keeps
the tables and guards; do not reverse migrations once terminal history exists.
Production remains disabled. #144 stays open for public support/contact approval
and actual native recovery evidence.

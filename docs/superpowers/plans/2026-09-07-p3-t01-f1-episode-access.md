# P3-T01-F1 Implementation Plan

Use Superpowers subagent-driven development with independent owned files,
task-scoped specification/quality review, and a fresh whole-branch review.
The approved design is `../specs/2026-09-07-p3-t01-f1-episode-access-design.md`.
Its Global constraints bind every task. User requested parallel agents; stay in
this checkout, no worktrees, no automatic merge.

## Task 1: Episode configuration, Admin audit, and catalog locking

Owner: catalog implementation agent. Files: `backend/apps/catalog/models.py`,
`admin.py`, new `locking.py` and audit helper if useful, additive catalog migration,
focused new catalog configuration/Admin tests. Do not change eligibility rules.

- [x] Write failing schema/default/Admin tests.
- [x] Add access_mode/coin_price with conservative defaults and DB constraints.
- [x] Add read-only editorial audit history, including inherited series edits.
- [x] Supply `lock_series_for_access(series_id) -> Series` and
  `lock_episode_for_access(episode_id) -> Episode | None` in `apps.catalog.locking`.
  Helpers require an atomic transaction; parent then child, fresh related objects.
- [x] Coordinate Admin save/inline/delete/bulk-delete paths with parent locks;
  make existing ownership immutable, preserve normal model permissions.
- [x] Run catalog tests/static/migration checks and report exact evidence.
- [x] Independent task specification and quality review; resolve findings.

## Task 2: Central access resolution and offers

Owner: policy implementation agent. Files: `backend/apps/entitlements/policy.py`,
`serializers.py`, `views.py`, focused entitlement tests and existing fixtures there.
Use agreed `Episode.access_mode`/`coin_price` from Task 1; do not edit catalog files.

- [x] Write the backend policy decision table before implementation.
- [x] Add `resolve_episode_policy(episode)` with `.version`, `.coin_price`, and
  effective method information; stable server hash includes all policy inputs.
- [x] Apply eligibility before explicit valid grants/free/lock; reject unknown
  entitlement sources, preserve guest boundary and series/provider ad switches.
- [x] Emit additive policy_version/coin_price response metadata while omitting
  unavailable coin methods; no setting can activate wallet code that does not exist.
- [x] Keep existing valid API shapes/copy; update endpoint and serializer descriptions.
- [x] Run scoped policy tests/static checks; independent task review and corrections.

## Task 3: Reward rechecks and transaction evidence

Owner: reward implementation agent. Files: `backend/apps/advertising/` relevant
models/services/serializers/views, additive advertising migration, advertising tests.
Consumes Task 1 lock helpers and Task 2 resolver/offers. Work may begin once these
interfaces are fixed; final integration testing waits for both implementations.

- [x] Add failing real-grant stale-policy integration tests.
- [x] Bind new intents to current policy version; optional expected version on
  creation, 409 on mismatch; legacy blank pending intents unavailable.
- [x] Explicit provider/account/catalog/intent lock order and fresh rechecks on
  grant/status; preserve idempotency, deletion safety, consent, and callback privacy.
- [x] Add actual two-transaction policy/rights revocation and expiry-wait evidence;
  preserve callback replay and same-transaction deduplication coverage.
- [x] Run advertising tests/static checks; independent task review and corrections.

## Task 4: Integration, migration, contract, and handoff

Owner: orchestrator. Separate new integration/migration tests, generated schema/
client, mechanical mobile typed fixture updates, documentation and evidence.

- [x] Rehearse additive migrations on synthetic PostgreSQL, preserving old states.
- [x] Verify API/playback/progress integration, refresh typed client and affected
  mobile fixtures together, and test the contract without duplicate UI suites.
- [x] Document configuration, approved-scope limits, lock protocol, pending-intent
  deployment behavior, safe rollback, and P3-T02/P3-T08-F2 remaining work.
- [x] Run `pnpm check`, mobile compatibility/bundle gates, repository/history safety.
- [x] Fresh final whole-branch independent review and any necessary fixes/rechecks.
- [x] Publish a reviewable PR with revision/check evidence and the human merge boundary.

Before handoff, verify required CI on the final head and record its result in
[PR #140](https://github.com/pedroharaujo/shortform-streaming/pull/140). No automatic merge.

## Progress ledger

- Base: `283241f0f12027dce02eaa7320251cde05a8caa1`; PR #139 merged.
- Two read-only audits confirmed task scope and identified unknown-source grants,
  offer/provider mismatch, stale-intent versioning, and shared catalog locking.
- Dedicated ephemeral PostgreSQL setup ready, generated credentials only in ignored
  `.tmp`; no real data or existing application database used.
- Task 1: 105 catalog/Admin security tests passed, with 14 focused schema/Admin
  cases. Independent review passed after adding persistent database defaults for
  old-process writes during expansion; the reviewer rechecked the corrected
  model/migration and historical-model post-expansion insert test.
- Task 2: 69 entitlement/playback/reward integration tests and static checks passed.
  Independent review requested explicit-ad and version-change evidence; the
  existing five-function API suite was extended, passed, and independently
  rechecked. Its initial missing-resolver failure was a dependency failure, not
  behavioral regression evidence.
- Task 3: 91 advertising tests passed, including real PostgreSQL operator-change
  races, expiry while waiting, idempotency, and deletion. Unknown-source false
  acknowledgements were reproduced and fixed. Independent review passed.
- Task 4: migration and actual playback integration passed (10 tests); a new
  historical-model INSERT after expansion failed before persistent DB defaults
  and passed after both catalog/reward defaults were corrected. Schema/client
  regenerated together; one mobile fixture file updated mechanically and typecheck
  passed. `pnpm check` passed with 351 backend tests, 177 mobile tests in 34 suites,
  50 repository tests, contract, governance and static checks. An initial aggregate
  attempt stopped on formatting in the new migration test; formatting was corrected
  before the successful full run. Expo Doctor passed 21/21 and
  `pnpm mobile:bundle:check` passed the Android production JavaScript bundle.
- Final review found audience-segment rename/delete could evade catalog locking
  during a grant. Three real Admin/callback race cases reproduced the defect.
  Existing segment identifiers are now read-only and Admin deletion is denied;
  creation and display-name edits remain supported. Eleven focused tests and the
  197-test advertising/catalog integration run passed. The independent final
  reviewer rechecked code, regression tests and documentation: finding closed,
  no remaining material findings across the five review axes.
- Final affected verification: `. .\\.tmp\\p3t01f1-test-env.ps1` then
  `pnpm backend:check` passed: Ruff lint/format (176 files), mypy (173 files),
  no migration drift, and 355 backend tests in 48.81 seconds. Pytest reported one
  optional cache-write permission warning; all tests executed successfully.
  The earlier full aggregate used `PYTEST_ADDOPTS=-p no:cacheprovider`.
- All database validation used generated data in dedicated PostgreSQL 17.6.
- Implementation revision: `5b0b37962c0bb913af90afa99cd32b1b10bcb422`.
  `python scripts/check_repository_foundation.py` passed (442 current files,
  50 repository tests and AI governance); `git diff --check` passed.
  `python scripts/scan_secrets.py --history-range 283241f0f12027dce02eaa7320251cde05a8caa1..HEAD`
  passed for that revision (442 current files, 35 introduced history blobs).
  This final documentation update links PR #140; its final head and CI evidence
  are maintained in the PR body so verification does not change its own revision.
- Test safety: a task-only database credential accidentally appeared in one
  agent's tool output. Work paused, the verified container/tmpfs database was
  removed, fresh credentials were generated, and replacement authentication was
  verified before resuming. No production data or Git credential exposure occurred.

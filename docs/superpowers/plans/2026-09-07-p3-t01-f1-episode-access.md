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

- [ ] Write failing schema/default/Admin tests.
- [ ] Add access_mode/coin_price with conservative defaults and DB constraints.
- [ ] Add read-only editorial audit history, including inherited series edits.
- [ ] Supply `lock_series_for_access(series_id) -> Series` and
  `lock_episode_for_access(episode_id) -> Episode | None` in `apps.catalog.locking`.
  Helpers require an atomic transaction; parent then child, fresh related objects.
- [ ] Coordinate Admin save/inline/delete/bulk-delete paths with parent locks;
  make existing ownership immutable, preserve normal model permissions.
- [ ] Run catalog tests/static/migration checks and report exact evidence.
- [ ] Independent task specification and quality review; resolve findings.

## Task 2: Central access resolution and offers

Owner: policy implementation agent. Files: `backend/apps/entitlements/policy.py`,
`serializers.py`, `views.py`, focused entitlement tests and existing fixtures there.
Use agreed `Episode.access_mode`/`coin_price` from Task 1; do not edit catalog files.

- [ ] Write the backend policy decision table before implementation.
- [ ] Add `resolve_episode_policy(episode)` with `.version`, `.coin_price`, and
  effective method information; stable server hash includes all policy inputs.
- [ ] Apply eligibility before explicit valid grants/free/lock; reject unknown
  entitlement sources, preserve guest boundary and series/provider ad switches.
- [ ] Emit additive policy_version/coin_price response metadata while omitting
  unavailable coin methods; no setting can activate wallet code that does not exist.
- [ ] Keep existing valid API shapes/copy; update endpoint and serializer descriptions.
- [ ] Run scoped policy tests/static checks; independent task review and corrections.

## Task 3: Reward rechecks and transaction evidence

Owner: reward implementation agent. Files: `backend/apps/advertising/` relevant
models/services/serializers/views, additive advertising migration, advertising tests.
Consumes Task 1 lock helpers and Task 2 resolver/offers. Work may begin once these
interfaces are fixed; final integration testing waits for both implementations.

- [ ] Add failing real-grant stale-policy integration tests.
- [ ] Bind new intents to current policy version; optional expected version on
  creation, 409 on mismatch; legacy blank pending intents unavailable.
- [ ] Explicit provider/account/catalog/intent lock order and fresh rechecks on
  grant/status; preserve idempotency, deletion safety, consent, and callback privacy.
- [ ] Add actual two-transaction policy/rights revocation and expiry-wait evidence;
  preserve callback replay and same-transaction deduplication coverage.
- [ ] Run advertising tests/static checks; independent task review and corrections.

## Task 4: Integration, migration, contract, and handoff

Owner: orchestrator. Separate new integration/migration tests, generated schema/
client, mechanical mobile typed fixture updates, documentation and evidence.

- [ ] Rehearse additive migrations on synthetic PostgreSQL, preserving old states.
- [ ] Verify API/playback/progress integration, refresh typed client and affected
  mobile fixtures together, and test the contract without duplicate UI suites.
- [ ] Document configuration, approved-scope limits, lock protocol, pending-intent
  deployment behavior, safe rollback, and P3-T02/P3-T08-F2 remaining work.
- [ ] Run `pnpm check`, mobile compatibility/bundle gates, repository/history safety.
- [ ] Fresh final whole-branch independent review and any necessary fixes/rechecks.
- [ ] Publish a reviewable PR with exact revision/check results, wait required CI,
  and hand back for human approval without merging.

## Progress ledger

- Base: `283241f0f12027dce02eaa7320251cde05a8caa1`; PR #139 merged.
- Two read-only audits confirmed task scope and identified unknown-source grants,
  offer/provider mismatch, stale-intent versioning, and shared catalog locking.
- Dedicated ephemeral PostgreSQL setup ready, generated credentials only in ignored
  `.tmp`; no real data or existing application database used.
- Tasks 1–4: pending implementation and verification.

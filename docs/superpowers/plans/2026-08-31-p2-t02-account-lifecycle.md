# P2-T02 — Account lifecycle, preferences, and deletion

## Scope and repository assessment

Baseline: `1af3c44` on main; GitHub had no open PRs or issues on 2026-08-31.
Merged work establishes P1, P2 identity/catalog/ingestion/playback/progress,
P3-T01 access policy, P0-T04 costs/ADRs, and P5-T01–T03 infrastructure/deploy
implementation. Historical checkboxes are not reliable completion evidence.
P2-T02 is the earliest missing product implementation: there are no preference
fields or account-deletion workflow. P3-T07/T08 rewarded ads, P4 measurement,
P5-T04 onward, and P6 launch work remain. Closed #89 is deferred iOS work,
not implementation evidence; D-027 makes the ads-only MVP Android only.

Authorities: P2-T02, the approved product brief, STORE_COMPLIANCE_MATRIX privacy
baseline, ADR 0003, and D-005/D-027. P0-T03 legal approvals and D-020 retention
remain open. This implements the documented development baseline without
approving policy, enabling SDK tracking, or activating production.

## Design

- Expand UserProfile with locale (`en`), optional country, analytics/ads
  preferences (default false), and a timestamp of the last explicit choice.
  Country is a preference, never a replacement for playback eligibility headers.
- GET/PATCH `/v1/me` reads/updates only the verified account. Reject unknown
  write fields. No UID, access entitlement, or client-supplied identity writes.
- POST `/v1/me/deletion` requires `{confirmation: true}` and a verified
  `auth_time` within five minutes. Token refresh alone is not reauthentication.
  Return 202 with `{public_id, status: pending|completed}` once accepted.
- Atomically record a unique UID fingerprint tombstone, retain the UID only
  while provider cleanup is pending, and cascade-delete local profile,
  progress, and entitlements. Block profile recreation before any auth mapping.
- Attempt Firebase deletion after the local transaction commits; missing users
  count as success. Retry through an operator command. Clear the raw UID on
  completion; keep only pseudonymous fingerprint/status/timestamps for replay
  prevention and operational audit. No provider exceptions/payloads in logs.
  Fingerprints are pseudonymous, not anonymous; production retention requires
  D-020 approval. No finance/push models exist yet; future processors must join
  this deletion workflow before deployment.
- POST `/v1/me/export` is explicitly unavailable (501), not a false successful
  export request. Full export fulfillment is deferred and documented.
- Android account screen supports preference changes, sign-out, export
  placeholder, explicit deletion confirmation, same-account reauthentication,
  pending/completed messages, and clears local auth on accepted deletion.
  Email/password and Google reauthentication must not switch accounts.

## Implementation tasks

1. Backend regression tests: preferences/auth, recent auth, deletion cascading,
   provider failure/retry, duplicate/concurrent requests, stale-token denial,
   unchanged other accounts, safe errors. Use PostgreSQL integration tests.
2. `backend/apps/accounts`: expand models/migration; lifecycle service and
   Firebase adapter; verification claims; profile anti-recreation; serializers,
   views/routes; retry command. Preserve existing auth/eligibility behavior.
3. Generate OpenAPI and client together. Add Android account controls under
   `mobile/src/features/account`, client under `mobile/src/api/account`, route
   and navigation. Focus mobile tests on the UI journey, not duplicate layers.
4. Run relevant area checks plus `pnpm check`; review independently, resolve
   findings, and record exact evidence and outstanding device/production gates.

## Validation and rollback

Required: backend lint/format/types/migrations/tests, generated contract, mobile
lint/format/types/tests/config, repository foundation, and Android observation
when a development build is available. Missing device evidence is not a pass.
No real account, media, SDK tracking, provider payload, or production mutation.

Migration only adds fields/table; do not reverse it after accepting deletions.
Old application versions do not honor tombstones: rollback must retain the
authentication deletion guard. Restore no deleted accounts from a backup without
reapplying deletion records. Automatic retry scheduling is a P5 operational
integration; the retry command and pending-count check must be run before release.

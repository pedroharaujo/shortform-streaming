# Account lifecycle — P2-T02

Account preferences and deletion implement the approved development baseline.
P0-T03 owner approvals, production support/privacy URLs, and D-020 residency and
retention remain release gates. This runbook does not approve legal policy.

## API and Android

- Home → Account reads the authenticated profile. Country is optional; English
  is the only interface language. Country never changes playback eligibility.
- Analytics and ads preferences default to false. The server timestamps explicit
  changes. These preferences alone are not a consent-management platform and do
  not initialize tracking/ad SDKs. P3/P4 must apply their own approved gates.
- `PATCH /v1/me` accepts only locale/country/analytics_consent/ads_consent.
- Account deletion requires explicit confirmation and same-account Google
  reauthentication. Django checks the signed Firebase `auth_time` (five
  minutes maximum); refreshing a token does not qualify as reauthentication.
- `POST /v1/me/deletion` returns 202 and an opaque receipt with `pending` or
  `completed`. A pending result is accepted work, not completed provider cleanup.
  A lost response leaves status unknown. Signing in is not a status check:
  Google sign-in can create a new account after deletion.
- Native and app sessions are cleared after accepted deletion or logout.
  Another account signed in during an outstanding request must not be cleared.

## Deletion guarantees and limits

The local transaction records a unique deletion fingerprint and cascades the
consumer profile, authenticated WatchProgress, and EpisodeEntitlement records.
Other accounts and unlinked guest-device progress are unaffected. There is no
push registration or financial ledger model yet; those processors must join
this workflow before their respective feature ships.

Authentication and deletion use the same PostgreSQL transaction advisory lock
derived from the UID. This prevents a concurrent first login from committing a
profile after deletion. All protected endpoints reject deleted UIDs; ordinary
anonymous catalog access remains available. Already-issued media URLs expire
under the existing playback TTL; this feature does not revoke CDN tokens.

Firebase cleanup happens after local deletion commits. A provider failure leaves
a pending receipt. A per-receipt row lock serializes cleanup; a process crash is
safe to retry, and Firebase's user-not-found result counts as success. Raw UID is
erased at completion. No credentials, provider payloads, or provider exception
messages are stored in the receipt or printed by the retry command.

The stable UID fingerprint is pseudonymous, not anonymous. It does not depend
on the rotating Django secret. Receipt fields are fingerprint, opaque public ID,
status, timestamps, attempt count, and the raw UID only while cleanup is pending.
They serve replay prevention and operational audit, not analytics. Production
retention/access controls require D-020 approval; do not silently treat an
indefinite operational tombstone as an approved retention policy.

## Operations

Run with the intended environment's configuration (never paste values into PRs):

```shell
uv run python backend/manage.py retry_account_deletions --limit 100
```

The command prints only processed/completed/pending counts and exits nonzero
when work remains. Inspect configuration/provider health privately, then retry.
It cannot create receipts or select arbitrary users for deletion. In admin mode
the default Firebase app is initialized with the configured project; local mock
cleanup is permitted only with DEBUG enabled. Test fixtures use fakes or the Auth
emulator. Never run a real-account deletion as a smoke test.

P5 must schedule this command and monitor nonzero/pending counts before public
activation. In current local/staging development, operators run it explicitly.
Do not clear pending receipts to silence an alert. A completed receipt does not
prove deletion from future processors that have not been integrated.

## Migration and rollback

Migration 0002 only adds a table and fields. Database defaults preserve inserts
from the old revision while migration-first deployment switches traffic.
Nullable consent timestamps stay unset until explicit preferences are saved.

**Do not roll back to a revision without the deletion authentication guard after
accepting any deletion.** Keep the table and guard, even if reverting UI changes.
Do not reverse the migration or restore deleted users from backups; reapply
deletion receipts to any restored environment before enabling traffic. The
old-revision INSERT regression validates deployment compatibility, not safe
rollback of privacy behavior.

## Validation

Automated coverage includes missing/invalid auth, stale/future/missing auth_time,
write-field allowlisting, opt-in defaults, local cascading, other-user isolation,
duplicate/concurrent deletion, first-profile creation races, provider retry,
already-missing Firebase users, and old-revision inserts. Mobile tests cover
same-account password/Google reauthentication, confirmation/duplicate taps,
preference failures, pending/completed/lost responses, and session cleanup.

The deterministic Expo configuration gate must not load a developer `.env`:
set `EXPO_NO_DOTENV=1` for `pnpm check` / `pnpm mobile:config:check`. Do not remove
or edit private environment files to make negative configuration tests pass.

Firebase behavior references: [Admin user deletion](https://firebase.google.com/docs/auth/admin/manage-users#delete_a_user),
[session/authentication time](https://firebase.google.com/docs/auth/admin/manage-sessions),
and [Google sign-in account creation](https://firebase.google.com/docs/auth/android/google-signin).

### Recorded evidence — 2026-08-31

- PowerShell `$env:EXPO_NO_DOTENV='1'; pnpm check`: PASS. Repository safety scan,
  49 repository tests, governance, backend lint/format/types/migration drift,
  183 backend tests, OpenAPI regeneration/drift, mobile lint/format/types,
  16 suites / 67 mobile tests, and configuration negative cases all passed.
- `$env:EXPO_NO_DOTENV='1'; pnpm mobile:bundle:check`: PASS, Android JS export.
- `uv run pytest backend/tests/accounts/test_lifecycle_races.py -q`: PASS (2),
  deterministic first-profile deletion race and old-revision insert.
- `pnpm --filter @shortform/mobile test --runInBand src/features/account/AccountScreen.test.tsx src/auth/nativeFirebaseAuth.test.ts`:
  PASS (21), including delayed account-A results after account-B session change.
- Historical Pixel_9 Android validation used the since-removed synthetic password
  surface. Account showed English, blank country, both preferences off; saved
  FR/analytics-on with ads still off; explicit confirmation and reauth; UI
  reports completed deletion and signed-out state. The isolated validation DB
  had one profile, one generated progress row and one entitlement beforehand;
  all three counts were zero afterward, Firebase emulator user count was zero,
  and the completed receipt's raw UID was blank. Retry command processed zero
  and left zero pending. No live identity or media was used.

Local tooling: backend uses a separate validation database, fake media provider,
and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. The existing app was reloaded
through ADB reverse/localhost Metro. Metro's Windows watcher initially crashed
on repository-test temporary directories; restarting with `CI=1` removed that
watcher dependency for observation. Existing staticfiles/pytest-cache warnings
do not represent failed test assertions. Google reauthentication is verified
at the mocked native SDK boundary; no live Google account was used or deleted.

Remaining release work: approved production support/deletion/privacy URLs and
export fulfillment, D-020 policy, scheduled retry/monitoring in P5, and future
processor integration. These are not silently declared production-ready.

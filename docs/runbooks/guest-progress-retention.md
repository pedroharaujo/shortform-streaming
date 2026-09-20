# Guest progress retention

Plan P6-T04 / D-020; release follow-up #144. This is the first enforcement tool
for the approved 12-month guest-progress period, not final privacy clearance.

## Behavior

Guest resume position/completion currently lives in PostgreSQL under an opaque
device UUID. The command considers only rows without a signed-in profile, with
a device ID, last saved at or before the server's current UTC time minus 12
calendar months. A leap-day cutoff clamps to the last day of that month. Reads
do not renew retention; saved progress does. It neither inspects nor changes
wallets, purchases, entitlements, pending recovery or deletion receipts.

Preview is the default. Each invocation processes at most `--limit` records
(default 100; accepted range 1–1000), oldest first. Apply takes row locks, skips
active writers and rechecks eligibility before deleting. Output contains only
counts and the cutoff. A zero apply count may mean candidates were locked; it
is not proof that all expired rows have gone.

## Deployment and operation

1. Deploy the additive progress index migration and the updated progress writer
   before enabling cleanup. The writer locks its selected row so cleanup cannot
   remove it between a read and save. Ensure old API workers have drained first.
   The partial index is created concurrently on PostgreSQL. If an interrupted
   migration leaves an invalid index, inspect and repair that index before retrying
   the migration; do not fake migration completion.
2. Confirm the intended environment, approved retention policy, backup/restore
   deletion procedure and database migration state. Do not run apply against
   production during development validation. Deletion is not reversed by a code
   rollback; restoring a backup must reapply required deletions before traffic.
3. Preview a bounded batch using the configured Django environment:

   ```text
   python backend/manage.py expire_guest_progress --limit 100
   ```

4. After the deployment/activation prerequisites are satisfied, explicitly apply
   a batch in that same environment:

   ```text
   python backend/manage.py expire_guest_progress --limit 100 --apply
   ```

5. Configure the approved environment's existing job runner for regular bounded
   passes and monitor failures, skipped work and oldest eligible age without
   logging device/episode identifiers. Daily execution and sufficient batch
   capacity are deployment targets, not an already active schedule. Assess and
   clear any backlog; do not treat one successful batch as retention compliance.

## Validation and remaining release work

PostgreSQL command tests cover preview, batch limits, repeat execution, calendar
and cutoff boundaries, old signed-in/recent guest preservation, output privacy,
an active writer surviving cleanup, and a writer waiting for cleanup recreating
fresh progress successfully. Existing progress API/authorization tests remain
required. Fixtures are generated and only the isolated test database is changed.

Still open under #144: scheduled execution and backlog evidence in the approved
environment, an in-app guest erase action that deletes the actual server data,
provider/backup propagation, final notice and release review. Rotating the device
UUID or clearing application storage is not a substitute for server erasure.

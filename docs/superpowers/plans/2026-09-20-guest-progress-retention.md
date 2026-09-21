# Guest Progress Retention Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for implementation and superpowers:requesting-code-review before publication.

**Goal:** Provide a preview-first, bounded command to expire server-held guest watch progress after 12 calendar months without touching signed-in or financial data.

**Architecture:** Keep the existing progress storage and API. Compute a UTC calendar-year cutoff from server time and select guest rows by last saved progress (`updated_at`). Require `--apply` for deletion, lock the selected rows and skip rows locked by active writers. Serialize progress upserts with the same row locks. No scheduler or production deletion is activated in this slice.

**Tech Stack:** Django, PostgreSQL, pytest, existing management-command deployment path.

Scope: D-020 / P6-T04 / #144. Group the approved decision and first enforcement command in PR #184. The founder approved preparation and implementation; no additional plan-choice approval is needed. Stay in this checkout and preserve the unrelated cleanup stash.

## Acceptance and implementation

- [x] Add `backend/tests/progress/test_guest_retention.py`: command defaults to a count-only preview; explicit apply removes only guest rows at/before the calendar cutoff, preserves recently updated rows and all signed-in progress; bounded batches and repeated execution converge; invalid bounds fail; output has no identifiers. A PostgreSQL concurrency test holds an active progress update open while cleanup runs and verifies the updated row survives.
- [x] Run `.venv/Scripts/python.exe -m pytest backend/tests/progress/test_guest_retention.py -q` and observe missing-command failures before implementation.
- [x] Add `backend/apps/progress/management/commands/expire_guest_progress.py`. CLI: `--limit` default 100, range 1..1000, `--apply` opt-in. Calculate `now.astimezone(UTC).replace(year=now.year-1, day=min(now.day, monthrange(now.year-1, now.month)[1]))`. Filter `user_profile__isnull=True, device_id__isnull=False, updated_at__lte=cutoff`, order by `updated_at, pk`, slice limit. Preview prints only count/cutoff. Apply wraps `select_for_update(skip_locked=True)` and deletion of selected primary keys in one transaction, rechecking the same eligibility filter. No profile, financial or deletion-receipt query is permitted.
- [x] In `backend/apps/progress/models.py`, wrap `upsert_watch_progress` in `transaction.atomic` and lock existing rows on initial lookup and insert-race fallback before saving. Add a partial `(updated_at, id)` index for guest rows and generate the additive migration with `makemigrations progress`.
- [x] Correct the factual local-only guest storage claim in the retention decision/draft. Add a short runbook with preview/apply, last-write retention basis, missing scheduler/erase UI and production activation prerequisites. Opening the app or reading progress does not renew the timestamp. Existing API writes do.
- [x] Run focused progress tests, backend lint/format/types/migration checks, backend suite, contract and repository foundation. Run only relevant changed-area checks; do not repeat emulator purchases.
- [ ] Request independent review of the diff and race coverage, fix actionable findings, update PR #184 and #144, and restore the unrelated cleanup exactly. Do not merge automatically.

## Release follow-up

The guest device identifier currently points to server records; clearing app storage alone does not delete them. The user-facing erase control, approved deployment schedule, provider lifecycle configuration, inactive-account notices, deletion-receipt expiration and financial retention remain distinct follow-ups under #144. The current command is a deployable tool, not evidence that automatic retention or guest erasure is live. Do not erase real data or enable new cloud services while verifying this change.

## Review evidence

Independent code review covered deletion scope, concurrent writer/cleanup ordering, count-only output and the concurrent index migration. Its single finding was a misplaced test assertion; corrected and confirmed closed. All 17 progress tests now pass. A real local preview reported zero candidates and deleted no rows. Full backend validation passed (715 tests), as did Ruff lint/format, mypy, migration drift, API contract, repository foundation (55 tests plus safety/governance) and diff checks. Exact commands are recorded in the PR.

# P3-T08-F1 pending reward recovery implementation plan

> Execute in the existing checkout on `codex/p3-t08-f1-reward-recovery`.
> Production ads remain disabled. Never merge automatically.

**Goal:** Recover one in-progress rewarded-ad attempt across offer-sheet remounts
and app restarts without creating another server intent or adopting another
account's work.

**Architecture:** Store one versioned, sanitized attempt in Expo SecureStore.
The record contains only the opaque profile public ID, episode public ID,
idempotency request UUID, and optional intent UUID. On load, compare the current
owner-only `/v1/me` profile before using the record. A known intent resumes with
owner-only status checks and no ad presentation. A record saved before an
ambiguous create response replays the same request UUID through the existing
idempotent create endpoint. Terminal server status clears the record and permits
an explicit new attempt.

**Out of scope:** Backend/schema changes, provider configuration, production
enablement, analytics, ad bindings, callback payloads, signed URLs, and cleanup
of server-side expired rows. Genuine provider validation remains #98.

## Tasks

- [x] Add lifecycle-level RewardScreen regressions for ambiguous-create remount,
  known-intent status-only recovery, terminal retry, and account replacement.
- [x] Add a strict SecureStore adapter that validates the versioned record,
  removes malformed/wrong-account data, and ignores another episode's attempt.
- [x] Integrate recovery into RewardScreen after `/v1/me` succeeds. Persist before
  create, add the intent UUID after create, and never present an ad for a recovered
  known intent.
- [x] Clear the stored attempt after verified grant or terminal server status.
  Permit a new attempt only after explicit terminal refresh.
- [x] Run focused mobile tests, lint/type/config checks, full `pnpm check`, and
  Android bundle validation if the existing bootstrap supports them.
- [x] Review the final diff for duplicate intent/impression paths, stale-session
  navigation, cross-account disclosure, sensitive persistence, and production
  enablement.

## Acceptance mapping

- Same account + same episode + ambiguous create: reuse the stored request UUID.
- Same account + known pending intent: call only owner status; no create or ad.
- Expired/unavailable status: explicit refresh enables a fresh request UUID.
- Different/deleted/replaced account: do not query or display the previous intent.
- Grant still requires fresh offers and playback authorization.

## Rollback

Revert the mobile change. The SecureStore record is versioned and ignored/removed
when invalid; backend intents and entitlements remain authoritative and additive.

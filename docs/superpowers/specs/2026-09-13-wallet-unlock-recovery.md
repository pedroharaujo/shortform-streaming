# Find an interrupted coin unlock from Wallet

Issue #173, P3-T08-F2/P3-T09, D-036; the existing #144 accounting resolver is
authoritative. A saved unlock must remain reachable after application startup
even if the episode has disappeared from the catalog.

## Storage and authority

Keep the existing strict PendingCoinUnlock schema and per-episode legacy key.
Add one bounded account-scoped SecureStore journal containing the complete
original attempt. One unresolved journal prevents a new debit for another
episode on that account. Serialize journal and legacy operations through the
existing module queue; never persist credentials, media, prices in money or
provider payloads.

Before a new debit, inspect and validate both records. Never overwrite a
different journal or legacy attempt. Write the journal first, then the legacy
marker, and permit the debit only when both writes succeed. An interrupted or
failed write retains the journal and offers the existing resolver; a saved but
unsent attempt can safely receive its server cancellation barrier.

Reads reconcile matching journal and legacy attempts. A journal alone is valid
recovery evidence without another storage write; conflicting or malformed
records fail closed. Import an existing legacy marker when its episode
route is reached and the journal is empty or matching. SecureStore cannot
enumerate old keys, so unseen pre-journal attempts remain undiscoverable from
Wallet; retain their original route-based recovery without claiming migration.

Only existing verified terminal resolution can clear a matching attempt. Inspect
both records, compare all original fields, and apply current-session guards at
every asynchronous mutation boundary. Delete the legacy marker first, then the
journal. Failure deleting either retains journal recovery; a repeat resolution
is safe. A stale response must never clear or replace a newer attempt. Deletion
and account changes retain existing ownership semantics.

## Wallet and navigation

Obtain the authenticated profile through the existing MeClient. Load its journal
without requiring catalog or offer availability; keep wallet balance failures
independent from recovery discovery. Show one accessible "Check coin unlock"
action for that current account and route directly to the existing unlock screen
with its opaque episode ID. No receipt itself grants playable access.

Hide stale account data immediately on session change. Storage/profile failure
must not look like an empty journal: show concise recovery-unavailable copy and
allow retry. Anonymous accounts see the normal sign-in path. Preserve Wallet's
foreground/focus refresh and all existing purchase, balance and return navigation.

## Verification

Prove write interruption before either marker, exact cleanup with partial failure,
cross-account/conflicting/corrupt journal rejection, journal-only recovery,
legacy import, and no debit before durable storage. At screen level prove Wallet
reaches recovery without the catalog or a successful balance fetch, and account
changes invalidate pending reads/actions. Reuse existing resolver and eligibility
tests rather than duplicating financial policy coverage.

Run local Android generated-coin/video checks and record the exact observation,
including simulated lost responses where used. Genuine store purchase, actual
OS process termination and support-contact release gates remain separate. No
production spending, purchase activation, refund policy or schema change.

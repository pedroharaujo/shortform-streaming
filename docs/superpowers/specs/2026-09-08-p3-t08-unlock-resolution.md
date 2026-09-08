# Resolve interrupted coin unlocks (#144)

Use the approved P3-T08-F2/P3-T09 architecture and existing local synthetic spending
gate. The founder authorized fixable engineering; public support contact, actual
device evidence and live purchases remain unapproved/open.

## Protocol

Add authenticated `POST /v1/coins/unlock/resolve`, accepting the original unlock
request exactly. Under the existing account lock and wallet lock, either return
the matching immutable completed receipt or append an immutable cancellation for
that account/request. Return only episode/request IDs, completed/cancelled status,
charged coins and current balance. This is historical accounting, not a statement
of current content eligibility. Never mint, refund, or recreate an entitlement.

Cancellation is a terminal record: a delayed original request cannot debit after
resolution. A database trigger serializes and excludes receipt/cancellation pairs
even for old application writers. It changes the wallet row version so stale
repeatable-read transactions fail rather than inspect an obsolete snapshot.
Both records survive account deletion with the detached wallet. Their original
terms are immutable and mismatched reuse fails closed. Expand only; no historical
rows are rewritten, and destructive reversal is not an application rollback.

## Mobile

After a lost response, Check coin unlock calls resolution with the saved original
UUID/terms. A cancelled result clears only that matching local record, refreshes
current choices and requires another explicit price confirmation. A completed
result refreshes wallet/current access and freshly authorizes playback. Offline,
unknown status, mismatched response and changed account preserve the request.
Local Android and server spending gates remain; no store or refund policy added.

## Acceptance

Prove saved-before-send cancellation, lost-after-commit recovery, changed terms/
rights, concurrent original/resolver, delayed legacy writers, repeated resolution,
account replacement/deletion, immutable cancellation history, migration expansion
and fresh playback authorization. Financial tests are immediate. #144 remains
open for approved support/contact and native verification; no human check is
treated as passed.

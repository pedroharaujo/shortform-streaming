# MVP retention decision — D-020

Plan: P6-T04 / P6-T05A. Related release follow-up: #144.

## Approval and limits

On 2026-09-20 the founder approved the proposed discretionary retention defaults
after reviewing the privacy/retention proposal. These are engineering targets
for the France-only, Android-only, coin-only MVP, not a claim that provider
settings or cleanup jobs already enforce them.

The approval does not settle financial-record retention, legal grounds,
international transfers, provider contracts, residency, public-policy approval,
paid professional services or production activation. D-020 remains partially
resolved. Do not publish a final policy until actual behavior matches its text.

## Approved defaults

| Category | Target and starting point | Required protections |
| --- | --- | --- |
| Active profile, preferences and signed-in progress | While active; delete promptly following verified account deletion. After 24 months without sign-in or purchase activity, give advance notice, deactivate the profile and delete nonessential preferences/progress. | Preserve the minimum access link needed to recover purchased content; do not expire bought access through inactivity cleanup. Notice timing and the recovery mechanism need implementation design. |
| Guest viewing progress | Expire after 12 months from the last saved episode progress, or earlier through a verified guest-erasure control. | Existing progress is server-held under the app's random device identifier. The original proposal incorrectly described it as local-only. The first enforcement tool covers those existing server records; no new collection/storage is authorized. Never apply this period to pending financial recovery. |
| Routine support/privacy emails | 12 months after case closure. | Separate justified dispute, rights-request, fraud or accounting holds from routine mail; review each hold under its applicable purpose and period. |
| Operational/security logs | Rolling six months. A specific incident may justify retention up to 12 months. | Minimize fields; no credentials, message bodies, raw purchase identifiers or provider payloads. Inventory provider-controlled audit logs separately. |
| Completed account-deletion receipts | Three years after completion. | Minimal pseudonymous evidence, restricted access; clear raw Firebase identity after provider cleanup. Never expire pending cleanup or remove replay protection without verifying the remaining protections. |
| Backups | 35-day rolling expiry. | Reapply deletions before restored data returns to active use; verify backup, replica and point-in-time recovery lifecycles. |
| Optional analytics | 14 months from collection, without extending retention merely because a user returns. | Consent before collection; disable/reset device analytics on withdrawal/deletion. Verify provider historical-data deletion separately. |

Calendar months/years are the policy units. Any provider that accepts only days,
counts or a limited choice of periods needs an explicit documented mapping and
verified expiry behavior; do not silently equate backup counts with days.

Pending purchase/unlock recovery records have no age-only expiry. Retain the
minimum reconciliation evidence until a server-verified terminal outcome or
approved support resolution. Account deletion must not enable duplicate credits,
debits, account reassignment or recreation from delayed callbacks.

The proposal's possible ten-year financial archive is **not approved as an
applicable legal period**. Wallets, ledgers, purchase events, refund/chargeback
evidence, unlock/cancellation receipts and entitlement proof need a separate
category/field-level determination. Do not purge or apply a blanket ten-year
retention job to these records based on this approval.

## Read-only preparation evidence — 2026-09-20

- Source inspection: account deletion removes the profile and associated active
  data, retries Firebase cleanup, and clears raw Firebase identity on successful
  cleanup. The durable receipt remains; the approved three-year expiry is not
  implemented. Financial records are detached, not anonymized or purged.
- Existing staging Google Cloud log configuration: global `_Default` bucket
  reports 30 days; locked `_Required` bucket reports 400 days. No regional log
  bucket was returned for the existing staging region. These are observations,
  not approved production settings or evidence of six-month enforcement.
- Cloud SQL backup inspection was unavailable because the Cloud SQL Admin API
  is disabled in the staging project. This is not evidence that backups exist,
  satisfy 35 days, or that a production database has been selected.
- Firebase Analytics, RevenueCat, Bunny, Gmail, the final database/backup
  provider and public-page hosting still need exact-account lifecycle checks.
  No provider account settings were changed during this preparation.

## First enforcement slice

`expire_guest_progress` now provides a bounded, preview-first cleanup tool for
existing server-held guest progress. `--apply` is required to delete a batch.
The cutoff uses the server's UTC time minus 12 calendar months, clamping a leap
day to the final day of the corresponding month. It uses each episode's last
progress write, not account creation, app opening or history reads. Signed-in
progress and all financial/recovery records are outside its scope.

This tool has not been scheduled or applied to live data. The user-facing guest
erase control remains unimplemented. Clearing the app's device identifier alone
does not erase existing server-held history. Deployment and remaining acceptance
are in the [guest progress retention runbook](../runbooks/guest-progress-retention.md).

Only normalized configuration observations belong in public evidence; never
include account payloads, user records, credentials or mailbox contents.

## Engineering sequence

1. Inspect exact release-provider settings and record supported retention,
   deletion, restoration and transfer behavior. Resolve the separate mandatory
   audit-log exception and financial-record schedule before public disclosure.
2. Implement ordinary-data retention in small reviewed changes, with dry-run
   inventories, bounded batches and a scheduler. First establish trustworthy
   age/activity timestamps and notice delivery. Do not infer inactivity from
   account creation or erase unresolved recovery markers.
3. Configure supported log, backup and opted-in analytics periods for the
   approved environment. Verify restore/deletion propagation and avoid changing
   unrelated projects or shortening existing data retention without review.
4. Verify each affected lifecycle once at the appropriate level, then update
   the notice, external deletion page and Play disclosures against the exact
   release. Existing successful purchase tests need not be repeated for a
   documentation-only approval.

Implementation and provider verification remain open in #144 and the
[publication checklist](MVP_PRIVACY_PUBLICATION_CHECKLIST.md). No cleanup job,
financial operation, new provider service, production flag or release is enabled
by this document.

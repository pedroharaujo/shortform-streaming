# P3-T06 recent verified purchase recovery

Issue: #142. This slice makes historical purchase credits and safe support
references available on a fresh Android installation without retaining store
transaction IDs. It is development progress, not completion of native checkout,
refund settlement, or Google license-tester acceptance.

## Design

Add authenticated, App Check protected `GET /v1/purchases/history`, behind the
existing DEBUG plus synthetic purchase-mode gate. Return the newest 20 credited
decisions owned by the current, locked profile, ordered by creation time and UUID
descending, plus `has_more`. Do not create a wallet or purchase identity. Include
only `recorded_at`, `historical_credited_coins`, `support_reference`, and `status`
(`credited` or `review_required`). Any quarantined event on a credited decision
keeps it in review, including after a successful retry. Exclude unattributed and
foreign decisions. Deleted/recreated accounts cannot adopt old records. Preserve
historical values after registry changes. Respond with `Cache-Control: no-store`.
No caller-selected owner, transaction identifier, product or application is needed.

Add an Android recent-purchases screen linked from the wallet. Load from the
server on entry, explicit refresh and foreground. Clearly distinguish historical
credits from current spendable balance and unresolved/refunded settlement. Empty
history does not prove a purchase failed; tell the viewer to check again rather
than buy again. Show safe support references, never raw provider identifiers.
If more than 20 records exist, explicitly label the list as the latest 20.
Do not persist history, add analytics, initialize a provider, restore consumables,
credit coins, authorize playback, or change production purchase gates.

Use the existing session revision guard: account replacement immediately hides
old rows; pending results cannot restore them. Refresh must clear old records and
stale/unmounted requests must be ignored. Fail closed on malformed API responses.
The regular wallet continues to load the authoritative balance separately.

## Deferred scope

Native RevenueCat offerings/checkout and real transaction correlation remain the
next purchase task. The existing synthetic callback protocol cannot accept real
Google/RevenueCat transactions. Full historical pagination, real store configuration,
approved refund handling, and Google purchase/reinstall/second-device evidence remain
in #142 and the P6-T03 final validation pass. No provider/device result is inferred
from synthetic tests. D-008/D-020/D-025 release decisions remain open.

## Required evidence

Backend integration coverage for account isolation, deletion, registry drift,
immutable historical credit, persistent quarantine, bounded ordering, no writes,
auth/App Check and disabled modes. Mobile screen-level integration through the real
API wrapper covers request authentication, malformed responses, empty/unavailable,
refresh, foreground, session replacement and safe copy. Generated OpenAPI and client
must agree. Run repository, backend, contract, mobile and Android bundle gates plus
independent review and validation before merging.

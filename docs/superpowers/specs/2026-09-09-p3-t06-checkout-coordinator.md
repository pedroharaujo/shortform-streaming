# P3-T03/P3-T06 dormant checkout coordinator

Related to #142. Build the tested orchestration boundary for Android consumable
checkout with an injected synthetic provider. No new SDK, real store calls,
commercial configuration, app route activation, refund policy or production mode.
The existing wallet explicitly keeps purchases unavailable.

## Behavior and authority

Add a mobile client for the existing identity/catalog/status contracts. Authenticate
and use App Check through the app client factory. Runtime validation bounds catalog
to 1–32 unique synthetic products, exact consumable/PLAY_STORE/SANDBOX/store-price
metadata, positive coin integers <=2147483647 and valid server UUID identity.
Status awaiting-verification requires zero historical coins and null reference;
credited/review-required requires positive bounded coins and UUID support reference.
Project only known fields; failures use fixed text. Never reflect provider errors.

The coordinator accepts disabled or local-development synthetic mode only, a
synthetic application ID, API client, wallet client, synthetic provider and pending
storage. Disabled, nonlocal or nondevelopment mode returns unavailable before
any API/provider/storage work. The shipped default factory stays disabled and
does not instantiate a provider. Native SDK binding is a later task.

Capture the session revision on creation and permanently invalidate on replacement,
including same-token replacement. Check it before and after each asynchronous
boundary. Obtain the authenticated server purchase UUID before provider binding;
provider preparation must confirm that exact identity. Only one coordinator may
operate on the process-global provider boundary at a time, across instances and
accounts. Concurrent operations return busy rather than queueing another purchase.

`load()` obtains identity, reads its pending marker, and either reports unresolved
recovery or fetches catalog/provider offers. Match exact synthetic application,
product, consumable type, PLAY_STORE and SANDBOX; reject duplicates/ambiguous or
unknown offers and mismatched identity. Prices are nonempty bounded strings and
are preserved byte-for-byte, including spacing/currency formatting. Never derive
prices or coin quantities from locale/provider entitlements. Return display offers
with server quantity, product ID and exact price string.

`purchase(productId)` requires a prior successful load and an explicit call. Before
checkout, recheck owner, unresolved storage and fresh catalog/provider offerings.
If the selected product's displayed price or coin quantity changed, return fresh
offers without starting checkout; another explicit confirmation is required.
Persist an immutable random-attempt marker successfully before invoking provider
purchase. Provider success only supplies a matching transaction for a status read.
Validate the result's owner/product/application/store/environment. Malformed,
pending, thrown or uncertain outcomes retain the marker; no automatic retry.
Only an explicit normalized cancellation of this active attempt or a matching
server credited result may conditionally clear it. A generic provider failure
is not proof of cancellation.

`sync()`/recovery never invokes purchase. Keep a completed checkout's transaction
ID only in memory, bound to its original attempt/identity/product. POST it in the
status body; never return it in public state or persist/log/analyze it. Without
that ID after process restart, report unresolved and block new checkout: existing
history cannot establish a transaction-to-attempt correlation. For matching server
credit, show original historical quantity/support reference and refresh wallet
separately; wallet outage cannot erase credit evidence or manufacture balance.
Do not compare historical quantity with a now-repriced catalog. Review-required
retains the marker and safe support reference. Awaiting/failed synchronization
never clears it. No client operation credits coins, resolves refunds or grants
access/playback.

## Secure pending marker

Use the serialized/CAS pattern of `pendingCoinUnlock.ts`, not best-effort reward
cleanup. A strict versioned record contains only server purchase identity UUID,
synthetic application/product IDs, and random attempt UUID. One unresolved marker
per purchase identity, using a SecureStore-safe key. No Firebase token/UID, profile
object, raw transaction, receipt, price or provider/customer payload. Validate keys,
version, exact fields and bounds; corrupt/read/write failures block checkout and
must not be treated as absent or erased. Writes refuse replacement. Conditional
cleanup matches the complete marker and current session under the same serial
queue; it cannot erase newer/foreign attempts. Account switches retain inaccessible
old markers rather than adopting them. Explicit deletion/privacy lifecycle for
real commerce remains a required integration gate before activation.

## Validation and limits

Test at the coordinator's observable integration boundary with real HTTP client,
synthetic transport and mocked SecureStore/provider. Cover exact non-English
monetary strings without approving another market, input/output bounds, identity
and offer mismatch, prior load/price reconfirmation, simultaneous controllers and
double taps, persist-before-purchase, storage failures/corruption/CAS, cancel versus
pending/uncertain outcomes, status-only verification, wallet outage, review,
registry reprice after credit, restart marker and session switches at asynchronous
boundaries. Separate storage tests only for genuine storage concurrency/CAS risks;
avoid duplicating controller outcomes across layers. App factory attestation is a
separate boundary. No provider/native result is inferred from synthetic tests.

This delivers the dormant coordinator, not a working native checkout. Still
required: genuine RevenueCat SDK adapter/configuration, provider-to-status
transaction identifier equivalence, acknowledgment/consumption ownership, unknown
attempt reconciliation, account deletion/provider-data handling, store UI and
Google license-tester evidence. D-008/D-020/D-025 remain activation gates.

References: ADR 0006, decision register D-008/D-020/D-029,
`docs/product/SDK_DATA_INVENTORY.md`, and RevenueCat's official
[purchase lifecycle](https://www.revenuecat.com/docs/getting-started/making-purchases)
and [identity guidance](https://www.revenuecat.com/docs/customers/identifying-customers).
RevenueCat normally owns Android consumption; this slice does not call it.

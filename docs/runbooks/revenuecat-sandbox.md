# RevenueCat sandbox verification

**Scope:** P3-T04/P3-T06, D-036, related to issue #164. This implements server
verification, opt-in Android checkout and recovery of a known Google Play tester
transaction. Checkout defaults to disabled. The first genuine no-charge purchase,
verified credit and episode unlock are recorded in
[Android test observations](android-play-registration.md); remaining lifecycle
checks below are not implied by that happy-path result.

## Private setup

Use an isolated non-production RevenueCat project linked to the intended Google
Play tester app. Configure the existing account's server purchase UUID in the
native SDK before purchasing. The Firebase UID, email and anonymous RevenueCat
identity are not purchase owners. The adapter obtains this identity from Django
before configuring RevenueCat and refuses anonymous or conflicting identities.

Set these **server-only** values privately, never in Expo public variables or Git:

- `COIN_PURCHASE_MODE=revenuecat_sandbox`, using local Django settings (`DEBUG`).
- `REVENUECAT_PROJECT_ID` and `REVENUECAT_API_KEY`. The secret API key needs
  `customer_information:purchases:read`, `project_configuration:products:read`
  and `project_configuration:apps:read` for product app expansion.
- `COIN_PURCHASE_PRODUCTS`: a bounded JSON list with the same fields as the
  [generated registry](synthetic-purchases.md), except `synthetic: false`, actual
  RevenueCat `app_id`, Android package `application_id`, Google SKU `product_id`,
  and `approval_reference: "D-036"`. Keep `store: "PLAY_STORE"`,
  `environment: "SANDBOX"`, `product_type: "consumable"`, `price_source: "store"`
  and `finance_owner_role: "finance"`. Configure test coin quantities explicitly.
  D-036 authorizes the isolated test journey; these are not approved commercial
  packs or prices under D-008.

The signed callback route has a separate, default-disabled sandbox switch; see
the notification setup below. Production Django settings reject both purchase
modes. Provider setup and a protected reachable callback address are separate
requirements; this implementation does not publish the local development server.

## Sandbox notifications while the app is closed

Issue #169 / P3-T04 adds an opt-in handler at `POST /v1/purchases/revenuecat`.
Use only the isolated test project and an approved callback route. Keep
`REVENUECAT_SANDBOX_WEBHOOK_ENABLED=false` until those prerequisites exist.

1. Complete the private server setup above and configure the RevenueCat dashboard
   integration for the intended sandbox app. Store its configured Authorization
   value in `COIN_PURCHASE_AUTHORIZATION` and its webhook HMAC signing secret in
   `COIN_PURCHASE_SIGNING_SECRET`, privately. Both are required; use separate
   test secrets, not the server API key or the mobile public SDK identifier.
2. Set `REVENUECAT_SANDBOX_WEBHOOK_ENABLED=true` with local Django settings and
   `COIN_PURCHASE_MODE=revenuecat_sandbox`, then restart the backend. Missing
   secrets, malformed flags and an incompatible mode fail configuration checks.
3. Send a dashboard TEST event and observe a generic HTTP 200 ignored result,
   with no wallet mutation. A dashboard test alone is not purchase evidence.
4. Close the app after a genuine license-tester purchase. Observe one verified
   server credit, reopen the app and refresh the wallet. Retry the delivery and
   race a client sync: the transaction must still have exactly one credit.
5. Interrupt provider reads and retry a purchase notification: unresolved reads
   return a generic HTTP 503 so delivery can retry, with no positive decision.
   Restore access and verify the same transaction converges once.
6. Send the genuine refund lifecycle before and after purchase delivery. Signed
   cancellations immediately establish review barriers even if provider reads
   lag or fail. Already credited transactions remain in review; no coin debit,
   entitlement removal or unapproved refund policy is applied by this slice.

The [provider authentication contract](https://www.revenuecat.com/docs/integrations/webhooks)
uses a signature timestamp distinct from the event timestamp and signs exact raw
bytes. Each retry receives a fresh signature; old event timestamps remain valid
when freshly signed. The handler requires Authorization plus HMAC, bounds input,
and uses the original event ID for duplicate/conflict handling. Positive events
must match fresh v2 purchase facts, including purchase time and quantity one.
Provider I/O occurs outside database locks. Unsupported events are ignored;
transfers never reassign the wallet.

All genuine steps above remain unchecked under D-029 until observed with the
configured provider. Record only device/build, safe support references and
normalized outcomes in restricted evidence. Never capture headers, raw bodies,
subscriber attributes, account details or store transaction identifiers. Rollback
is `REVENUECAT_SANDBOX_WEBHOOK_ENABLED=false`; retain immutable review/credit
history. This does not resolve an unknown local checkout attempt or enable a
second charge.

### Temporary callback receiver for the local Android test

`backend/config/purchase_callback_bridge.py` supplies a separate loopback-only
receiver for the signed JSON POST. Run it as a module with `PYTHONPATH=backend`,
for example `uv run python -m config.purchase_callback_bridge --port 18082
--upstream-port 8000 --lifetime 1800` against the explicitly selected local test
backend. Its default upstream port is 18000; select 8000 only for the supervised
Android test instance. Never tunnel Django itself.

Only exact `POST /v1/purchases/revenuecat` is forwarded. The bridge preserves raw
body bytes and the Authorization/signature headers, bounds input to 32 KiB and
30 forwarded requests per minute, and rejects query strings, duplicate required
headers and transfer encoding. It returns empty no-store responses, never backend
bodies/cookies/redirects, and suppresses request logs. Client and upstream sockets
have absolute deadlines; the receiver expires within one hour.

Public activation is a separate step: approve a temporary callback-only HTTPS
route, verify ngrok capture and exports are disabled using harmless probes, and
supervise both receiver and tunnel with automatic expiry. Stop only those owned
processes on expiry or failure. The existing app backend must remain private.
The RevenueCat integration must select Sandbox only and the intended Play app.
Use dedicated Authorization and HMAC credentials stored outside Git. Do not
enable callbacks until both credentials and route validation are complete.

On 2026-09-20, engineering prepared the unsaved RevenueCat integration form and
implemented this receiver. Local socket tests and independent review cover exact
bytes, path/header isolation, framing/size rejection, empty responses, upstream
outage, rate limiting, expiry and slow clients/upstreams. Review found that the
earlier version of this runbook named a nonexistent route; it now matches Django,
with a regression test against the registered URL. This preparation is not
evidence of genuine callback or refund delivery, and starts no external tunnel.

## Android test checkout

The development client includes `react-native-purchases` 10.9.1. Rebuild the
Android client after installing this dependency. Before opting in, confirm the
Google account is a **Play license tester**, the intended app/product are linked
in RevenueCat, and the purchase sheet uses a Google test payment method. A debug
build or closed-test enrollment alone does not prevent real charges. Follow
[Google Play sandbox setup](https://www.revenuecat.com/docs/test-and-launch/sandbox/google-play-store).

Only after that setup is verified, configure the mobile development environment:

- `EXPO_PUBLIC_COIN_PURCHASE_MODE=revenuecat_sandbox`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_SDK`: the public Android `goog_` SDK identifier
  for the isolated project. This is distinct from the secret server API key;
  never put the server key in the app.

Use `EXPO_PUBLIC_API_ENVIRONMENT=local` and a development Android client. Staging,
production, release JavaScript and non-Android runtimes cannot enable checkout.
Missing or malformed purchase manifest settings disable the feature without
breaking older clients. The default disabled factory does not load the provider.

Open the home coin shortcut (or Account → Coins) to the unified Coins screen.
Quantities come from the server registry;
prices remain the exact store strings. RevenueCat owns acknowledgement and
consumption; the app does not manually consume or call `syncPurchases()`. Native
success starts server verification, then refreshes the wallet. Only explicit
store cancellation, explicit product unavailability, identity-checked purchase
rejection (`purchase_not_allowed`) or verified completion clears
the matching saved attempt. An uncertain
attempt blocks another purchase. Provider logs, diagnostics and automatic device
identifier collection are disabled by the adapter.

## Request and result

After obtaining the server purchase identity and completing a genuine tester
purchase, send authenticated JSON to `POST /v1/purchases/sync` with exactly
`application_id`, `product_id` and `transaction_id` (the Google Play order ID).
Never put the order ID in our URL, logs, screenshots or support notes. There is
no client coin amount, owner or environment field. Unknown identities cause no
provider request and create no wallet. Requests are limited to six per minute
per account using the local Django cache; this is not a distributed production
abuse-control implementation.

The server searches RevenueCat's
[purchase API](https://www.revenuecat.com/docs/api-v2/purchase) and resolves the
[product with its app](https://www.revenuecat.com/docs/api-v2/product). It verifies
the exact transaction, current and original customer, SKU, RevenueCat app,
Android package, project, sandbox Google Play scope, purchased ownership and
quantity one. A completed owned purchase enters the existing atomic ledger.
Provider requests use fixed-host HTTPS, five-second socket timeouts, a 128 KiB
response limit and no redirects. Raw responses and transaction IDs are discarded.

- `credited`: historical verified credit; refresh wallet and episode authorization.
- `review_required`: an owned credit has unresolved refund/conflict evidence.
  Repeating a successful response cannot clear review or grant more coins.
- `awaiting_verification`: missing, foreign, incomplete or unverifiable evidence,
  including a refund before credit. It does not prove cancellation or permit a
  new charge. Temporary provider failure leaves no permanent rejection record.

`POST /v1/purchases/status` remains a read-only local lookup. Both routes return
historical credit, not current spendable balance or permission to play media.
If the provider cannot be reached after an earlier credit, sync returns that
historical status, including existing review; it does not assert current provider
verification or final refund settlement.

## Validation and remaining work

Generated fixtures cover provider mismatch/malformed/redirect/timeout handling,
foreign-account attempts, duplicate and concurrent fulfillment, deletion during
lookup, refund ordering, provider failure recovery and production rejection.
Run `pnpm backend:check` and `pnpm contract:check` before merge.

Known-result recovery uses `POST /v1/purchases/recover` with `application_id`,
`product_id` and `transaction_fingerprint`. Version-2 SecureStore markers contain
only owner/app/product/attempt and this SHA-256 digest, never the raw order ID.
The digest is UTF-8 compact JSON of `["shortform-purchase-v1", owner UUID,
application ID, product ID, Google order ID]`. The backend reads the authenticated
owner's [sandbox purchases](https://www.revenuecat.com/docs/api-v2/customer/resources),
requires one exact match, and reuses full verification. It accepts only a complete
first page of at most 100 purchases; any continuation, malformed or ambiguous
evidence leaves the attempt pending. Sync and recovery share the six/minute limit.

If the process dies before the native result's fingerprint is saved, the unknown
attempt remains blocked. A history change, increased balance or elapsed time
cannot identify it. RevenueCat's React Native CustomerInfo history identifiers
are not Google order IDs. Do not erase the marker, retry charging, or guess a
match. This remaining resolution path and full production refund lifecycle are
follow-up engineering work. The sandbox notification implementation above still
requires genuine provider validation; no production activation is implied.

An explicit SDK product-not-available result from the native purchase call now
returns a retryable pack-availability message, after revalidating the same owner.
Like an explicit cancellation, only that exact scoped active attempt is cleared.
Identity errors before/after the purchase call, uncertain store/network errors
and contradictory results remain unresolved. This classification does not
retroactively resolve an attempt whose native result was already lost.

The 2026-09-20 [Android validation record](android-play-registration.md) now
covers genuine no-charge purchase, repeat purchase of the consumed pack,
cancellation before payment submission and known-result recovery after a cold
app restart. A signed provider TEST and a genuine sandbox refund callback also
returned HTTP 200 through an approved temporary receiver. The refund established
review without changing the 299-coin balance; repeated live verification and
known-result recovery preserved that review and the immutable ledger. The
first receiver window was stopped and its gate disabled. A second approved window
verified a fourth purchase credited while the app was stopped, manual RevenueCat
redelivery after local-server outage, and cold-launch recovery without duplicate
credit (399 coins). Final acceptance remains incomplete: duplicate and reordered
successful HTTP delivery, automatic retries/provider-API outage, interruption
before the native result is saved, and reinstall handling still need evidence. Commercial refund
settlement remains subject to D-008. See [final validation](final-validation.md).
Keep production purchases disabled until their gates pass. Rollback
is `COIN_PURCHASE_MODE=disabled`; retain the immutable ledger and receipt history.

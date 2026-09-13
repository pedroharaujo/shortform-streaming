# RevenueCat sandbox verification

**Scope:** P3-T04/P3-T06, D-036, related to issue #164. This implements server
verification, opt-in Android checkout and recovery of a known Google Play tester
transaction. Checkout defaults to disabled; genuine purchase evidence is still
required to complete the first journey.

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

The existing signed callback route accepts only the separate `test` mode. It is
disabled in `revenuecat_sandbox`; do not configure a genuine webhook to it yet.
Production Django settings reject both modes. No infrastructure secrets or live
provider configuration are created by this change.

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

Open Account → Coin wallet → Buy coins. Quantities come from the server registry;
prices remain the exact store strings. RevenueCat owns acknowledgement and
consumption; the app does not manually consume or call `syncPurchases()`. Native
success starts server verification, then refreshes the wallet. Only explicit
store cancellation or verified completion clears the saved attempt. An uncertain
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
match. This remaining resolution path and genuine callback/refund lifecycle are
follow-up engineering work; no production activation is implied.

Genuine tester purchase, acknowledgement/consumption, provider refund, restart
and reinstall evidence remain unchecked in [final validation](final-validation.md).
Keep checkout and production purchases disabled until their gates pass. Rollback
is `COIN_PURCHASE_MODE=disabled`; retain the immutable ledger and receipt history.

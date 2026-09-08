# Local synthetic purchase foundation

Issue #142, plan tasks P3-T03/P3-T04. No founder action is needed for local tests.
This slice funds the existing wallet from generated purchase events. It does not
complete native checkout, provider configuration, refund policy, support tooling
or production release approval. #142 remains open for those gates.

## Configuration and API

`COIN_PURCHASE_MODE` defaults to `disabled`; its only other value is `test`.
Fulfillment additionally requires DEBUG. Production settings reject test mode.
No cloud service or SDK is contacted. No live credentials or product values belong
in the repository or evidence. Runtime-generated authentication values appear only
inside tests, never in committed environment files.

`COIN_PURCHASE_PRODUCTS` is a JSON list of 1–32 explicit registry entries. Each
entry has exactly `app_id` (`synthetic_` prefix), `application_id`
(`test.synthetic.` prefix), `product_id` (`synthetic_` prefix), positive integer
`coins` at most 2147483647, `approval_reference` (`synthetic:` prefix),
`product_type=consumable`, `store=PLAY_STORE`, `environment=SANDBOX`,
`price_source=store`, `finance_owner_role=finance`, and `synthetic=true`.
Missing, duplicate, extra or wrong-scope entries fail startup in test mode.
Use generated registry fixtures in `backend/tests/commerce/builders.py` to run
tests; their 13 coins are test data, not an approved commercial pack.

An observed RevenueCat app ID is permanently bound to one Google application ID,
which cannot be adopted by a second RevenueCat app. Changes require future reviewed
reconciliation; replacing settings cannot rewrite that history. Coin quantities
may change only for subsequent new transactions; prior receipt snapshots persist.

`POST /v1/purchases/identity` authenticates the account with Firebase and retains
App Check when enforced. It accepts no fields and returns only `app_user_id`, an
unpredictable server UUID permanently bound to the opaque wallet. It never returns
Firebase UID. Account deletion detaches the wallet; a replacement account receives
a distinct purchase identity and cannot adopt old accounting.

`POST /v1/purchases/revenuecat` is provider-owned and excluded from the mobile SDK
OpenAPI surface. Its exact method/path is exempt from App Check and requires both
`COIN_PURCHASE_AUTHORIZATION` and `COIN_PURCHASE_SIGNING_SECRET` (each 32–256 ASCII
characters, provided privately at runtime). Authorization is compared in constant
time. `X-RevenueCat-Webhook-Signature` must be
`t=<unix-seconds>,v1=<lowercase-hex-HMAC-SHA256>` over the timestamp, period, and exact
raw JSON bytes. The signature may differ from server time by at most 300 seconds.
The body is bounded at 32768 bytes, Authorization at 256 characters and signature
at 128. Duplicate JSON keys and nonstandard numeric constants are rejected.

Required normalized fields are version `1.0`, event ID, app, store, environment,
product, app-user identity, event type, transaction ID, and nonnegative bounded
integer `event_timestamp_ms`/`purchased_at_ms`. Historical payload timestamps are
allowed: retries use a fresh signature timestamp with unchanged purchase facts.
Unknown JSON fields are ignored and never stored. No raw event bodies, receipts,
tokens, attributes, transaction IDs, Firebase UIDs, or authorization headers are
stored in commerce receipts or application logs. Hashed identifiers and opaque
wallet identities remain pseudonymous financial records, subject to D-020 review.

## Accounting, retry and quarantine

Only `NON_RENEWING_PURCHASE`, exact known Android sandbox consumable scope,
single-unit quantity (absent or integer 1), and an active server-owned identity
can credit. Aliases may be empty or contain only that exact identity, and original
identity must match when supplied. Unknown, transferred, deleted, pending,
subscription and ambiguous states quarantine or reject before credit.

The store transaction identity is Google application + store + environment +
transaction fingerprint; event identity is separately tracked. Unknown-app
transaction barriers remain effective if configuration later recognizes that app.
Advisory locks serialize event IDs, application mappings and transaction IDs;
account lifecycle and wallet locks then serialize deletion and financial writes.
Credit, immutable decision and event receipt commit together. Unique constraints
and a matching-credit database guard prevent receipt reuse or history mutation.

Successful processing returns HTTP 200 with only `support_reference`, `status`
(`credited` or `quarantined`), and a fixed safe `reason`. A quarantine acknowledges
durable unresolved handling, not a successful wallet credit. Authentic retries
return the same event receipt; a different event for a credited transaction never
credits again. Invalid authentication/JSON returns a generic non-200, disabled
mode returns 409, and database failures return 500 so the provider can retry.

Cancellation/refund before purchase blocks later credit. After credit it appends
an unresolved quarantine event and leaves accounting unchanged. No refund-after-
spend rule, compensation or negative balance is introduced. There is no support
resolution/override API. Do not clear quarantine or edit rows to force fulfillment.

## Remaining release gates

- Native RevenueCat configuration, server identity binding before checkout, store
  localized offering/price display and interrupted-purchase recovery.
- Genuine provider HMAC/authorization, retry, alias, sandbox purchase/cancellation,
  refund and reconciliation evidence with redacted references, and secret rotation.
- Native SDK acknowledgement and consumption ownership; Django does neither.
- D-008 approved refund-after-spend rules and D-020 retention/deletion/finance access.
- Android provider/store/account checks and consolidated P6-T03 final validation.

Production remains disabled throughout these gates. Local tests cannot substitute
for provider observations or approve prices and business policy.

## Local verification evidence, 2026-09-08

The disposable local PostgreSQL suite uses only generated data and
`PYTEST_ADDOPTS=-p no:cacheprovider`.

- `pnpm backend:lint` — passed.
- `pnpm backend:format:check` — passed, 211 files formatted.
- `pnpm backend:typecheck` — passed, 208 source files.
- `pnpm backend:migrations:check` — passed, no migration drift.
- `pnpm backend:test` — 479 passed in 85.00 seconds. Includes matching-credit and
  immutable binding/history guards, duplicate/different-delivery transaction races,
  rollback/retry, deletion race, app remapping, unknown-app cancellation barriers,
  additive migration/legacy writer compatibility, authentication and privacy.
- `pnpm contract:generate` — regenerated OpenAPI and TypeScript together. Root
  independently passed `pnpm contract:check` with the final artifacts staged.

Independent financial/security review identified and corrected the application
namespace issue: the RevenueCat app ID cannot become a second credit namespace
for the same Google application transaction. Review completion is recorded in the
PR; the provider/native release gates above remain open.

Primary provider references: [webhook signatures and retry behavior](https://www.revenuecat.com/docs/integrations/webhooks),
[event contract](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
[identity behavior](https://www.revenuecat.com/docs/customers/identifying-customers),
[native purchase ownership](https://www.revenuecat.com/docs/getting-started/making-purchases).

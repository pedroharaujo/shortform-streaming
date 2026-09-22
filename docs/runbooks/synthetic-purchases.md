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

## Purchase synchronization reads (P3-T06 prerequisite, #142)

Both POST endpoints require Firebase authentication and retain App Check when
enforced. They operate only in local DEBUG + synthetic purchase mode, accept exact
bounded JSON fields, and return `Cache-Control: no-store`. They never create a
wallet, purchase identity, credit, debit, entitlement or provider request.

`POST /v1/purchases/catalog` accepts only `application_id`. The result contains
`products`, each with `product_id`, `coins`, `product_type=consumable`,
`store=PLAY_STORE`, `environment=SANDBOX` and `price_source=store`. The bounded
registry supplies quantities; no monetary price or approval reference is returned.
Unknown applications and conflicting persisted provider/application bindings
return 409. The native follow-up must match these IDs to store offerings and show
the exact store-localized price string. This API does not approve commercial packs.

`POST /v1/purchases/status` accepts only `application_id`, `product_id` and
`transaction_id`. Send the transaction in the JSON body, never a URL, logs or
analytics. It is hashed transiently using the same permanent Google application /
store / environment namespace as fulfillment; the raw identifier is not retained.
The response has exactly `status`, `historical_credited_coins` and nullable
`support_reference` (the immutable decision UUID, not a provider callback event UUID).

- `awaiting_verification`: zero historical coins and null reference. Missing,
  foreign, mismatched and unattributed quarantined transactions look identical.
  This does not prove a charge failed, was cancelled, or can safely be repeated.
- `credited`: this exact product/transaction has an immutable credit owned by the
  current account. Quantity remains the original snapshot even after a registry
  reprice/removal; current configuration cannot rewrite financial history.
- `review_required`: an owned historical credit has at least one quarantined
  delivery (including refund/conflict). The original credited quantity remains
  visible; no compensation or refund resolution is implied. A later successful
  retry cannot clear this state. Follow-up support tooling must resolve it under
  approved policy, never by editing ledger or receipt history.

All results are observations at read time. Historical credit is not current wallet
balance, final settlement, episode access or playable media. Refresh the existing
wallet endpoint and obtain fresh access/playback authorization separately. Retain
unresolved checkout recovery account-scoped; client success and balance changes
cannot manufacture a verified purchase. Recreated accounts cannot adopt a deleted
account's history, even when the Firebase UID is reused.

Rollback: remove the new routes/client usage or keep purchase mode disabled. No
migration or data rewrite is needed. Old identity/callback/wallet contracts remain
compatible. Native checkout/UI and genuine provider synchronization remain #142;
these read APIs alone do not complete P3-T03/P3-T06.

## Recent verified purchase history (P3-T06 / #142)

`GET /v1/purchases/history` needs no store transaction ID or caller-selected
account. It returns the current account's newest 20 credited decisions in stable
descending recorded-time/reference order and a `has_more` flag. Each row contains
only the server recorded time, original credited coins, safe support reference
and `credited` or `review_required` status. Quarantined-only and unattributed
transactions are absent; absence does not prove that a charge failed. Any later
quarantined event on an owned credit keeps that row in review after retries.

The read retains Firebase authentication, App Check, current-profile locking and
the local synthetic-mode gate. It does not create financial state or depend on
the current product registry. Deleted/recreated accounts cannot inherit detached
history. No response caching, raw provider fields, monetary prices, local purchase
storage, restored consumables or financial writes are introduced. Current balance
and access remain separate server reads.

Android exposes this bounded list from Coin wallet → Recent purchases, with
refresh and foreground reload, session invalidation, safe support references and
an explicit latest-20 notice when truncated. This is verified-credit visibility
after reinstall or another-device login; it does not recover an unverified native
checkout or resolve a refund. Native checkout remains the next task in #142.

## Dormant checkout coordinator (P3-T03/T06 / #142)

The mobile checkout boundary uses the existing generated identity, catalog and
status contracts plus injected synthetic provider/storage implementations. Its
shipped factory returns unavailable before constructing dependencies. Wallet
checkout remains unavailable; no SDK, route or store configuration is added.

The coordinator binds the server purchase identity before reading provider offers,
matches application/product/store/environment and preserves the exact localized
price string. A selected price or quantity change returns refreshed offers for
another explicit confirmation. One process-wide operation excludes concurrent
checkout across coordinators and accounts. Any session replacement invalidates
the original controller, including replacement with the same credential.

Before checkout, a serialized SecureStore write saves a strict versioned marker
with server identity, synthetic application/product and random attempt UUID. A
read/write/corruption error blocks checkout. An unresolved marker cannot be
replaced; cleanup compares the entire attempt under the same queue. Only explicit
matching cancellation or matching server credit can clear it. Pending, errors,
ambiguous responses and refund/conflict review preserve it.

A completed provider result only initiates an authenticated server status read.
Raw transaction IDs stay in memory for that exact owner/attempt and in the POST
body; public state, storage, logs and analytics contain none. Historical credited
quantity and support reference come from the server; current wallet is refreshed
separately. A wallet outage does not erase historical confirmation.

After process loss, the remaining marker prevents another charge but cannot yet
be automatically reconciled without its transaction ID. Recent purchase history
does not provide exact attempt correlation and cannot prove cancellation. Genuine
provider correlation, acknowledgement/consumption ownership and account-deletion
integration must be validated before introducing real checkout. The synthetic
provider contract is not evidence of RevenueCat or Google compatibility.

## Remaining release gates

- Native RevenueCat configuration and genuine adapter for the dormant identity,
  store-localized offering/price and interruption boundary, plus complete recovery.
- Genuine provider HMAC/authorization, retry, alias, sandbox purchase/cancellation,
  refund and reconciliation evidence with redacted references, and secret rotation.
- Native SDK acknowledgement and consumption ownership; Django does neither.
- D-008 approved refund-after-spend rules and D-020 retention/deletion/finance access.
- Android provider/store/account checks and consolidated P6-T03 final validation.

Production remains disabled throughout these gates. Local tests cannot substitute
for provider observations or approve prices and business policy.

## Dormant checkout verification, 2026-09-09

Frozen implementation `71ea35ddaf165e4d3f24fb591496caf4ddca6b78`, based on
`77f2812`, uses only generated synthetic transport/provider/storage fixtures.
The following commands ran from `mobile/` against installed dependencies:

- `node ../node_modules/jest/bin/jest.js --ci --runInBand src/features/purchases src/api/createAppClients.test.ts`
  — **88 tests / 3 suites passed**.
- `node ../node_modules/jest/bin/jest.js --ci --runInBand`
  — **359 tests / 42 suites passed**.
- `node ../node_modules/typescript/bin/tsc --noEmit` — passed.
- `node ../node_modules/eslint/bin/eslint.js .` — passed.
- `node ../node_modules/prettier/bin/prettier.cjs --check .` — passed.
- `node scripts/check-expo-config.mjs` — passed.
- `node scripts/check-expo-bundle.mjs` — Android production JavaScript bundle
  passed; no native compile or EAS invocation.

Lint's import resolver and the installed Hermes compiler required the same checks
to run outside the filesystem sandbox; no source workaround was introduced.
Tests first reproduced malformed UUID acceptance, queued marker mutation, thrown
synchronization and a session replacement at the final promise continuation. The
fixes retain uncertainty and suppress stale public results. Core coverage also
includes price reconfirmation, global exclusion, persist-before-purchase, storage
corruption/CAS, explicit cancellation, historical server credit, review, wallet
outage and restart blocking. Independent review/validation and CI are recorded in
the pull request. Native/provider acceptance remains pending, never inferred.

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

## Purchase synchronization verification, 2026-09-08

On `codex/p3-t06-purchase-sync`, based on main `ae95d8f`, tests used a disposable
PostgreSQL 17.6 container bound only to loopback port 55436, with generated data.
`DATABASE_URL=postgresql://shortform@127.0.0.1:55436/shortform` and
`PYTEST_ADDOPTS=-p no:cacheprovider` selected it; no private environment file was loaded.

- `uv run pytest backend/tests/commerce/test_purchase_sync.py -q`: initially
  failed on the absent endpoints; final **30 passed**. Independent review found
  a registry/request identifier mismatch; the added regression failed before the
  fix and then passed. Reviewer confirmed no remaining findings.
- `pnpm check`: **passed**. Includes repository safety scan, 50 repository tests,
  governance, backend lint/format/types/migration drift, **521 backend tests**,
  regenerated OpenAPI/TypeScript consistency, mobile lint/format/types,
  **38 suites / 232 mobile tests**, and Expo configuration checks.
- The aggregate mobile run recovered from a Windows `realpath` warning. Follow-up
  `pnpm --filter @shortform/mobile test --runInBand src/features/catalog/EpisodeSelectedScreen.test.tsx src/features/rewards/RewardScreen.test.tsx`
  passed **2 suites / 30 tests** without that warning.
- `git diff --check` and `git diff --cached --check`: passed.

No migration, new dependency, provider/native activation or mobile UI change.
The deferred native/provider sequence is in `final-validation.md`; these checks
establish the server-read slice only. The full P3-T06 and #142 remain open.

GitHub subsequently rejected main's existing Expo patch versions. Separate PR
#152 aligns Expo/Router and passes all 21 Expo doctor checks, 232 mobile tests and
the Android JavaScript bundle check. The founder merged #152 as `c4a6e8d`.
Purchase PR #151 subsequently merged as `dbad575` after independent review and
validation, with its server implementation unchanged.

## Recent purchase history verification, 2026-09-09

P3-T06 / #142 adds the bounded read and Android history screen described above.
The backend implementation is `fe6aeb1`; the mobile implementation is `85f1ef7`.
Tests used generated data in disposable PostgreSQL 17.6 on loopback port 55436,
with `DATABASE_URL=postgresql://shortform@127.0.0.1:55436/shortform` and
`PYTEST_ADDOPTS=-p no:cacheprovider`.

- `uv run pytest backend/tests/commerce/test_purchase_history.py -q` — **19 passed**,
  after an initial failing run against the absent route. Covers no financial
  writes, owner isolation, deletion, historical quantity after spending/registry
  edits, persistent quarantine, ordering/limits, authentication and disabled modes.
- `uv run pytest backend/tests/commerce -q` — **110 passed**.
- `pnpm backend:check` — **540 passed**; lint, formatting (218 files), types
  (214 source files) and migration drift passed.
- `pnpm contract:check` — passed with generated OpenAPI and TypeScript committed.
- `python scripts/check_repository_foundation.py` — **50 passed**, plus safety and
  AI governance validation.

Mobile checks used the installed entry points from `mobile/` to avoid a local
pnpm automatic-reinstall conflict; no dependency or lockfile change was needed:

- `node ../node_modules/jest/bin/jest.js --ci --runInBand` — **275 passed / 40 suites**.
  The new screen integration covers strict responses, safe text, foreground/refresh,
  session changes and stale results; separate tests cover app attestation and
  episode-preserving navigation at their distinct boundaries.
- `node ../node_modules/eslint/bin/eslint.js .` — passed.
- `node ../node_modules/prettier/bin/prettier.cjs --check .` — passed.
- `node ../node_modules/typescript/bin/tsc --noEmit` — passed.
- `node scripts/check-expo-config.mjs` — passed.
- `node scripts/check-expo-bundle.mjs` — passed, Android production JS/Hermes only.

Initial sandbox denials for lint's parent-directory resolution and Hermes compiler
execution were resolved by rerunning those checks with authorized local access.
The native attempt did not obtain a screen result; the emulator issue and exact
D-029 repeat sequence are recorded in `final-validation.md`. It is not a native
compile, Google purchase, reinstall or provider-lifecycle pass. Full P3-T06 and
#142 remain open. Final independent review, validator and CI outcomes are recorded
in the pull request before merge.

# Coin wallet and episode unlock (P3-T02)

This is the backend prerequisite for the Android coin purchase screens. Google
Play/RevenueCat purchase verification and credits, commercial refund rules, the
coin-pack screen and coin/ad offer selection remain P3-T03/T04/T06/P3-T08-F2.
No real coin purchase, financial processing or production spending is enabled.

## Available behavior

- `GET /v1/wallet`: authenticated owner's ledger-derived integer balance and
  `spending_available`. A new account has zero coins. No account selector/history.
- `POST /v1/coins/unlock`: requires episode public ID, request UUID, and exact
  policy version/coin price from the current server offer. Returns request and
  episode IDs, charged coins and current balance. No media URL or store receipt.
- Repeat the same request after a lost response. Its account, episode, version
  and price must match. An existing valid grant or newly free episode never
  charges again. Removed entitlements are not silently restored by replay.
- Eligibility precedes access, including on retries. Rights/takedown/expiry
  denial returns 404, while stale offer, insufficient funds, disabled spending
  or request reuse conflict returns 409. Authentication failure is 401. Responses
  containing a balance use `Cache-Control: no-store`.

The frontend must still request fresh playback authorization after success.
Server coins, grants and verified purchases remain authoritative; client success
and analytics never credit an account. No public credit route exists.

## Disabled by default

`COIN_SPENDING_MODE=disabled` is the default in every environment. Synthetic local
spending requires both `COIN_SPENDING_MODE=test` and `DEBUG=True`. Production
settings reject every value except `disabled`; a future production activation
requires a reviewed code/config change after store, rights, financial, privacy
and release gates. Existing test funding is generated only inside test fixtures.
There is no Admin wallet funding or financial adjustment interface.

## Integrity, access and deletion

The account identity lock coordinates authentication, deletion, rewards and coin
commands. Unlocks then lock the series, episode and wallet, recheck eligibility,
and commit debit, immutable receipt and entitlement in one transaction. The
database serializes ledger inserts and rejects overdrafts, unsafe integer totals,
duplicate accounting references, invalid amount signs, incompatible debit/receipt
links, and updates/deletes of accounting history. Tests cover concurrent inserts
under READ COMMITTED and REPEATABLE READ.

Amounts are integer coins. This slice stores no monetary amount, exchange rate or
commercial pack price. Account identifiers are not accepted in either API. Wallet
and ledger models are not registered in Admin. Staff cannot manufacture, edit or
delete coin entitlements through the generic grant UI; manual grants share the
account/catalog locks. Database-level access remains restricted engineering
access, not a support workflow. Corrections must use future reviewed compensating
entries, never edits to history.

Account deletion removes the profile and entitlements and detaches the wallet's
profile link. It retains the wallet UUID and immutable accounting/receipt facts;
these have no Firebase UID or copied profile ID and are never reattached to a new
account. Catalog deletion also cannot cascade this financial history away. The
remaining opaque wallet, episode, request and reference identifiers are restricted
accounting data, not a claim of anonymization. No legal retention duration is
invented: D-020 must approve fields, access, periods, deletion propagation and
late-event identity handling before real financial processing.

## Validation

Use an isolated PostgreSQL database and generated fixtures. Example PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://shortform@127.0.0.1:55432/shortform'
uv run pytest backend/tests/wallet backend/tests/entitlements/test_admin_coin_safety.py -q -p no:cacheprovider
pnpm check
pnpm mobile:bundle:check
```

The focused suite covers duplicate and competing requests, stale prices, current
licensed rights, expiry while waiting for catalog/wallet access, failed grant
rollback, deleted account races, retained history, immutable rows and safe Admin
behavior. Production settings tests reject activation. OpenAPI and the generated
TypeScript schema include wallet routes and coin method/source values together.
These automated financial safeguards are immediate checks and are not deferred.

Native Google tester purchase/refund, real provider events, mobile coin UI and
production retention validation are not claimed here. Their existing P3/P6 gates
remain prerequisites for real money and public release.

## Deployment and rollback

Apply the additive entitlement choice and wallet migrations before the new
backend. Keep the mode disabled. There are no historical balance rewrites or
destructive data migrations. Roll back application traffic/code with commerce
disabled while retaining the tables and history; do not reverse wallet migrations
or remove their immutability guards after accounting records exist. Any future
contraction/retention deletion requires its own reviewed migration and policy.

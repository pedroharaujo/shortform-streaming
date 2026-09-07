# P3-T02: Coin wallet and atomic episode unlock

Implements the approved P3-T02/ADR 0006 architecture after P3-T01-F1. The founder
requested the next implementation steps. Routine sequencing follows AGENTS.md:
deliver the backend prerequisite first, then the store integration and mobile
purchase/offer surfaces in their existing follow-up tasks. No commercial decision
or production activation is implied.

## Boundary

Add a ledger-derived wallet balance and an authenticated, idempotent coin unlock.
Only local debug configuration can enable synthetic coin spending. Default and
production configurations keep it disabled. No credit API, provider callback,
Admin balance editor, real product/pricing configuration, or refund policy is
introduced. Funding in tests uses generated ledger fixtures. P3-T03/T04/T06 own
verified Google Play/RevenueCat credits; P3-T08-F2 owns mobile purchase recovery
and the coin/ad choice. Financial integrity tests remain immediate merge gates.

## Records and privacy

Use a dedicated `wallet` Django app. `Wallet` has an opaque UUID and a nullable
one-to-one profile link with SET_NULL on deletion. `CoinLedgerEntry` stores signed
integer amount, kind (purchase, unlock, correction), globally unique internal
reference UUID, wallet, and timestamp. It holds no Firebase UID, provider receipt,
price, currency, or personal data. Positive purchase credits and negative unlocks
have database constraints. Corrections are additive signed entries; no correction
service or financial policy is enabled in this slice.

`CoinUnlock` records wallet-scoped request UUID, episode public ID, requested policy
version and price, charged amount, and nullable one-to-one ledger entry. Successful
free/already-owned requests record zero charge without creating a ledger entry.
Request reuse with a different episode/version/price conflicts. No catalog foreign
key can cascade financial history away. Ledger and unlock history reject database
UPDATE/DELETE. Ledger inserts serialize on the wallet row and reject a negative
total. Ordinary wallet deletion is protected by retained records. Account deletion
detaches the profile and leaves minimal inaccessible accounting records; retention
and lawful real financial processing remain D-020 release gates.

## Transaction and access

Use account identity advisory lock → fresh profile row → catalog series/episode
locks → wallet row → receipt/ledger/entitlement. Account deletion already uses the
identity lock. Revalidate availability after locks, including expiry while waiting.
The existing catalog locks serialize policy, rights and takedown writers.

GET `/v1/wallet` returns only the authenticated account's ledger-derived balance
and whether local synthetic spending is available. POST `/v1/coins/unlock` accepts
episode_id, request_id UUID, expected_policy_version and expected_coin_price. It
never accepts an owner, balance, credit or monetary value as authority. It returns
episode_id, request_id, charged_coins and current balance, without media URLs.
Both responses are no-store. Invalid credentials/deleted accounts fail 401;
ineligible content fails 404; disabled spending, stale offers, insufficient balance
or mismatched idempotency fail 409. Invalid input fails 400.

Eligibility always precedes existing entitlement or free access. Coin-only/both
episodes require the current policy version and price. Debit, receipt and permanent
coin entitlement commit together. An existing valid entitlement never charges.
Retries recheck current eligibility and account ownership and never debit again.
Add coin entitlement recognition to playback and synthetic coin offers only when
the local gate is on. Prevent generic entitlement Admin from manufacturing coin
grants or editing/deleting them; staff grant writers share account/catalog locking.

## Verification

PostgreSQL API/service tests cover exactly-once duplicate/concurrent unlock,
competing balance spend, rollback, stale policy/price, current rights/takedown,
expiry while waiting, existing grants, owner isolation, account deletion races,
retained immutable history, direct concurrent ledger inserts, and fail-closed
configuration. Migration tests exercise expansion with existing accounts and
entitlements. Update OpenAPI and generated TypeScript together. Run backend gates,
contract generation, repository safety and mobile type/tests after the additive
contract change. Independent review covers financial and authorization boundaries.

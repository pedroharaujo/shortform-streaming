# Android wallet and episode unlock choices

Task: P3-T08-F2, preparatory local/synthetic slice of issue #142.

## Scope and authority

Use the approved Android coin architecture in ADR 0006, the product brief and
P3-T02's merged wallet API. This slice brings the server balance and configured
episode choices into the app. It can be reviewed independently of the remaining
Google Play product and verified-credit integration (P3-T03/T04/T06). It does not
complete those tasks or all of P3-T08-F2. Production spending remains disabled by
the existing server gate; real purchases have no callable client integration.

The founder authorized implementation. Routine UI sequencing is an engineering
choice under AGENTS.md. D-008 prices/refunds, D-020 retention and live provider
setup remain unresolved; this change invents none of them.

## User experience

- Account opens a wallet showing the current server balance. Refresh on return,
  foreground and retry. Hide stale balances while loading or after a session change.
- The locked player opens episode choices. Display only server-returned methods.
  Ad selection enters the existing rewarded-ad flow; coin-only never starts ads.
- Show the exact coin price and an explicit confirmation before spending. Coins
  remain independent of ad consent. Insufficient balance leads to the wallet.
- Wallet copy clearly states that purchases are unavailable; no fake packs or
  commercial prices. The existing Android app styling and English message catalog
  supply all new copy and accessible controls.

## Transaction boundary

Persist the verified profile, episode, request UUID, policy version and expected
price in SecureStore before POST. Keys isolate profiles and episodes. Read or
write failures block spending. Preserve the original request through lost
responses/remounts; never silently retry at a changed price. Pending recovery is
explicit, including when the displayed balance has changed since the first send.

A session subscription hides old account state immediately. Check the original
session revision after every asynchronous boundary and before starting requests.
The bearer token, never a client-supplied owner, determines the server account.
Pending records contain no token, balance, provider payload or personal profile
attributes. Keep unresolved requests for same-account recovery; another account
cannot use them. Delete only the matching resolved request. Permanent account
deletion prevents reuse through server tombstones and a different new public ID;
device retention/cleanup remains part of D-020 before paid activation.

Validate response identity and charge before using it. Refresh the authoritative
wallet and current offers after a response, then freshly authorize playback.
Do not optimistically debit, grant playback or pass a media URL through navigation.
A first-send 400/404/409 rejection refreshes terms and requires a new confirmation.
An ambiguous network/server response retains the pending request. A subsequent
replay rejection cannot prove whether the earlier request committed: keep the
attempt, block replacement spending and show its safe support reference. Issue
[#144](https://github.com/pedroharaujo/shortform-streaming/issues/144) owns the
server-backed resolution protocol and support completion before live spending.
Do not clear a missing receipt without serializing against a delayed original
request. Existing backend idempotency and entitlement locks remain the financial
authority. Already-granted free/ad playback does not depend on wallet availability.
Pending ad grants still enter the existing status-only reward reconciliation.

## Verification and remaining gate

Screen-level tests cover method choices, confirmation, double taps, original-key
recovery, stale terms, storage failures, ownership changes and playback rejection.
Storage tests cover key isolation and compare-before-clear. Reuse backend financial
tests; do not duplicate them in client tests. Run mobile quality/config/bundle and
repository/API checks plus independent financial/privacy review. Native Android
visual, accessibility, interruption and provider testing remains an unchecked
P6-T03 gate under D-029 with spending and purchases disabled in production.

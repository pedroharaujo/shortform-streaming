# Declined Android test payment diagnosis

Scope: P3-T04/P3-T06, existing checkout issue #164, D-036 sandbox only.

Google Play's always-declining test card displayed its explicit rejection. After
dismissing it, Coins remained awaiting verification and blocked another purchase.
The native adapter only classifies explicit cancellation and product-unavailable
codes; other results become pending and their native code is discarded. The
observed code from this purchase is therefore unknown, and generic device logs
did not provide it. Five provider purchases and five ledger credits remain,
with balance 499. Absence of a sixth order is not general resolution evidence.

1. Capture only a whitelisted SDK enum from the native purchase catch in the
   development build. Temporary instrumentation is in `revenueCatProvider.ts`,
   guarded by `__DEV__`, with a single-line console lint exception. Never log the
   error object, messages, owner, order, token or other provider fields. Remove
   the instrumentation and its lint exception after reproduction.
2. A private one-off reset helper is prepared and dry-run checked for the exact
   current encrypted pending marker and unchanged 499/five-credit baseline. It
   requires explicit founder approval for this observed declined test, preserves
   the other secure entry, archives encrypted state privately, and never writes
   the ledger. It is not a product recovery implementation. The founder approved
   this one-off reset and it was applied: zero pending markers, one unchanged
   other secure entry, balance 499, five credits and the existing unlock intact.
3. After approval, repeat the no-charge declining-card test with the diagnostic.
   Do not infer a native code from the Play dialog or add broad error clearing.
4. Compare that code and its precise native source with RevenueCat Android
   10.20.0 / React Native 10.9.1 and Google's billing guidance. If evidence permits
   a definite-rejection fix, write a failing regression at the adapter/coordinator
   boundary, implement the narrow scoped behavior and obtain financial review.
   Unknown/network/store/ownership errors must remain protected.
5. Run mobile checks and a genuine device retest. Keep unknown-result recovery,
   refund policy and production activation gates open until separately resolved.

Diagnostic checkpoint: the two targeted adapter/coordinator suites passed 100
tests; typecheck passed. Initial lint correctly rejected console output; the
temporary enum-only diagnostic exception is narrow and must be removed.

The native inspector captured cancellation enum `1` when engineering backed out
of an unsubmitted checkout. Coins displayed cancellation feedback and removed
that attempt's marker through the normal purchase flow. This proves the error
capture path is active; it does not identify the earlier decline. The listener
now excludes buffered console events from before attachment so the next attempt
cannot be confused with that cancellation. No raw diagnostic events are stored.

## Captured cause and narrow fix

The next founder-submitted always-declines test displayed Play's rejection.
After dismissal the native inspector captured enum `3`
(`PURCHASE_NOT_ALLOWED_ERROR`), and the old adapter returned pending. Server
accounting remained 499 coins, five credits and the existing one-coin unlock.

The adapter now projects `purchase_not_allowed` only from the native purchase
catch, after the existing session and identity checks. The coordinator accepts
only the exact scoped result and clears only its active attempt. Coins shows
payment/account guidance and Reload coin packs. Unknown/store/network errors,
ownership changes, post-purchase identity errors and contradictory payloads
remain pending. Temporary diagnostic output and lint exceptions were removed.

Independent review found no blocking issue in the change. It checked native
Android 10.20.0: consumption/acknowledgement errors are not dispatched to the
purchase callback; post-transaction product lookup errors still post receipts;
backend receipt-error mapping does not yield code 3. Recheck on SDK upgrades.
References:
- [BillingWrapper consumption/acknowledgement](https://github.com/RevenueCat/purchases-android/blob/10.20.0/purchases/src/main/kotlin/com/revenuecat/purchases/google/BillingWrapper.kt#L479)
- [PostReceiptHelper success callback](https://github.com/RevenueCat/purchases-android/blob/10.20.0/purchases/src/main/kotlin/com/revenuecat/purchases/PostReceiptHelper.kt#L120)
- [Backend error mappings](https://github.com/RevenueCat/purchases-android/blob/10.20.0/purchases/src/main/kotlin/com/revenuecat/purchases/common/errors.kt#L90)
- [Post-transaction product lookup](https://github.com/RevenueCat/purchases-android/blob/10.20.0/purchases/src/main/kotlin/com/revenuecat/purchases/PostTransactionWithProductDetailsHelper.kt#L92)

Verification:
- `pnpm --filter @shortform/mobile test --runInBand revenueCatProvider.test.ts checkoutCoordinator.test.ts`: first failed the two new rejection expectations as intended; after the fix, 115 passed.
- `pnpm --filter @shortform/mobile test --runInBand`: 50 suites, 510 tests passed.
- `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:config:check`, `pnpm contract:check`: passed.

Device retest remains required. The diagnostic attempt predates the fix and its
marker remains unresolved on disk; the new code does not retroactively clear it.
A separate private helper/checkpoint was prepared and dry-run checked against
the captured code-3 attempt, preserving prior backups. Applying this one-off
reset required fresh founder approval. The founder subsequently approved it;
the guarded reset was applied with a separate private encrypted backup. No
pending marker remains, the other secure entry is unchanged, and accounting
still shows 499 coins, five purchase credits and one unlock/entitlement. It is
not general recovery logic. The fixed build's genuine decline retest is pending.

Sources: [RevenueCat errors](https://www.revenuecat.com/docs/test-and-launch/errors),
[Google billing responses](https://developer.android.com/google/play/billing/errors),
and the installed SDK's version-matched Maven source archive.

## Final device result — passed

The founder completed the final no-charge declining-card retest. Read-only
inspection then observed the fixed Coins message: Google Play did not allow the
purchase, with payment/account guidance and Reload coin packs available. Secure
storage contained zero pending purchase markers and its other entry remained.
Server accounting remained 499 coins, five purchase credits and the existing
one-coin debit/unlock/entitlement. This closes the observed declined-payment
recovery defect. No additional purchase was initiated to record this result.

The founder explicitly requested moving on from repeated testing. Do not repeat
this scenario or expand its implementation without a new failure or relevant
code/SDK change. Other lifecycle and production gates remain separate.

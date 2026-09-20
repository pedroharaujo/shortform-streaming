# Definite store rejection handling

Scope: P3-T04/P3-T06, issue #164, isolated D-036 Android sandbox.

The first checkout reached Google's item-not-found dialog. Tester enrollment is
now accepted, but the adapter converted the rejection into an unresolved attempt.
Do not infer the lost SDK error code from this dialog or erase the existing marker.

1. Reproduce the adapter/coordinator error path in regression tests. Recognize
   only the SDK's explicit product-unavailable result from the native purchase
   call, with the same authenticated owner still current.
2. Return a distinct, retryable product-unavailable state. Clear only that scoped
   active attempt; retain markers for unknown/network/store/pending/ownership
   errors, contradictory payloads, and errors after a completed native result.
   Keep server verification, ledger, package values and prices unchanged.
3. Run targeted tests, mobile static checks and contract checks; review the diff.
   Verify the existing attempt remains protected on device. Resolving its lost
   result requires separate evidence/explicit sandbox intervention; this patch
   does not claim general unknown-result recovery or production readiness.

Reference: RevenueCat's error-handling documentation distinguishes definite
purchase failures from store problems with uncertain charge outcomes:
https://www.revenuecat.com/docs/test-and-launch/errors

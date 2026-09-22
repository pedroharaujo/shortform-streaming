# Android test coin checkout

Issue #164; P3-T03/P3-T04/P3-T06; accepted ADR 0006 and founder decision D-036.

Build the next part of the approved hands-on Android journey: open coin packs
from the wallet, see Google's localized prices, purchase through RevenueCat,
wait for the existing server verifier, and return to the locked episode. No new
commercial prices, coin quantities, production purchases or refund policy are approved.

Use react-native-purchases 10.9.1. Configure only with the authenticated backend
purchase UUID; suppress provider logs and automatic identifier collection. A
local development flag and a public Android SDK identifier enable the adapter;
missing configuration remains disabled, including in older installed clients.
Staging, production and non-Android runtimes cannot enable this checkout. A
Google Play license tester and test-card purchase sheet must be confirmed before
enabling local checkout: a debug build alone does not prevent real charges.

The server product registry supplies quantities and approved product IDs. The
store supplies unchanged display price strings. The native purchase result only
starts server synchronization; it never grants coins. Retain session revision,
provider identity, process-wide purchase serialization, exact cancellation and
secure pending-attempt checks. Never persist or log raw order IDs, tokens,
receipts, CustomerInfo or provider responses.

Known-result restart recovery stores a SHA-256 fingerprint, bound to the saved
owner/app/product/attempt, instead of the Google order ID. The digest input is
UTF-8 JSON.stringify(["shortform-purchase-v1", ownerId, applicationId, productId,
transactionId]) (compact JSON, all identifiers restricted to ASCII). The new
authenticated recovery endpoint enumerates a bounded complete purchase list for
that owner, requires one exact fingerprint match, then calls the existing full
provider verification and idempotent fulfillment. Incomplete, ambiguous, foreign
or invalid evidence cannot clear a marker or credit coins. Version-1 synthetic
markers remain readable and blocking; native markers use version 2.

If the process dies before the order fingerprint can be saved, the attempt stays
pending and blocks another charge. Do not infer its identity from purchase
history differences, wallet balance or elapsed time. React Native CustomerInfo
history identifiers are RevenueCat IDs, not the Google order ID. Genuine webhook
activation, unknown-attempt resolution and production refund handling remain
follow-ups, with disabled production capability and D-029 validation records.

Validate authorization, exact correlation, duplicate credit prevention, session
switches, cancellation, pending restart, public configuration and native Android
build. Provider/device outcomes remain unchecked until actually observed.

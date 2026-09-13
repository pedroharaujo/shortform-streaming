# Sandbox purchase notifications

Issue #169; P3-T04; accepted ADR 0006 and founder decision D-036.

An approved Google Play test purchase must be able to reach the server wallet
while the Android app is closed. Add a separately enabled local sandbox branch
to the existing RevenueCat callback route. The default remains disabled;
production settings continue to forbid commerce activation. No new pack prices,
refund policy, public infrastructure or personal-data retention is approved.

Reuse the existing bounded exact-body Authorization and HMAC authentication.
RevenueCat documents `X-RevenueCat-Webhook-Signature` with timestamp and SHA-256
signature over timestamp plus raw body, and generates a fresh signature on each
retry. Require both configured protections. Preserve the five-minute signature
window without using the original event timestamp as a freshness gate.

For NON_RENEWING_PURCHASE notifications, require approved sandbox app, package,
product, store, quantity and the existing server purchase identity. Read fresh
RevenueCat v2 purchase/product facts outside database locks. Only an exact match
of transaction, owner/original owner, app/product, environment, quantity and
purchase time with owned state permits the original normalized callback event
to enter existing idempotent fulfillment. Its provider event ID remains the
delivery key. Missing or unavailable verification returns a generic retryable
503 and does not create a positive decision. Fresh refunded state creates review
instead of credit. Aliases, unknown/deleted users and unsupported scope cannot
grant; normalized authenticated conflicts can use existing quarantine paths.

A signed CANCELLATION notification immediately enters the existing quarantine
path, including when a provider read would still say owned or be unavailable.
This prevents a delayed purchase from granting after a refund notification.
Already credited transactions remain in review without a debit, negative balance
or entitlement mutation. A repeated original purchase cannot erase that review.
Authenticated TEST and unsupported event shapes may receive a generic ignored
acknowledgement without financial mutations; TRANSFER never reassigns ownership.

Accept new provider fields without persisting them. Enforce strict JSON, body
and identifier bounds. Never log or store raw payloads, credentials, receipt or
order identifiers, provider errors or subscriber attributes. Return only a
generic acknowledgement or safe normalized support reference. Neither mobile
checkout state nor unknown local attempts are changed by this backend slice.

Financial tests must prove duplicate/concurrent delivery and sync produce one
credit, refunds remain barriers in either order, unavailable provider evidence
is retryable, and all authentication/identity/scope/configuration gates hold.
Genuine dashboard delivery remains an explicit D-029 release blocker until the
provider accounts and approved callback route exist; no automated financial or
privacy test is deferred.

Sources checked 2026-09-13:
- https://www.revenuecat.com/docs/integrations/webhooks
- https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields

Follow-ups: account-wide missing-credit reconciliation, unknown-attempt user
flow, full production lifecycle/refund policy and approved public callback edge.

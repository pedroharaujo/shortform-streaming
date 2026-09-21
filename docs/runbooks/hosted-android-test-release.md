# Hosted Android test release

Tracking: [#121](https://github.com/pedroharaujo/stovio/issues/121),
[#164](https://github.com/pedroharaujo/stovio/issues/164), P5-T05-F4.

## Purpose and current status

Prepare the existing app to run without Metro, the local Django server or a
temporary callback tunnel. The founder selected the generated Cloud Run HTTPS
address on 2026-09-21 and authorized preparation. This is an Android license-tester
release, not a public paid launch. No new infrastructure, provider configuration,
Google terms, real payments or spending is authorized by this document.

The code keeps the existing private service for staff. An optional second service
runs the same image with `config.settings.hosted_sandbox`, DEBUG off, verified
Firebase identity and consumer-only routes. `/admin/` and `/internal/staff-masters/1`
return 404. Production settings still reject coin purchases and spending. Synthetic
purchases remain local-only. The hosted mode accepts only verified Android SANDBOX
products and uses existing coin accounting, ownership checks and recovery.

The public origin can receive RevenueCat's signed notifications directly at
`/v1/purchases/revenuecat`. Both the configured Authorization header and
`X-RevenueCat-Webhook-Signature` remain required. Preserve the provider's HMAC
signing configuration; no signing bridge is needed. The callback is exempt from
App Check, not from purchase authentication. See [RevenueCat signing](https://www.revenuecat.com/docs/integrations/webhooks).

## Smallest proposed topology and cost

- Existing Firebase, Supabase, private Cloud Run service, image registry and
  deployment workflow remain in place.
- One opt-in consumer service: request-based billing, 1 vCPU / 512 MiB per
  instance, minimum zero, proposed maximum two per revision, concurrency eight, 60-second
  request timeout. The input requires an explicit choice of one to three instances.
- A dedicated consumer identity reads only the configured numeric secret versions.
  It has no staff upload bucket grant. A custom role in the configured Firebase
  project grants only `firebaseauth.users.get` for revoked-token verification and
  `firebaseauth.users.delete` for authenticated account deletion.
- No domain, DNS zone, load balancer, Cloud Armor subscription, queue or new database.

Cloud Run's generated address provides HTTPS and Google frontend DoS protections.
It does **not** provide the configurable Cloud Armor rules proposed in #121;
application throttles are not equivalent distributed abuse protection. That issue
remains open; direct public tester activation requires accepting this limited scope.
[Google security model](https://docs.cloud.google.com/run/docs/securing/security).

Scale-to-zero avoids provisioned idle capacity but is not a promise of a zero bill.
Compute, requests, internet transfer, image storage, secrets and logging can incur
usage charges. The instance maximum is a capacity control, not a spending cap,
and Cloud Run can briefly exceed it. Candidate/previous revisions can overlap,
so the total service can exceed the per-revision limit during rollout. The pinned
Google provider does not support a service-wide maximum field. Existing database
and video bills are separate.
Before activation, record the founder's monthly testing budget, alert recipient,
selected capacity and pricing estimate for the anticipated testing traffic.
No traffic forecast or budget has been supplied, so no total monthly price is
claimed here. [Cloud Run pricing](https://cloud.google.com/run/pricing),
[instance limits](https://docs.cloud.google.com/run/docs/configuring/max-instances).

## Activation order — engineering work after approval

1. Merge the reviewed PR only on the founder's instruction. Existing staging CI
   remains unchanged while `HOSTED_SANDBOX_SERVICE` is empty and `hosted_sandbox`
   is null. Record the successful image digest from that deployment.
2. Review the private saved infrastructure plan. Populate `hosted_sandbox` in the
   ignored staging variables with a distinct service name, the new image digest,
   explicit maximum, the existing RevenueCat project and secret **names/versions**.
   Start with `public_access = false`. Do not put secret values into OpenTofu.
   No production database may be used for this sandbox.
3. Provision any missing Secret Manager containers and upload approved existing
   sandbox values using private files. The service needs `DJANGO_SECRET_KEY`,
   `DATABASE_URL`, `COIN_PURCHASE_PRODUCTS`, `COIN_PURCHASE_AUTHORIZATION`,
   `COIN_PURCHASE_SIGNING_SECRET`, `REVENUECAT_API_KEY`. When Bunny is enabled,
   also supply its API/token secret references and existing library/CDN settings.
   The infrastructure binds access but does not create secret containers/versions.
   Preserve all existing package amounts, prices and registry bindings.
4. Obtain approval for the exact plan/cost, then apply the private bootstrap.
   Verify IAM, settings, secret versions, database isolation and the image digest.
   The new image must include hosted settings; never bootstrap with an old image
   or a placeholder server. No image contains secrets.
5. Set the GitHub **staging** variable `HOSTED_SANDBOX_SERVICE` from the output.
   Run the existing staging workflow. It checks both candidates before either
   promotion; the consumer check verifies health, staff exclusion and rejection
   of unsigned callback requests. It uses the existing isolated smoke job with
   only invocation credentials, not application/provider credentials.
6. Complete Firebase App Check setup using the existing Android app and release
   signing certificate. Any outstanding provider terms need founder action.
   Confirm real Play Integrity evidence; mock tests cannot establish this. Setting
   App Check on shared staging inputs also affects the private service's consumer
   APIs; it does not affect staff pages. Public opt-in rejects disabled App Check.
7. Review the activation-only plan (`public_access = true`, App Check enforced).
   After approval, apply it and immediately run the staging workflow. For a public
   service it additionally probes the candidate from the external GitHub runner
   without credentials: health succeeds, staff paths are absent, the catalog
   rejects missing App Check, and unsigned purchase notifications are rejected.
   Any failure prevents promotion. Revert public access immediately if the newly
   activated current revision fails these checks.
8. Configure the existing RevenueCat **sandbox** integration to the permanent
   service output plus `/v1/purchases/revenuecat`, keeping both authentication
   settings. Send one provider TEST delivery and verify acceptance privately.
   Neither secrets nor raw event bodies belong in GitHub evidence. No tunnel or
   local server should remain in the callback path.
9. Use [the Android staging configuration](../../mobile/staging.env.example)
   with the permanent URL and existing public RevenueCat SDK identifier. Keep
   ads and analytics off. Build/sign the Android release with embedded JavaScript,
   and distribute through the existing Play internal test process only.

## Focused live acceptance

These checks are **not yet performed**. They prove the newly hosted environment;
do not repeat the completed emulator decline/refund/outage matrix.

- With the founder's computer/local services stopped, a registered test account
  opens the catalog, signs in, plays an eligible episode and sees its server balance.
- Home coin icon opens the unified balance/purchase screen. Existing package
  values and store prices remain unchanged.
- The exact Play account is registered as a license tester. The payment sheet
  explicitly shows a test method and no charge; cancel if it offers real payment.
  A client `revenuecat_sandbox` flag cannot force Google Play into test billing.
- One approved test checkout gives one server credit, a permanent authenticated
  notification reaches Cloud Run, and one episode unlock persists after restart.
- Staff endpoints stay inaccessible at the public URL. Firebase revoked-token
  verification and account deletion permissions work for a disposable test user.

Record only normalized outcomes and opaque support references in private evidence.
Never upload account details, receipts, tokens or provider payloads.

## Rollback and remaining paid-launch work

First disable public access (`public_access = false`, restore invocation checks)
if there is an exposure or verification failure. Disable the provider sandbox
destination while investigating; do not acknowledge unverified events as success.
For a code regression, promote each previously verified image revision explicitly.
Both service checks occur before promotion, but two Cloud Run promotions are not
an atomic transaction: if the second promotion fails, restore the first service's
recorded previous revision. Schema changes are absent in this preparation.

Remove `HOSTED_SANDBOX_SERVICE` only after stopping that service's public traffic;
an empty CI variable does not disable an already running service. Keep numeric
secret versions needed by rollback images authorized until they are retired.

This slice does not authorize live commerce or resolve its commercial/refund
policy, launch content rights, final privacy/store publication or #121 distributed
abuse controls. Those stay visible release decisions rather than being silently
treated as completed by a successful test purchase.

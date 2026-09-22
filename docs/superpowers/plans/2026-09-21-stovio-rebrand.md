# Stovio rebrand â€” issue #187

Founder approval: 2026-09-21. Display brand: **Stovio**; technical brand: `stovio`.

1. Inventory tracked source, private configuration names (never secret values),
   GitHub deployment trust, and connected provider metadata.
2. Rename display text, workspace packages, build image names, repository links,
   and supported provider labels. Preserve data and existing credentials.
3. Coordinate GitHub repository rename with its exact GCP deployment principal
   and provider condition. Preserve branch/environment restrictions and roles.
4. Keep persistent app, database, storage, recovery-protocol and cloud resource
   identifiers. Add the Stovio URL scheme alongside the existing scheme and
   keep old environment-variable aliases until operators have migrated.
5. Run repository, backend, contract, mobile and infrastructure checks; inspect
   service metadata and availability. Report failures and unverified checks.
6. Deliver a reviewable branch/PR and a provider-by-provider exception register.
   Never merge, publish a store release, rotate credentials, or replace data
   resources as a cosmetic rename.

The existing graph was queried for config, environment, Firebase, mobile and
Supabase dependencies; current source and provider records are authoritative.
No graph extraction or semantic-model call was needed.

## Founder-directed full identity migration (2026-09-21)

The founder superseded the identity-preservation boundary above: use a fresh
Stovio Compose database and replace the old app/cloud projects, then delete the
superseded services. Preserve remote account/data/financial identity through the
cutover; do not delete source services until replacement evidence passes.

1. Rename local database, cookie, emulator, fixtures, native package, storage
   keys, current protocol names and infrastructure resource defaults to Stovio.
2. Create `stovio-staging`, Firebase `stovio-app`, Android `com.stovio.app`, and
   replacement Play/RevenueCat registration. Keep existing signing material.
3. Preserve Firebase user IDs and remote database contents; copy secret versions
   without changing values. Move private assets, deployment trust and provider
   callbacks. New project-bound OAuth/SDK credentials are necessarily distinct.
4. Run automated suites, container/infra checks and native/provider verification.
   Readiness requires actual evidence; no unfinished launch gate becomes a pass.
5. Cut over configuration, then retire old resources and record any provider
   deletion restrictions. Keep a restricted recovery backup; no parallel legacy
   service is the intended final state.

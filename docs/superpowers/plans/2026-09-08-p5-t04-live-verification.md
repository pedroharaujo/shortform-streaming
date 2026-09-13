# P5-T04 / #101 live verification

The founder explicitly authorized the staging checks and necessary preparation
on 2026-09-08. PR #146 remains unmerged until its required live evidence passes.

## Boundaries

- Use the existing isolated staging project and region only. Keep internal
  ingress, invocation authentication, disabled commerce/rewards/collection, and
  existing traffic until a verified candidate is ready.
- Use generated data only. Keep credentials and raw cloud state out of this
  repository, tool output, command arguments, logs, and public evidence.
- Do not rotate existing credentials, alter other applications, create a paid
  database tier, expose a public API, or select production policy.
- Work in this checkout on the existing PR branch. No worktrees or automatic
  merge. Record any unavailable required check as incomplete.

## Discovered prerequisites

Live metadata shows only a placeholder Cloud Run service, no deployment jobs,
no GitHub federation, no Django/database secret names, and no staging GitHub
variables. The existing ShortForm Supabase project is paused. Compute API is
disabled and the job definition has no private network path. Google requires
Cloud Run-to-Cloud Run internal requests to traverse a VPC; same-project job
placement alone is insufficient.

## Tasks

1. Preserve the existing service traffic/identity metadata and prepare a bounded
   change record. Restore the existing development database if available;
   create a dedicated private staging schema/role without exposing data through
   Supabase's Data API. Preserve all existing identities and data.
2. Add opt-in Direct VPC egress for the smoke job: dedicated private network and
   subnet with Private Google Access, all-traffic routing, no connector, VM,
   NAT, load balancer, DNS zone or public ingress. Defaults create no network
   resources. Add mocked plans that catch missing/private-route configuration.
3. Review exact infrastructure actions, bootstrap only necessary staging
   identities, job/service configuration and GitHub federation/protection.
   Never treat a targeted plan as necessarily limited to its named target.
4. Run real-principal permission tests without reading secret/object values;
   verify zero configured job environment, secret volumes and inherited broad
   grants. Record the absence of previous jobs/executions rather than claiming
   a drain exercise occurred.
5. Build the real application, migrate the private staging schema, and exercise
   authenticated candidate health checks. Run the real deployment workflow's
   fail-smoke/no-promotion and successful deployment paths. Preserve/reinstate
   the known-good traffic allocation on failure.
6. Review final code and sanitized evidence independently, run relevant local
   and CI checks, and update PR #146 and #101 truthfully. Mark ready only if all
   slice gates pass; broader rotation and release acceptance remain open.

## Networking implementation brief

Task 2 owns only `infra/modules/cloud_run_job/*`, staging networking/wiring
files and their focused mocked tests, plus the directly relevant networking
runbook text. Add optional caller-controlled Direct VPC network/subnet inputs
to the reusable job module and create a dedicated opt-in staging network/subnet
for smoke only. Enable Compute API only with the opt-in. Private Google Access
must be true and smoke egress ALL_TRAFFIC. Migration/service networking remains
unchanged. Missing/mismatched configuration must fail validation. Use a /26 or
larger subnet as required by Google's current Direct VPC job documentation.
Do not run cloud calls, alter secrets, commit, switch branches, or apply state
from an implementation subagent. Report exact tests and limitations to root.

Source: https://docs.cloud.google.com/run/docs/securing/private-networking

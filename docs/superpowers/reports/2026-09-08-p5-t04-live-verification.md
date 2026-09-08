# P5-T04 / #101 live smoke isolation evidence

PR #146 implements HTTP-only staging smoke isolation. The founder authorized
the live checks and explicitly approved the private Supabase staging setup
on 2026-09-08. The operations used the existing staging resources only.

## Preparation and preserved boundaries

Initial metadata showed one placeholder service and no migration/smoke jobs
or executions. There were therefore no previous smoke executions to drain;
this records their absence, not a completed drain exercise.

The private preparation created the dedicated smoke/deploy identities,
main/repository/environment-restricted GitHub federation, private VPC/subnet
with Private Google Access, and two new vault containers/versions. The
approved database bootstrap added a restricted login and private schema.
No existing credentials or data were replaced. Credential values and raw
state/policies remain outside the repository; temporary cleartext handoff
files and the one-use database bootstrap function/schema were removed.

The existing revision `shortform-api-00003-mqs` was explicitly pinned at
100% before creating a candidate. Exact saved-plan checks and post-apply
metadata confirm unchanged traffic, internal ingress and the existing
maximum of 20 instances. Service-level scaling was preserved. An unrelated
budget project-ID normalization was excluded rather than applied. This
does not introduce a new capacity or budget decision.

The scanned application image and its private-schema migration prerequisite
are reviewed separately in PR #150. Migration `shortform-migrate-nwhb5`
completed successfully: 37 application tables are private, the public schema
has zero tables, and anon/authenticated/authenticator lack schema access.
Client TLS used Supabase's public CA and hostname verification.

## Deployed identity and permissions

- Stored smoke job: `shortform-smoke` identity, zero configured environment
  variables, secret references, volumes and volume mounts. Only execution
  overrides supply the smoke URL, audience and intentional-failure flag.
- Direct VPC egress is ALL_TRAFFIC through the dedicated same-region subnet
  with Private Google Access. No NAT, connector, VM, load balancer, public
  ingress or additional Compute grant to the smoke identity was introduced.
- Independent live policy review verified every tested resource exists.
  The project has no folder/organization ancestors; smoke has no project
  grants, public/group/domain grants or conditional indirect access. Its
  grants are repository-scoped artifact reader and service-scoped invoker.
- Live probe `shortform-smoke-j6b9n` succeeded under the actual smoke identity.
  All five permission-test calls completed and returned none of the requested
  secret-access, bucket object read/write/delete or runtime/deploy account
  impersonation permissions. No secret values, objects or other accounts'
  tokens were read. Permission-test results are assessed together with the
  independent policy/resource-existence review, not as a universal denial
  proof on their own.
- Deploy's actAs grants target only runtime and smoke. Run developer grants
  are scoped to the service and the two jobs. Service IAM has no public grant.

## Real application checks

- `shortform-smoke-d7dt5`: normal authenticated `/health/ready` and
  `/health/live` checks passed against candidate `shortform-api-00005-vom`.
  The real application uses the new private database; a synthetic HTTP
  responder was not substituted for it.
- `shortform-smoke-wxbt2`: intentional FAIL_SMOKE returned nonzero as expected.
  Baseline traffic remained 100%; candidate traffic remained zero. This is
  the job failure-path check, **not** proof of the GitHub promotion gate.
- All three executions used the dedicated smoke identity and completed.
  The job's stored template remains free of backend configuration/secrets.
- Local code checks: formatting, OpenTofu validation and 30 mocked plans
  passed. Repository foundation passed all 51 tests, safety and governance.
  Applicable GitHub checks passed for PR #146 at `3eeadee` and the container
  prerequisite PR #150 at `c281014`.

Exact saved plans, operation commands, reviewed probe source and sanitized
machine-readable results are retained in the private local validation
directory. Raw cloud state, credential values and provider payloads are not
public evidence.

## Remaining gate

PR #146 remains draft. PR #150 must first reach main so the main-only GitHub
deployment workflow can pass its unchanged image security scan. Then run the
actual deliberate-failure/no-promotion workflow and successful deployment
checks. Do not infer that those passed from the manual job executions above.
GitHub staging is configured for main only with eight non-secret resource
identifiers; federation is restricted to the exact repository, main and
staging. No GitHub credential secret was added.

Issue #101 stays open for other consumer isolation, version-level access,
signing compatibility, provider overlap and actual rotation/retirement proof.
All eight existing issues remain open; this evidence does not close device,
provider, privacy, commercial or production-release acceptance.

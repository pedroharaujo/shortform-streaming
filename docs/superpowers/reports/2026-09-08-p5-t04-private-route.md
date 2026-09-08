# P5-T04 / #101 private smoke route implementation

Date: 2026-09-08. Scope: task 2 of
[the live verification plan](../plans/2026-09-08-p5-t04-live-verification.md).

## Result

The reusable Cloud Run Job module accepts optional Direct VPC configuration
with explicit network, subnetwork and egress. It rejects empty configuration,
unsupported routing, another project, or a subnet outside the job region.
Defaults omit VPC attachment.

Staging adds `smoke_private_network_enabled`, default false. Enabling it adds
Compute API, one dedicated custom VPC and one same-region IPv4 subnet with
Private Google Access. Only smoke attaches, with `ALL_TRAFFIC`; migration and
service networking are unchanged. The default private range is `10.254.0.0/26`;
validation requires a canonical RFC1918 IPv4 range of /26 or larger. Check
overlap before live apply. The network retains its default internet-gateway
route for Private Google Access. No NAT, connector, VM, load balancer, DNS zone,
public ingress, extra runtime permission, or observability enablement is added.

The existing same-project Cloud Run service agent role supplies the documented
VPC permissions, so no redundant IAM grant was added. The parent task must
verify this existing role rather than assume a customized/missing role is valid.
Smoke retains its existing identity and zero configured environment/secrets.

## Verification

OpenTofu 1.11.14, locked Google provider 6.50.0. A fresh, isolated temporary
`TF_DATA_DIR` was used, with backend disabled and the existing cached provider.
No cloud calls, credentials, existing state reads, live apply, commits or branch
switches were performed by this implementation task.

Commands (PowerShell; temporary paths contain tooling only):

```powershell
$env:TF_DATA_DIR = Join-Path $env:TEMP 'shortform-private-route-tofu-20260908'
tofu -chdir=infra/environments/staging init -backend=false -input=false -lockfile=readonly -plugin-dir="$env:TEMP/shortform-smoke-tofu-20260908/providers"
tofu -chdir=infra/environments/staging test -no-color
tofu -chdir=infra/environments/staging validate -no-color
tofu fmt -check infra/modules/cloud_run_job infra/environments/staging/main.tf infra/environments/staging/variables.tf infra/environments/staging/networking.tf infra/environments/staging/tests/smoke_networking.tftest.hcl infra/environments/staging/tests/job_direct_vpc.tftest.hcl
git diff --check
```

- Initialization passed with the lockfile unchanged. Windows sandbox checksum
  access initially failed; approved local execution outside that sandbox used
  the same cached provider successfully, without a provider download.
- All **30 mocked plan runs passed**, including 12 new routing and validation
  cases plus existing isolation and observability cases.
- Configuration validation, the listed format check and diff whitespace check
  passed.
- An initial negative test incorrectly expected both variable validation and a
  downstream precondition to run. It was corrected to expect the variable
  failure that blocks downstream evaluation, then the full suite passed.
- Forward-slash test filters matched zero Windows test paths. That result was
  not counted as a test pass; the full mocked suite was run without filters.

The pre-existing repository static assertion banning any Compute API mention
in `main.tf` was aligned with the approved opt-in route in a follow-up assigned
by the parent task. Only Compute was removed from that blanket prohibition;
all other forbidden APIs remain checked. The mocked default/opt-in tests above
verify actual rendered networking and API configuration, so no replacement
string-matching assertion was added.

Follow-up verification (approved local execution outside the Windows sandbox):

```powershell
python -m unittest discover -s tests/repository -p test_deploy_trust.py
python scripts/check_repository_foundation.py
```

- Targeted deployment-trust suite: **15 tests passed**.
- Full repository foundation: **passed**. Repository safety scan checked 519
  current files, all **51 repository tests passed**, and AI governance
  validation passed.
- This follow-up changed only the existing repository test and this report;
  no cloud or git commands were run.

## Remaining live evidence

### Traffic-preservation prerequisite follow-up

Independent review found that the service module ignored image changes but
not traffic. The parent assigned a bounded prerequisite repair: the Cloud Run
service lifecycle now ignores both the image and `traffic`, making deployment
workflow ownership explicit. The deployment runbook now requires review of the
saved plan's exact before/after traffic before service infrastructure updates.
No traffic policy, ingress setting or default was added or changed.

Verification after this repair, using the same isolated offline test directory:

```powershell
tofu fmt -check infra/modules/cloud_run/main.tf
$env:TF_DATA_DIR = Join-Path $env:TEMP 'shortform-private-route-tofu-20260908'
tofu -chdir=infra/environments/staging validate -no-color
tofu -chdir=infra/environments/staging test -no-color
```

Formatting and configuration validation passed; all **30 existing mocked plan
runs passed**. No additional string-matching or mirrored lifecycle test was
added. These synthetic plans do not prove preservation of a deployed service's
traffic. The parent must first pin the known-good revision (a `LATEST` target
would follow new revisions despite an unchanged traffic specification), then
verify exact before/after traffic equality in the real saved service plan and
check deployed traffic after applying it. This follow-up used no cloud or git
commands.

Mocked plans prove rendered configuration, not deployed network reachability,
service-agent authorization or candidate health. The parent task must review
the actual saved plan, verify route/subnet/agent configuration and execute the
authenticated candidate smoke check. Live fail-smoke/no-promotion, successful
deployment and traffic rollback evidence remain outside this implementation
report. No live gate is marked passed here.

## Primary references

- [Google private networking](https://docs.cloud.google.com/run/docs/securing/private-networking#receive-requests-from-other-cloud-run-resources-or-app-engine):
  Cloud Run sources need VPC routing for internal destinations; all-traffic
  routing plus Private Google Access is one documented option.
- [Google Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc):
  jobs require /26 or larger subnets; same-project `roles/run.serviceAgent`
  already contains the required network permissions.

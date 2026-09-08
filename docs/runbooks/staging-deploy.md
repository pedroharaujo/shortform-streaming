# Staging deploy with GitHub OIDC (P5-T03)

Issue: [#81](https://github.com/pedroharaujo/shortform-streaming/issues/81).
This runbook is the WIF / deploy-workflow contract. It does **not** replace
`docs/runbooks/staging-apply.md` (OpenTofu apply of the staging composition)
or `docs/runbooks/django-container.md` (local image and migrate-vs-web).

Live `tofu apply` of the WIF pool, deploy SA, migrate/smoke jobs, and GitHub
Environment protection is **founder follow-up**. Do not mark live deploy,
smoke-fail, or revision-rollback not-applicable.

## GitHub Environments

Create Environment **staging** before the first `main` deploy:

- Deployment branches: `main` only.
- No required reviewers (staging is automatic from `main`).
- Configure **variables** from `tofu output` (table below). Do **not** store
  GCP keys, ADC JSON, or `credentials_json` as GitHub secrets.

Create Environment **production** before the first `workflow_dispatch` of
`.github/workflows/deploy-production.yml`:

- Required reviewers (approval gate).
- Separate variables for the production project/WIF. Do **not** copy staging
  `WIF_PROVIDER` / `WIF_SERVICE_ACCOUNT` into production.
- Production workflow is dispatch-only, fail-closed if any required var is
  empty, and serial (`concurrency.group: deploy-production`,
  `cancel-in-progress: false`). Staging uses `deploy-staging` the same way.

GitHub Environments plus the workflow `environment:` key are the deployment
audit trail.

## tofu outputs → Environment variables

No GitHub secrets are required for GCP keys. Map staging outputs:

| tofu output | GitHub Environment variable |
| --- | --- |
| `wif_provider_name` | `WIF_PROVIDER` |
| `deploy_service_account_email` | `WIF_SERVICE_ACCOUNT` |
| `project_id` | `GCP_PROJECT_ID` |
| `region` | `GCP_REGION` |
| `artifact_registry_repository_id` | `ARTIFACT_REGISTRY_REPOSITORY` |
| `cloud_run_service_name` | `CLOUD_RUN_SERVICE` |
| `migrate_job_name` | `MIGRATE_JOB` |
| `smoke_job_name` | `SMOKE_JOB` |

The real GitHub repository name is `pedroharaujo/shortform-streaming`. Put it
in gitignored `infra/environments/staging/staging.tfvars` as
`github_repository` and keep it in this runbook. Committed `.tf` and
`staging.tfvars.example` use `example-org/example-repo` only.

## Secret versions before Cloud Run secret refs

The composition creates Secret Manager **names** only. Cloud Run and the
migration job reference `django-secret-key` and `database-url`. The HTTP-only
smoke job has no backend configuration or secret references. P5-T04 adds
`secret_versions` selectors; omitted entries retain `latest` for compatibility.
The selected **versions must exist** before a full apply that creates the secret
refs. Pin numeric versions before rotation; follow
[secrets-and-rotation.md](secrets-and-rotation.md) for candidate adoption,
job-template rollback and revocation. A full apply is not a no-traffic rotation.

Preferred live apply:

1. `tofu apply -var-file=staging.tfvars -target=module.secret_names`
2. `gcloud secrets versions add django-secret-key --data-file=...` and
   `gcloud secrets versions add database-url --data-file=...` (values never
   committed; never paste them into issues, logs, or this runbook)
3. Full `tofu apply -var-file=staging.tfvars`

`bunny-stream-api-key` may remain a name-only placeholder until Bunny is
enabled (`video_provider = "bunny"`). Default `video_provider` is empty so
Cloud Run does not inject Bunny env.

## Deploy sequence (CI)

`.github/workflows/deploy-staging.yml` runs on `push` to `main` and
`workflow_dispatch`. It does **not** run on pull requests. CI never
`tofu apply`. Image digest and service traffic are CI-owned
(`lifecycle.ignore_changes` on the container image and `traffic`).
Infrastructure updates preserve the existing traffic allocation; verify the
exact before/after traffic in the saved plan before applying service changes.
Do not `tofu apply` to promote an image or change service traffic.

Existing revision maximum-instance and service-level scaling settings remain
operator-owned until the capacity/cost configuration follow-up. Infrastructure
preserves them while managing the template minimum. Verify their exact
before/after values as well as traffic; this does not set a new capacity or
spending limit, and it does not establish a maximum for newly created services.

1. Fail closed if any required Environment var is empty.
2. Authenticate with WIF (`vars.WIF_PROVIDER` / `vars.WIF_SERVICE_ACCOUNT`).
3. `docker build -f backend/Dockerfile -t shortform-backend:ci .`
4. Trivy (`HIGH,CRITICAL`, `exit-code: 1`).
5. `gcloud auth configure-docker` (not `docker login`, not
   `docker/login-action`).
6. Push the commit tag and resolve the digest.
7. `gcloud run jobs update` + `execute --wait` for migrate (`args = ["migrate"]`).
8. Capture the **service URL** (`status.url`). Then
   `gcloud run services update … --no-traffic --tag=candidate`.
9. `gcloud run jobs update` the smoke job to the **same image digest**, then
   `execute --wait` with `SMOKE_BASE_URL` (tagged candidate URL),
   `SMOKE_AUDIENCE` (service URL), and `FAIL_SMOKE`. Do not leave smoke
   on a P5-T01-B placeholder (busybox/pause has no `python`).
10. `gcloud run services update-traffic --to-revisions=$CANDIDATE=100`.

Ingress stays `INGRESS_TRAFFIC_INTERNAL_ONLY`. GitHub-hosted runners must
**not** HTTP-smoke the Cloud Run URL. Smoke runs as a Job inside the project,
using dedicated identity `shortform-smoke`. Its grants are Artifact Registry
reader on this repository and invoker on this service only. It receives no
Django, database, Firebase or provider configuration/secrets. The service and
migration job retain the Django runtime identity. Before the first deploy after
this change, apply and verify the smoke identity, scoped deploy actAs grant and
empty job environment as described in [secrets-and-rotation.md](secrets-and-rotation.md).
Drain any earlier smoke executions that used the Django identity before claiming
live isolation.

Same-project placement alone does not make a Cloud Run Job request internal.
Before the first live HTTP smoke, set `smoke_private_network_enabled = true`
in the private staging variables and review the exact saved plan. This opt-in
enables Compute API and creates only a dedicated custom VPC and a same-region
IPv4 subnet for smoke. The default `smoke_private_subnet_cidr = "10.254.0.0/26"`
must not overlap existing routes; custom values must be canonical RFC1918
networks with at least 64 addresses (/26 or larger). The subnet has Private
Google Access and the smoke job uses Direct VPC `ALL_TRAFFIC`. Keep the VPC's
default internet-gateway route for Google frontend reachability. There is no
connector, NAT, VM, load balancer, private DNS zone or public ingress change.
Service and migration networking remain unchanged; observability stays off.
Defaults create no network resources and do not enable Compute API, so live
internal HTTP smoke is unavailable until this opt-in is applied and verified.

Verify the existing Cloud Run **service agent** has its normal
`roles/run.serviceAgent` role; Google documents that this already supplies
same-project Direct VPC permissions. The smoke runtime account receives no
Compute IAM grants. Do not add a redundant project-wide network-user grant.
If that service-agent role is missing or customized, stop and review its exact
required network/subnet/address permissions before repair. Verify the job's
network/subnet IDs, `ALL_TRAFFIC`, Private Google Access, empty configured
environment and successful authenticated candidate requests in live evidence;
mocked plans cannot prove routing or IAM in the deployed project.

Sources: [Google private networking](https://docs.cloud.google.com/run/docs/securing/private-networking#receive-requests-from-other-cloud-run-resources-or-app-engine)
and [Direct VPC job sizing and service-agent permissions](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc).

Cloud Run IAM ID tokens must use the **service URL** as `aud`, even when
calling a tagged revision. Using the revision/tag URL as audience returns
401 (`invalid_token`). CI therefore:

- mints the metadata identity token with `audience=$SMOKE_AUDIENCE` where
  `SMOKE_AUDIENCE` is `status.url` of the service;
- HTTP-smokes `$SMOKE_BASE_URL` which is the **tagged** candidate URL
  (`status.traffic.filter(tag:candidate).url` after `--tag=candidate`).

The Job GETs `{SMOKE_BASE_URL}/health/ready` and `/health/live` with
`Authorization: Bearer` and `X-Forwarded-Proto: https`, retrying with
backoff for min-instance-zero cold start. The Host header is the tagged
URL host (include `.a.run.app` in `django_allowed_hosts`).

Cloud Run startup/liveness probes send `Host: localhost` and
`X-Forwarded-Proto: https`. `django_allowed_hosts` **must** include
`127.0.0.1` and `localhost` (already in `staging.tfvars.example`) so Django
does not 400 the probes. Include a `.a.run.app` suffix and any real service
host as well.

## fail_smoke drill

`workflow_dispatch` input `fail_smoke` (boolean, default false) is passed to
the smoke Job as `FAIL_SMOKE`. When it is `1` / `true` / `yes`, the Job exits
1 **before** promote. The untrafficked candidate revision remains unpromoted.

Leave this box unchecked until founder evidence exists:

- [ ] Deploy a staging revision, set `fail_smoke=true`, and confirm traffic
      stays on the previous revision.

## Rollback

Traffic only. Do **not** migrate reverse.

```bash
gcloud run services update-traffic "$CLOUD_RUN_SERVICE" \
  --to-revisions="$PREVIOUS=100" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID"
```

Leave this box unchecked until founder evidence exists:

- [ ] Deploy a backward-compatible migration and roll back an application
      revision without schema corruption.

## Untrusted-branch design

- Deploy workflows have no `pull_request` / `pull_request_target` /
  `workflow_call` trigger.
- WIF `attribute_condition` is exact
  `assertion.repository == "pedroharaujo/shortform-streaming"` **and**
  `assertion.ref == "refs/heads/main"` **and**
  `assertion.environment == "staging"`. No `startsWith`.
- Forks cannot satisfy `assertion.repository`.
- Workflow default `permissions.contents: read`. `id-token: write` is job
  scoped on the federating job only.
- Deploy SA `shortform-deploy` has Artifact Registry writer, Cloud Run
  developer on the service and jobs, `serviceAccountUser` on the **runtime**
  and dedicated **smoke** SAs only, and `workloadIdentityUser` for this repository
  principalSet. It
  does not get owner/editor/securityAdmin/secret admin/project-wide storage
  admin.

Leave this box unchecked until founder evidence exists:

- [ ] Untrusted branch/fork cannot obtain deploy credentials.

## Live apply follow-up

Follow `docs/runbooks/staging-apply.md` for OpenTofu 1.11.14, session project
override, and the isolated staging project. After WIF resources exist, record
outputs into GitHub Environment **staging** variables and run one successful
`main` deploy.

- [ ] Live staging `tofu apply` of WIF, deploy SA, migrate job, smoke job, and
      Cloud Run env/probes (ADC / founder).
- [ ] GitHub Environment **staging** restricted to `main`; production
      Environment created with required reviewers.
- [ ] Staging deploy records image digest and commit; migrate then smoke then
      promote.

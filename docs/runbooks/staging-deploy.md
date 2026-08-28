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
migrate/smoke jobs reference `django-secret-key` and `database-url` at version
`latest`. Those **versions must exist** before a full apply that creates the
secret refs.

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
`tofu apply`. Image digest is CI-owned (`lifecycle.ignore_changes` on the
container image). Do not `tofu apply` to change the running image.

1. Fail closed if any required Environment var is empty.
2. Authenticate with WIF (`vars.WIF_PROVIDER` / `vars.WIF_SERVICE_ACCOUNT`).
3. `docker build -f backend/Dockerfile -t shortform-backend:ci .`
4. Trivy (`HIGH,CRITICAL`, `exit-code: 1`).
5. `gcloud auth configure-docker` (not `docker login`, not
   `docker/login-action`).
6. Push the commit tag and resolve the digest.
7. `gcloud run jobs update` + `execute --wait` for migrate (`args = ["migrate"]`).
8. `gcloud run services update … --no-traffic`.
9. `gcloud run jobs update` the smoke job to the **same image digest**, then
   `execute --wait` with `SMOKE_BASE_URL` and `FAIL_SMOKE`. Do not leave smoke
   on a P5-T01-B placeholder (busybox/pause has no `python`).
10. `gcloud run services update-traffic --to-revisions=$CANDIDATE=100`.

Ingress stays `INGRESS_TRAFFIC_INTERNAL_ONLY`. GitHub-hosted runners must
**not** HTTP-smoke the Cloud Run URL. Smoke runs as a Job inside the project,
fetches an identity token from the metadata server, and calls `/health/ready`
and `/health/live` with `Authorization: Bearer` and `X-Forwarded-Proto: https`.

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
  SA only, and `workloadIdentityUser` for this repository principalSet. It
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

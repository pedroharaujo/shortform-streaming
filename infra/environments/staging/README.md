# Staging OpenTofu composition (P5-T01 / P5-T03)

Reviewable, repeatable staging infrastructure definition. Apply to the empty
staging GCP project is **P5-T01-B / GitHub issue #71**. Follow
`docs/runbooks/staging-apply.md` (session project override, state-bucket
bootstrap, two-phase apply). WIF, deploy SA, migrate/smoke jobs, and GitHub
Environment variables are **P5-T03 / #81**; follow
`docs/runbooks/staging-deploy.md`. Do not apply to founder projects other than
staging. CI does not `tofu apply`.

The **P5-T04 foundation** adds `secret_versions` and limits runtime access to
consumed secret names. See `docs/runbooks/secrets-and-rotation.md` for the
inventory, safe adoption/rollback procedure and required live follow-up. Pin
numeric versions before rotation; omitted selectors retain `latest`. Creating
an extra secret never grants runtime access on its own. Full version-level
least privilege and per-consumer identity separation remain follow-up work.

Public activation stays off. `europe-west9` (or any `region` value supplied at
apply time) is **not** a D-020 residency/retention approval.

## What this defines

- Cloud Run service with `INGRESS_TRAFFIC_INTERNAL_ONLY`, IAM invoker
  checks enabled, no `allUsers`, no custom domain or DNS, min instances 0,
  container port 8080, `/health/ready` + `/health/live` probes with
  `X-Forwarded-Proto: https`, Django env + Secret Manager refs, CI-owned
  image digest.
- Cloud Run Jobs `shortform-migrate` (`args = ["migrate"]`) and
  `shortform-smoke` (in-project identity-token HTTP checks). `max_retries = 0`.
- GitHub OIDC workload identity pool/provider with exact repository, ref, and
  Environment. Dedicated deploy SA `shortform-deploy` (Artifact Registry
  writer, Cloud Run developer on the service and jobs, `serviceAccountUser` on
  the runtime SA only).
- One Docker Artifact Registry repository in `var.region`.
- Secret Manager **names** only (no versions or values), including
  `bunny-stream-api-key`, `django-secret-key`, and `database-url`. Optional
  extra IDs via `extra_secret_ids`.
- One private non-video bucket with uniform bucket-level access and
  `public_access_prevention = "enforced"`. Not a video origin. No object
  age-delete lifecycle (D-020). No CORS.
- Dedicated runtime service account with resource-scoped roles only
  (Artifact Registry reader, Secret Manager accessor per secret, Storage
  objectAdmin on that bucket, `run.invoker` on this service). Optional
  `logging.logWriter` and `monitoring.metricWriter`. No owner/editor/securityAdmin,
  no project-wide secret or storage admin. Not a WIF SA.
- Billing budget with caller-supplied amount/currency (no D-022 default)
  and actual plus forecast threshold rules.
- Labels: product, environment, owner, cost_center (placeholders allowed).

## What this does not define

- GCS HLS origin, Cloud CDN, or Transcoder (D-014 GCP video fallback is
  inactive).
- Cloud Tasks, Cloud Scheduler, DNS, Cloud SQL, or Compute.
- Public activation (`INGRESS_TRAFFIC_ALL`, `allUsers`, domain mapping).
- A D-020 region/retention decision. `region` has no default.
- Real project, billing, or state-bucket identifiers in git.
- Real GitHub repository name in committed `.tf` (example-org/example-repo
  only; real name is gitignored tfvars + `docs/runbooks/staging-deploy.md`).

## How to review (credential-free)

From the repository root, with OpenTofu >= 1.6.0:

```bash
tofu fmt -check -recursive infra

cd infra/environments/staging
tofu init -backend=false -input=false -lockfile=readonly
tofu validate
tofu test -no-color # OpenTofu 1.11.14; mocked provider, synthetic plans only
```

Live `tofu plan` / `tofu apply` uses a gitignored `staging.tfvars` and
`backend.hcl`. This directory commits no state files, no `*.tfvars` (only
`*.tfvars.example`), and no `backend.hcl` (only `backend.hcl.example`).

Remote state uses a partial `backend "gcs" {}`. GCS encrypts at rest.
KMS/CMEK for state was **not** added. The state bucket is not managed here;
bootstrap it with gcloud as in the apply runbook.

## Apply

Copy the example tfvars/backend files locally, supply the real empty staging
project, and follow `docs/runbooks/staging-apply.md`. Public traffic stays off
until a later activation task. After apply, map outputs to GitHub Environment
variables as in `docs/runbooks/staging-deploy.md`.

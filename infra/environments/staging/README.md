# Staging OpenTofu composition (P5-T01-A / GitHub issue #70)

Reviewable, repeatable staging infrastructure definition. **Do not apply**
this composition in this slice. Apply to an empty staging GCP project is
**P5-T01-B / GitHub issue #71**.

## What this defines

- Cloud Run service with `INGRESS_TRAFFIC_INTERNAL_ONLY`, IAM invoker
  checks enabled, no `allUsers`, no custom domain or DNS, min instances 0.
- One Docker Artifact Registry repository in `var.region`.
- Secret Manager **names** only (no versions or values), including
  `bunny-stream-api-key`. Optional extra IDs via `extra_secret_ids`.
- One private non-video bucket with uniform bucket-level access and
  `public_access_prevention = "enforced"`. Not a video origin. No object
  age-delete lifecycle (D-020). No CORS.
- Dedicated runtime service account with resource-scoped roles only
  (Artifact Registry reader, Secret Manager accessor per secret, Storage
  objectAdmin on that bucket). Optional `logging.logWriter` and
  `monitoring.metricWriter`. No owner/editor/securityAdmin, no project-wide
  secret or storage admin, no WIF deploy SA.
- Billing budget with caller-supplied amount/currency (no D-022 default)
  and actual plus forecast threshold rules.
- Labels: product, environment, owner, cost_center (placeholders allowed).

## What this does not define

- GCS HLS origin, Cloud CDN, or Transcoder (D-014 GCP video fallback is
  inactive).
- Cloud Tasks, Cloud Scheduler, DNS, Cloud SQL, Compute, or WIF
  (`iamcredentials`).
- Public activation (`INGRESS_TRAFFIC_ALL`, `allUsers`, domain mapping).
- A D-020 region/retention decision. `region` has no default.
- Real project, billing, or state-bucket identifiers.

## How to review (credential-free; no apply)

From the repository root, with OpenTofu >= 1.6.0:

```bash
tofu fmt -check -recursive infra

cd infra/environments/staging
tofu init -backend=false -input=false -lockfile=readonly
tofu validate
```

`tofu apply` and `tofu plan` against a live project belong to #71. This
directory commits no state files, no `*.tfvars` (only `*.tfvars.example`),
and no `backend.hcl` (only `backend.hcl.example`).

Remote state uses a partial `backend "gcs" {}`. GCS encrypts at rest;
optional KMS for state is #71. The state bucket is not managed here.

## Apply follow-up (#71)

P5-T01-B will copy the example tfvars/backend files locally, supply a real
empty staging project, and apply. Public traffic stays off until a later
activation task.

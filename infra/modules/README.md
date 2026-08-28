# Infrastructure modules

Reusable OpenTofu modules for staging (P5-T01 / GitHub issues #70 / #71). Each
module has `main.tf`, `variables.tf`, and `outputs.tf` and **no provider
block**. The staging composition in `infra/environments/staging` is the
root module that selects providers.

## Modules

| Module | Purpose |
| --- | --- |
| `artifact_registry` | One Docker Artifact Registry repository. No `allUsers` IAM. |
| `secret_names` | Secret Manager **names** only (`secret_id` / `secret_ids`). No versions or values. |
| `private_bucket` | Private non-video bucket with uniform access and public-access prevention. |
| `cloud_run` | Cloud Run v2 service, internal ingress only, dedicated runtime SA, min instances 0. |

Apply of the staging composition is documented in
`docs/runbooks/staging-apply.md` (P5-T01-B / #71). Modules stay reusable and
do not embed project or billing identifiers.

## Out of scope (do not add here)

- GCS HLS origin, Cloud CDN, or Transcoder (D-014 GCP video fallback is inactive).
- Cloud Tasks, Cloud Scheduler, DNS, Cloud SQL, Compute, or WIF.
- Public activation (`INGRESS_TRAFFIC_ALL`, `allUsers`, domain mapping).

D-020 (residency/retention) is **not** decided by these modules: `region` is
always a required variable with no default, and buckets have no object
age-delete lifecycle.

# Infrastructure modules

Reusable OpenTofu modules for staging (P5-T01 / P5-T03, GitHub issues #70 /
#71 / #81). Each module has `main.tf`, `variables.tf`, and `outputs.tf` and
**no provider block**. The staging composition in `infra/environments/staging`
is the root module that selects providers.

## Modules

| Module | Purpose |
| --- | --- |
| `artifact_registry` | One Docker Artifact Registry repository. No `allUsers` IAM. |
| `secret_names` | Secret Manager **names** only (`secret_id` / `secret_ids`). No versions or values. |
| `private_bucket` | Private non-video bucket with uniform access and public-access prevention. |
| `cloud_run` | Cloud Run v2 service, internal ingress only, dedicated runtime SA, port 8080, Secret Manager env, `/health/ready` + `/health/live` probes, CI-owned image digest. |
| `cloud_run_job` | Cloud Run v2 job with the same env/secret shape, runtime SA, `max_retries` default 0, CI-owned image. |
| `github_wif` | GitHub OIDC workload identity pool/provider. Exact repository, ref, and environment. No `startsWith`. |

Apply of the staging composition is documented in
`docs/runbooks/staging-apply.md` (P5-T01-B / #71). Deploy CI, WIF outputs, and
smoke/rollback are in `docs/runbooks/staging-deploy.md` (P5-T03 / #81).
Modules stay reusable and do not embed project or billing identifiers.

## Out of scope (do not add here)

- GCS HLS origin, Cloud CDN, or Transcoder (D-014 GCP video fallback is inactive).
- Cloud Tasks, Cloud Scheduler, DNS, Cloud SQL, or Compute.
- Public activation (`INGRESS_TRAFFIC_ALL`, `allUsers`, domain mapping).

D-020 (residency/retention) is **not** decided by these modules: `region` is
always a required variable with no default, and buckets have no object
age-delete lifecycle.

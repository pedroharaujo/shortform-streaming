# Staging OpenTofu apply (P5-T01-B)

Apply the reviewed staging composition in `infra/environments/staging` to the
isolated staging GCP project. This runbook records how to install OpenTofu,
override the session project, bootstrap remote state, and apply without turning
on public traffic or commercial integrations.

`europe-west9` is an isolated staging operational choice. It is **not** a D-020
data-residency/retention approval. Secret Manager automatic replication is also
**not** D-020.

The billing-budget currency must match the billing account. A 1-unit GCP budget
is a cost-control alert. It is **not** D-022 company/store IAP settlement.
D-025 legal-entity registration is **not** claimed by this apply.

Never paste ADC JSON, access tokens, secret **values**, or secret versions.
This composition creates secret **names** only.

## Safety rails

Do not apply to founder projects other than staging (`ocus-analytics`, avora,
salta, adbridge, or production). Prefer a session override instead of changing
the persistent `gcloud` default:

```bash
export CLOUDSDK_CORE_PROJECT=shortform-streaming-stg
export GOOGLE_CLOUD_PROJECT=shortform-streaming-stg
# User ADC needs a quota project for Billing Budgets:
export GOOGLE_CLOUD_QUOTA_PROJECT=shortform-streaming-stg
```

Every `gcloud` mutate should also pass `--project=shortform-streaming-stg`.
Abort if `staging.tfvars` `project_id` is not exactly `shortform-streaming-stg`.

Confirm identity before mutate:

```bash
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud projects describe shortform-streaming-stg \
  --format='value(projectId,projectNumber,lifecycleState)'
gcloud billing projects describe shortform-streaming-stg \
  --format='yaml(billingAccountName,billingEnabled)'
```

## Install OpenTofu 1.11.14

Match CI (`.github/workflows/tofu-validate.yml`). Official zip only. Do not
install Terraform. Do not use an unpinned winget/choco latest.

Windows Git Bash (`windows_amd64`):

```bash
TOFU_VERSION=1.11.14
TOFU_ZIP="tofu_${TOFU_VERSION}_windows_amd64.zip"
TOFU_BASE="https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}"
install_dir="$HOME/.local/bin"
mkdir -p "$install_dir" /tmp/tofu-extract

curl -fsSL -o "/tmp/${TOFU_ZIP}" "${TOFU_BASE}/${TOFU_ZIP}"
curl -fsSL -o /tmp/tofu_SHA256SUMS "${TOFU_BASE}/tofu_${TOFU_VERSION}_SHA256SUMS"
( cd /tmp && grep " ${TOFU_ZIP}$" tofu_SHA256SUMS | sha256sum -c - )

unzip -o "/tmp/${TOFU_ZIP}" -d /tmp/tofu-extract
cp /tmp/tofu-extract/tofu.exe "$install_dir/tofu.exe"
export PATH="$install_dir:$PATH"
hash -r
tofu version   # OpenTofu v1.11.14
```

Keep `PATH` exported for the session. Do not commit binaries.

## Local gitignored files

From `infra/environments/staging`:

```bash
cp staging.tfvars.example staging.tfvars
cp backend.hcl.example backend.hcl
```

Edit the copies with the real project, region, billing account, bucket names,
and Artifact Registry image URI. **Never `git add` them.** `.gitignore` already
covers `*.tfvars`, `backend.hcl`, `*.tfstate*`, `.terraform/`, and `*.tfplan`.

`staging.tfvars.example` keeps fictional values (`example-only`, `XXX`). Copying
it is required before apply; applying the example file as-is is not.

Query the billing-account currency and use that ISO 4217 code with a tiny
amount (`1`). Confirm the apply identity can create budgets
(`billing.budgets.create`, for example Billing Account Administrator). Do not
delete `google_billing_budget` to work around missing IAM.

## State bucket (gcloud, not OpenTofu)

The GCS backend bucket is **not** managed by the composition. Create it with
uniform bucket-level access and public-access prevention. Do **not** add KMS;
default Google-managed encryption at rest is enough.

On current `gcloud`, `--public-access-prevention` is a boolean flag (it
enforces PAP; do not pass `=enforced`):

```bash
gcloud services enable storage.googleapis.com serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project=shortform-streaming-stg

gcloud storage buckets create gs://shortform-streaming-stg-tfstate-480151869295 \
  --project=shortform-streaming-stg \
  --location=europe-west9 \
  --uniform-bucket-level-access \
  --public-access-prevention

gcloud storage buckets update gs://shortform-streaming-stg-tfstate-480151869295 \
  --versioning
```

Confirm `public_access_prevention: enforced`, uniform access enabled, and no
`allUsers` / `allAuthenticatedUsers` on the bucket IAM policy.

## Init, format, validate

```bash
cd infra/environments/staging
tofu fmt -check -recursive ../..
tofu init -input=false -lockfile=readonly -backend-config=backend.hcl
tofu validate
```

Do not use `-backend=false` for the apply path (that is CI-only). Do not rewrite
provider versions in `.terraform.lock.hcl`. Adding the current platform `h1`
hash for the already-pinned google provider (6.50.0) is the Windows apply
exception when `tofu validate` reports a checksum mismatch.

## Two-phase apply

Cloud Run must use an Artifact Registry image in **this** project. Do not use
`us-docker.pkg.dev/cloudrun/container/hello` or `gcr.io/cloudrun/hello`.

### Phase 1 — APIs and Artifact Registry

```bash
tofu plan -var-file=staging.tfvars -input=false -no-color \
  -target=module.artifact_registry -out=phase1.tfplan
tofu apply -input=false phase1.tfplan
```

### Phase 2 — Placeholder image

Push a non-hello image to the URI in `cloud_run_image` (tag `placeholder`).
Prefer Docker. `mirror.gcr.io/google-containers/pause:3.8` or
`mirror.gcr.io/library/busybox:1.36` are acceptable sources.

The google provider waits until Cloud Run can listen on `PORT`. If a pause or
plain busybox image fails that wait, build a **local-only** image (for example
busybox `httpd` on 8080) and push the same URI. Do not commit a Dockerfile. Do
not enable Cloud Build. Do not change `backend/Dockerfile`.

```bash
gcloud auth configure-docker europe-west9-docker.pkg.dev --quiet
# pull / tag / push to the cloud_run_image URI
```

A first revision that fails to serve is acceptable for the service spec. Public
HTTP to the Cloud Run URL is out of scope; do not add `allUsers`.

### Phase 3 — Full apply

```bash
tofu plan -var-file=staging.tfvars -input=false -no-color -out=staging.tfplan
# Review: this project only, INTERNAL_ONLY ingress, AR image not hello,
# secret names only, private bucket PAP, runtime SA scoped roles, 1-unit budget,
# no DNS/SQL/CDN.
tofu apply -input=false staging.tfplan
```

Delete local `*.tfplan` files after apply. Do not `tofu destroy` as a
convenience.

User ADC without `GOOGLE_CLOUD_QUOTA_PROJECT` can 403 Billing Budgets against
the Cloud SDK quota project. Set the session quota project to staging; do not
drop the budget resource.

## Re-apply

```bash
export CLOUDSDK_CORE_PROJECT=shortform-streaming-stg
export GOOGLE_CLOUD_PROJECT=shortform-streaming-stg
export GOOGLE_CLOUD_QUOTA_PROJECT=shortform-streaming-stg
cd infra/environments/staging
tofu init -input=false -lockfile=readonly -backend-config=backend.hcl
tofu plan -var-file=staging.tfvars -input=false -no-color
tofu apply -var-file=staging.tfvars -input=false
```

A second plan may still propose:

- billing budget `budget_filter.projects` as `projects/<number>` (API) versus
  `projects/<id>` (config) — same project, GCP no-op;
- Cloud Run v2 service-level versus template-level `scaling` with
  `min_instance_count = 0` — provider/API echo, not an ingress or IAM change.

Classify those before applying. Unexpected diffs include ingress, IAM, public
access, image, or `project_id`.

## After apply

Smoke with `tofu output` and `gcloud` describe on Artifact Registry, the
non-video bucket, secret **names** (no versions), the runtime service account,
Cloud Run, and the 1-unit budget. Do not call the Cloud Run URL from the public
internet. Do not create DNS.

Keep public activation off: Cloud Run `INGRESS_TRAFFIC_INTERNAL_ONLY` (gcloud
annotation `run.googleapis.com/ingress: internal`), invoker IAM enabled, no
`allUsers` / `allAuthenticatedUsers`.

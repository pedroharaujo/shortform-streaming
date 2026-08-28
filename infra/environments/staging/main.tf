locals {
  labels = {
    product     = var.label_product
    environment = var.label_environment
    owner       = var.label_owner
    cost_center = var.label_cost_center
  }

  secret_ids = toset(
    concat(var.secret_ids, var.extra_secret_ids)
  )

  # Enable only APIs this composition uses. Enable iamcredentials and sts for
  # WIF. Do not enable transcoder, dns, sqladmin, cloudtasks, cloudscheduler,
  # or compute.
  required_services = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbilling.googleapis.com",
  ])

  # Stdlib-only in-project smoke. SMOKE_AUDIENCE (service URL) and
  # SMOKE_BASE_URL (tagged candidate URL) are supplied at job execute
  # time by CI; they are not baked into this composition.
  smoke_script = <<-PY
import os
import sys
import time
import urllib.error
import urllib.request

fail = os.environ.get("FAIL_SMOKE", "").strip().lower()
if fail in ("1", "true", "yes"):
    sys.exit(1)

audience = os.environ.get("SMOKE_AUDIENCE", "").strip().rstrip("/")
base = os.environ.get("SMOKE_BASE_URL", "").strip().rstrip("/")
if not audience:
    sys.stderr.write("SMOKE_AUDIENCE is required\n")
    sys.exit(1)
if not base:
    sys.stderr.write("SMOKE_BASE_URL is required\n")
    sys.exit(1)

meta = (
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
    "?audience=" + audience
)
req = urllib.request.Request(meta, headers={"Metadata-Flavor": "Google"})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        token = resp.read().decode("utf-8").strip()
except Exception as exc:
    sys.stderr.write("identity token failed: %s\n" % exc)
    sys.exit(1)

def check(path):
    url = base + path
    last_error = "unknown"
    attempts = 5
    for attempt in range(attempts):
        request = urllib.request.Request(
            url,
            headers={
                "Authorization": "Bearer " + token,
                "X-Forwarded-Proto": "https",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as resp:
                if resp.status == 200:
                    return
                last_error = "%s returned %s" % (path, resp.status)
        except urllib.error.HTTPError as exc:
            last_error = "%s returned %s" % (path, exc.code)
        except Exception as exc:
            last_error = "%s failed: %s" % (path, exc)
        if attempt + 1 < attempts:
            time.sleep(2 ** attempt)
    sys.stderr.write("%s\n" % last_error)
    sys.exit(1)

check("/health/ready")
check("/health/live")
PY
}

resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

module "artifact_registry" {
  source = "../../modules/artifact_registry"

  project_id    = var.project_id
  region        = var.region
  repository_id = var.artifact_registry_repository_id
  labels        = local.labels

  depends_on = [google_project_service.required]
}

module "secret_names" {
  source = "../../modules/secret_names"

  project_id = var.project_id
  secret_ids = sort(
    local.secret_ids
  )
  labels = local.labels

  depends_on = [google_project_service.required]
}

module "private_bucket" {
  source = "../../modules/private_bucket"

  project_id  = var.project_id
  region      = var.region
  bucket_name = var.private_bucket_name
  labels      = local.labels

  depends_on = [google_project_service.required]
}

module "cloud_run" {
  source = "../../modules/cloud_run"

  project_id                    = var.project_id
  region                        = var.region
  service_name                  = var.cloud_run_service_name
  image                         = var.cloud_run_image
  runtime_service_account_email = google_service_account.runtime.email
  labels                        = local.labels
  django_allowed_hosts          = var.django_allowed_hosts
  firebase_project_id           = var.firebase_project_id
  video_provider                = var.video_provider

  depends_on = [
    google_project_service.required,
    module.secret_names,
  ]
}

module "migrate_job" {
  source = "../../modules/cloud_run_job"

  project_id                    = var.project_id
  region                        = var.region
  job_name                      = var.migrate_job_name
  image                         = var.cloud_run_image
  runtime_service_account_email = google_service_account.runtime.email
  labels                        = local.labels
  args                          = ["migrate"]
  max_retries                   = 0
  django_allowed_hosts          = var.django_allowed_hosts
  firebase_project_id           = var.firebase_project_id
  video_provider                = var.video_provider

  depends_on = [
    google_project_service.required,
    module.secret_names,
  ]
}

module "smoke_job" {
  source = "../../modules/cloud_run_job"

  project_id                    = var.project_id
  region                        = var.region
  job_name                      = var.smoke_job_name
  image                         = var.cloud_run_image
  runtime_service_account_email = google_service_account.runtime.email
  labels                        = local.labels
  command                       = ["python"]
  args                          = ["-c", local.smoke_script]
  max_retries                   = 0
  django_allowed_hosts          = var.django_allowed_hosts
  firebase_project_id           = var.firebase_project_id
  video_provider                = var.video_provider

  depends_on = [
    google_project_service.required,
    module.secret_names,
  ]
}

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

  # Enable only APIs this composition uses. Do not enable transcoder, dns,
  # sqladmin, cloudtasks, cloudscheduler, compute, or iamcredentials.
  required_services = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbilling.googleapis.com",
  ])
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

  depends_on = [google_project_service.required]
}

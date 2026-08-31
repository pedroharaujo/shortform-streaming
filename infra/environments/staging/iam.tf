# Dedicated Cloud Run runtime identity. This is not a deploy/WIF SA.
# Do not grant owner, editor, iam.securityAdmin, project-wide
# secretmanager.admin, or project-wide storage.admin.
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_service_account_id
  display_name = "shortform staging Cloud Run runtime"
  description  = "Least-privilege runtime identity for staging Cloud Run. Not a WIF deploy SA. Invoker is granted on this service only; no public invoker and no project-wide admin roles."

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository_iam_member" "runtime_reader" {
  project    = module.artifact_registry.project
  location   = module.artifact_registry.location
  repository = module.artifact_registry.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_accessor" {
  for_each  = local.runtime_secret_ids
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"

  lifecycle {
    precondition {
      condition     = length(setsubtract(local.runtime_secret_ids, local.secret_ids)) == 0
      error_message = "Every consumed runtime secret must be declared in secret_ids or extra_secret_ids."
    }
  }

  depends_on = [module.secret_names]
}

resource "google_storage_bucket_iam_member" "runtime_object_admin" {
  bucket = module.private_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service_iam_member" "runtime_invoker" {
  project  = var.project_id
  location = module.cloud_run.location
  name     = module.cloud_run.service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.runtime.email}"
}

# Dedicated GitHub Actions deploy identity. account_id shortform-deploy.
# Resource-scoped roles only. Do not grant owner, editor, iam.securityAdmin,
# secretmanager.admin, or project-wide storage.admin.
resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "shortform-deploy"
  display_name = "shortform staging GitHub Actions deploy"
  description  = "Least-privilege WIF deploy identity (shortform-deploy). Not a runtime SA."

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository_iam_member" "deploy_writer" {
  project    = module.artifact_registry.project
  location   = module.artifact_registry.location
  repository = module.artifact_registry.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deploy_developer" {
  project  = var.project_id
  location = module.cloud_run.location
  name     = module.cloud_run.service_name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deploy_migrate_developer" {
  project  = var.project_id
  location = module.migrate_job.location
  name     = module.migrate_job.job_name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deploy_smoke_developer" {
  project  = var.project_id
  location = module.smoke_job.location
  name     = module.smoke_job.job_name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${module.github_wif.pool_name}/attribute.repository/${var.github_repository}"
}

# Dedicated Cloud Run runtime identity. This is not a deploy/WIF SA (P5-T03).
# Do not grant owner, editor, iam.securityAdmin, project-wide
# secretmanager.admin, or project-wide storage.admin.
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_service_account_id
  display_name = "shortform staging Cloud Run runtime"
  description  = "Least-privilege runtime identity for staging Cloud Run. No public invoker and no project-wide admin roles."

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
  for_each  = toset(module.secret_names.secret_ids)
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
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

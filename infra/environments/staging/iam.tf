# Dedicated Cloud Run runtime identity. This is not a deploy/WIF SA.
# Do not grant owner, editor, iam.securityAdmin, project-wide
# secretmanager.admin, or project-wide storage.admin.
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_service_account_id
  display_name = "Stovio staging Cloud Run runtime"
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

data "google_project" "secret_access" {
  count      = length(var.runtime_secret_allowed_versions) > 0 ? 1 : 0
  project_id = var.project_id
}

resource "google_secret_manager_secret_iam_member" "runtime_accessor" {
  for_each  = local.runtime_secret_ids
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"

  dynamic "condition" {
    for_each = length(var.runtime_secret_allowed_versions) > 0 ? [1] : []
    content {
      title       = "runtime-approved-secret-versions"
      description = "Only explicitly approved current and rollback versions."
      expression = format("resource.type == 'secretmanager.googleapis.com/SecretVersion' && resource.name in %s", jsonencode([
        for version in sort(coalesce(lookup(var.runtime_secret_allowed_versions, each.value, null), toset([]))) :
        "projects/${data.google_project.secret_access[0].number}/secrets/${each.value}/versions/${version}"
      ]))
    }
  }

  lifecycle {
    precondition {
      condition     = length(setsubtract(local.runtime_secret_ids, local.secret_ids)) == 0
      error_message = "Every consumed runtime secret must be declared in secret_ids or extra_secret_ids."
    }
    precondition {
      condition = length(var.runtime_secret_allowed_versions) == 0 || (
        toset(keys(var.runtime_secret_allowed_versions)) == local.runtime_secret_ids && alltrue([
          for name, secret_id in local.runtime_secret_names : try(
            contains(var.runtime_secret_allowed_versions[secret_id], lookup(var.secret_versions, name, "latest")), false
          )
        ])
      )
      error_message = "Version authorization requires all and only consumed secret IDs, with each workload's explicit numeric selector in its allowed set. Include rollback versions before activation."
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

# HTTP-only smoke never receives backend secrets or bucket permissions.
resource "google_service_account" "smoke" {
  project      = var.project_id
  account_id   = "shortform-smoke"
  display_name = "Stovio staging HTTP smoke"
  description  = "HTTP-only staging checks. Artifact reader and service-scoped invoker; no Secret Manager access."

  lifecycle {
    precondition {
      condition     = var.runtime_service_account_id != "shortform-smoke"
      error_message = "The Django runtime identity must be distinct from the HTTP-only shortform-smoke identity."
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository_iam_member" "smoke_reader" {
  project    = module.artifact_registry.project
  location   = module.artifact_registry.location
  repository = module.artifact_registry.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.smoke.email}"
}

resource "google_cloud_run_v2_service_iam_member" "smoke_invoker" {
  project  = var.project_id
  location = module.cloud_run.location
  name     = module.cloud_run.service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.smoke.email}"
}

# Dedicated GitHub Actions deploy identity. account_id shortform-deploy.
# Resource-scoped roles only. Do not grant owner, editor, iam.securityAdmin,
# secretmanager.admin, or project-wide storage.admin.
resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "shortform-deploy"
  display_name = "Stovio staging GitHub Actions deploy"
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

resource "google_service_account_iam_member" "deploy_acts_as_smoke" {
  service_account_id = google_service_account.smoke.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${module.github_wif.pool_name}/attribute.repository/${var.github_repository}"
}

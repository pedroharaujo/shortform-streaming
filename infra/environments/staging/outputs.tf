output "project_id" {
  description = "Staging project ID supplied at apply time."
  value       = var.project_id
}

output "region" {
  description = "Region supplied at apply time. Not a D-020 approval."
  value       = var.region
}

output "artifact_registry_repository_id" {
  description = "Docker Artifact Registry repository ID."
  value       = module.artifact_registry.repository_id
}

output "artifact_registry_repository_name" {
  description = "Docker Artifact Registry repository resource name."
  value       = module.artifact_registry.repository_name
}

output "private_bucket_name" {
  description = "Private non-video bucket name."
  value       = module.private_bucket.name
}

output "secret_ids" {
  description = "Secret Manager secret_id values created (names only)."
  value       = module.secret_names.secret_ids
}

output "cloud_run_service_name" {
  description = "Cloud Run service name."
  value       = module.cloud_run.service_name
}

output "cloud_run_service_id" {
  description = "Cloud Run service resource ID."
  value       = module.cloud_run.service_id
}

output "runtime_service_account_email" {
  description = "Dedicated Cloud Run runtime service account email."
  value       = google_service_account.runtime.email
}

output "budget_name" {
  description = "Billing budget resource name."
  value       = google_billing_budget.staging.name
}

output "wif_provider_name" {
  description = "Set GitHub Environment variable WIF_PROVIDER to this value. Not a GitHub secret."
  value       = module.github_wif.provider_name
}

output "deploy_service_account_email" {
  description = "Set GitHub Environment variable WIF_SERVICE_ACCOUNT to this value. Not a GitHub secret."
  value       = google_service_account.deploy.email
}

output "migrate_job_name" {
  description = "Cloud Run migrate job name for GitHub Environment variable MIGRATE_JOB."
  value       = module.migrate_job.job_name
}

output "smoke_job_name" {
  description = "Cloud Run smoke job name for GitHub Environment variable SMOKE_JOB."
  value       = module.smoke_job.job_name
}

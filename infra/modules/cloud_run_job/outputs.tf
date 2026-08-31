output "secret_references" {
  description = "Configured runtime secret names and versions only; never secret values."
  value = {
    for env in google_cloud_run_v2_job.this.template[0].template[0].containers[0].env : env.name => {
      secret  = env.value_source[0].secret_key_ref[0].secret
      version = env.value_source[0].secret_key_ref[0].version
    } if length(env.value_source) > 0
  }
}

output "job_name" {
  description = "Cloud Run job name."
  value       = google_cloud_run_v2_job.this.name
}

output "job_id" {
  description = "Cloud Run job resource ID."
  value       = google_cloud_run_v2_job.this.id
}

output "location" {
  description = "Cloud Run job location."
  value       = google_cloud_run_v2_job.this.location
}

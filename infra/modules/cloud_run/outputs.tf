output "secret_references" {
  description = "Configured runtime secret names and versions only; never secret values."
  value = {
    for env in google_cloud_run_v2_service.this.template[0].containers[0].env : env.name => {
      secret  = env.value_source[0].secret_key_ref[0].secret
      version = env.value_source[0].secret_key_ref[0].version
    } if length(env.value_source) > 0
  }
}

output "service_name" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.this.name
}

output "service_id" {
  description = "Cloud Run service resource ID."
  value       = google_cloud_run_v2_service.this.id
}

output "location" {
  description = "Cloud Run service location."
  value       = google_cloud_run_v2_service.this.location
}

output "uri" {
  description = "Cloud Run service URI exported by the resource."
  value       = google_cloud_run_v2_service.this.uri
}

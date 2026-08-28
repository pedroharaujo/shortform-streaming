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

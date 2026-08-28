output "pool_id" {
  description = "Workload Identity Pool ID."
  value       = google_iam_workload_identity_pool.this.workload_identity_pool_id
}

output "pool_name" {
  description = "Workload Identity Pool resource name for principalSet members."
  value       = google_iam_workload_identity_pool.this.name
}

output "provider_name" {
  description = "Full WIF provider resource name for GitHub Environment var WIF_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.this.name
}

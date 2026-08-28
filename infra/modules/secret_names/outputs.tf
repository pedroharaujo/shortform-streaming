output "secret_ids" {
  description = "Created Secret Manager secret_id values (names only)."
  value       = sort([for secret_resource in google_secret_manager_secret.this : secret_resource.secret_id])
}

output "secret_resource_names" {
  description = "Full Secret Manager resource names keyed by secret_id."
  value       = { for secret_id, secret_resource in google_secret_manager_secret.this : secret_id => secret_resource.name }
}

output "repository_id" {
  description = "Artifact Registry repository ID."
  value       = google_artifact_registry_repository.this.repository_id
}

output "repository_name" {
  description = "Full Artifact Registry repository resource name."
  value       = google_artifact_registry_repository.this.name
}

output "location" {
  description = "Repository location."
  value       = google_artifact_registry_repository.this.location
}

output "project" {
  description = "Project that owns the repository."
  value       = google_artifact_registry_repository.this.project
}

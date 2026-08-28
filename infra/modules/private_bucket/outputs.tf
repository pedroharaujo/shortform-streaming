output "name" {
  description = "Bucket name."
  value       = google_storage_bucket.this.name
}

output "id" {
  description = "Bucket ID."
  value       = google_storage_bucket.this.id
}

output "location" {
  description = "Bucket location."
  value       = google_storage_bucket.this.location
}

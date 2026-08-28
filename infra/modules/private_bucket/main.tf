resource "google_storage_bucket" "this" {
  project                     = var.project_id
  name                        = var.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = var.labels
  force_destroy               = false

  # Abort incomplete multipart uploads only. This is not object
  # age-delete and is not a D-020 retention decision.
  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = var.abort_incomplete_multipart_days
    }
  }
}

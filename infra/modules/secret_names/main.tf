resource "google_secret_manager_secret" "this" {
  for_each  = toset(var.secret_ids)
  project   = var.project_id
  secret_id = each.value
  labels    = var.labels

  # Secret Manager "auto" replication is the API's automatic-replication
  # block. It is not a D-020 data-residency decision.
  replication {
    auto {}
  }
}

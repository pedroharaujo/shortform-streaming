resource "google_cloud_run_v2_service" "this" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = var.ingress
  labels   = var.labels

  # Keep IAM invocation checks enabled. Do not grant allUsers.
  invoker_iam_disabled = false

  template {
    service_account = var.runtime_service_account_email

    scaling {
      min_instance_count = var.min_instance_count
    }

    containers {
      image = var.image
    }
  }
}

# P5-T06-F2 staging wiring: synthetic plans only. No credentials or apply.
mock_provider "google" {
  mock_resource "google_service_account" {
    defaults = {
      name  = "projects/example-only/serviceAccounts/example@example-only.iam.gserviceaccount.com"
      email = "example@example-only.iam.gserviceaccount.com"
    }
  }
}

variables {
  project_id           = "example-only"
  region               = "europe-west9"
  billing_account_id   = "000000-000000-000000"
  private_bucket_name  = "example-only-nonvideo"
  cloud_run_image      = "example.invalid/shortform:synthetic"
  django_allowed_hosts = "localhost"
  firebase_project_id  = "example-only"
  github_repository    = "example-org/example-repo"
  budget_amount_units  = "1"
  budget_currency_code = "EUR"
}

run "observability_is_disabled_by_default" {
  command = plan

  assert {
    condition     = length(module.observability.log_metric_names) == 0 && length(module.observability.alert_policy_ids) == 0 && module.observability.dashboard_id == null
    error_message = "Default staging must create no observability resources."
  }
  assert {
    condition     = !contains(keys(google_project_service.required), "logging.googleapis.com") && !contains(keys(google_project_service.required), "monitoring.googleapis.com")
    error_message = "Default staging must not enable observability APIs."
  }
}

run "enabled_staging_wires_observability_apis" {
  command = plan

  variables {
    observability_enabled = true
  }

  assert {
    condition     = contains(keys(google_project_service.required), "logging.googleapis.com") && contains(keys(google_project_service.required), "monitoring.googleapis.com")
    error_message = "Explicit observability enablement must include Logging and Monitoring APIs."
  }
  assert {
    condition     = toset(keys(module.observability.log_metric_names)) == toset(["request_completed", "request_duration_ms"])
    error_message = "Enabled observability must expose the two reviewed log metrics."
  }
  assert {
    condition     = length(module.observability.alert_policy_ids) == 0
    error_message = "Dashboard enablement alone must not activate alerts."
  }
}

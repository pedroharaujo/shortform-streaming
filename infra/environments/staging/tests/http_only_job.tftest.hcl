# Exercise the module option directly, even if callers supply backend settings.
mock_provider "google" {}

run "http_only_ignores_supplied_backend_configuration" {
  command = plan
  module {
    source = "../../modules/cloud_run_job"
  }
  variables {
    project_id                    = "example-only"
    region                        = "europe-west9"
    job_name                      = "example-smoke"
    image                         = "example.invalid/shortform:synthetic"
    runtime_service_account_email = "smoke@example-only.iam.gserviceaccount.com"
    include_django_configuration  = false
    django_allowed_hosts          = "example.invalid"
    firebase_project_id           = "example-only"
    video_provider                = "bunny"
    bunny_stream_library_id       = "123"
    bunny_stream_cdn_hostname     = "example.invalid"
    secret_versions = {
      DJANGO_SECRET_KEY      = "11"
      DATABASE_URL           = "12"
      BUNNY_STREAM_API_KEY   = "13"
      BUNNY_STREAM_TOKEN_KEY = "14"
    }
  }
  assert {
    condition     = length(google_cloud_run_v2_job.this.template[0].template[0].containers[0].env) == 0 && length(output.secret_references) == 0
    error_message = "Disabling Django configuration must suppress every backend env and secret even when Bunny and version pins are supplied."
  }
}

# P5-T04: entirely synthetic, no provider calls or live apply.
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
  extra_secret_ids     = ["unconsumed-example"]
}

run "defaults_exclude_unused_secrets" {
  command = plan

  assert {
    condition = toset(keys(google_secret_manager_secret_iam_member.runtime_accessor)) == toset([
      "django-secret-key", "database-url"
    ])
    error_message = "Unused Bunny and extra secret names must not grant runtime access."
  }
  assert {
    condition = alltrue([
      for refs in [module.cloud_run.secret_references, module.migrate_job.secret_references, module.smoke_job.secret_references] :
      toset(keys(refs)) == toset(["DJANGO_SECRET_KEY", "DATABASE_URL"]) &&
      refs.DJANGO_SECRET_KEY.secret == "django-secret-key" && refs.DATABASE_URL.secret == "database-url" &&
      alltrue([for ref in values(refs) : ref.version == "latest"])
    ])
    error_message = "All existing workloads must preserve default names and latest versions without Bunny injection."
  }
}

run "pin_versions_and_scope_optional_bunny_names" {
  command = plan
  variables {
    video_provider                = "bunny"
    bunny_stream_library_id       = "123"
    bunny_stream_cdn_hostname     = "example.invalid"
    bunny_stream_api_key_secret   = format("%s", "example-api")
    bunny_stream_token_key_secret = format("%s", "example-token")
    extra_secret_ids              = ["example-api", "example-token", "unconsumed-example"]
    secret_versions = {
      DJANGO_SECRET_KEY      = "11"
      DATABASE_URL           = "12"
      BUNNY_STREAM_API_KEY   = "13"
      BUNNY_STREAM_TOKEN_KEY = "14"
    }
  }

  assert {
    condition = toset(keys(google_secret_manager_secret_iam_member.runtime_accessor)) == toset([
      "django-secret-key", "database-url", "example-api", "example-token"
    ])
    error_message = "Only explicitly consumed custom Bunny names may gain access; creation alone is insufficient."
  }
  assert {
    condition = alltrue([
      for refs in [module.cloud_run.secret_references, module.migrate_job.secret_references, module.smoke_job.secret_references] :
      toset(keys(refs)) == toset(keys(var.secret_versions)) &&
      alltrue([for name, ref in refs : ref.version == var.secret_versions[name]]) &&
      refs.BUNNY_STREAM_API_KEY.secret == format("%s", "example-api") && refs.BUNNY_STREAM_TOKEN_KEY.secret == format("%s", "example-token")
    ])
    error_message = "Service, migrate and smoke must consume the selected secret names and distinct pinned versions."
  }
}

run "partial_pin_preserves_other_defaults" {
  command = plan
  variables {
    secret_versions = { DATABASE_URL = "2" }
  }
  assert {
    condition = alltrue([
      for refs in [module.cloud_run.secret_references, module.migrate_job.secret_references, module.smoke_job.secret_references] :
      refs.DATABASE_URL.version == "2" && refs.DJANGO_SECRET_KEY.version == "latest"
    ])
    error_message = "A partial version override must not alter other references."
  }
}

run "reject_unknown_selector" {
  command = plan
  variables {
    secret_versions = { DATABASE_URl = "2" }
  }
  expect_failures = [var.secret_versions]
}

run "reject_mutable_alias" {
  command = plan
  variables {
    secret_versions = { DATABASE_URL = "candidate" }
  }
  expect_failures = [var.secret_versions]
}

run "reject_zero_version" {
  command = plan
  variables {
    secret_versions = { DATABASE_URL = "0" }
  }
  expect_failures = [var.secret_versions]
}

run "reject_null_version" {
  command = plan
  variables {
    secret_versions = { DATABASE_URL = null }
  }
  expect_failures = [var.secret_versions]
}

run "reject_missing_required_name" {
  command = plan
  variables {
    secret_ids = ["django-secret-key"]
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_missing_optional_consumed_name" {
  command = plan
  variables {
    video_provider            = "bunny"
    bunny_stream_library_id   = "123"
    bunny_stream_cdn_hostname = "example.invalid"
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

# P5-T04: entirely synthetic, no provider calls or live apply.
mock_provider "google" {
  mock_data "google_project" {
    defaults = { number = "123456789012" }
  }
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
    condition = length(data.google_project.secret_access) == 0 && alltrue([
      for grant in google_secret_manager_secret_iam_member.runtime_accessor : length(grant.condition) == 0
    ])
    error_message = "Default configuration must preserve existing grants without an extra project lookup."
  }
  assert {
    condition = toset(keys(google_secret_manager_secret_iam_member.runtime_accessor)) == toset([
      "django-secret-key", "database-url"
    ])
    error_message = "Unused Bunny and extra secret names must not grant runtime access."
  }
  assert {
    condition = alltrue([
      for refs in [module.cloud_run.secret_references, module.migrate_job.secret_references] :
      toset(keys(refs)) == toset(["DJANGO_SECRET_KEY", "DATABASE_URL"]) &&
      refs.DJANGO_SECRET_KEY.secret == "django-secret-key" && refs.DATABASE_URL.secret == "database-url" &&
      alltrue([for ref in values(refs) : ref.version == "latest"])
    ])
    error_message = "Django workloads must preserve default names and latest versions without Bunny injection."
  }
  assert {
    condition     = length(module.smoke_job.secret_references) == 0 && length(module.smoke_job.environment_variable_names) == 0
    error_message = "HTTP-only smoke must not receive Django, database, Firebase or provider configuration/secrets."
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
    runtime_secret_allowed_versions = {
      django-secret-key = ["10", "11"]
      database-url      = ["12"]
      example-api       = ["13"]
      example-token     = ["14"]
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
      for secret_id, grant in google_secret_manager_secret_iam_member.runtime_accessor :
      length(grant.condition) == 1 && grant.condition[0].expression == format(
        "resource.type == 'secretmanager.googleapis.com/SecretVersion' && resource.name in %s",
        jsonencode([for version in sort(var.runtime_secret_allowed_versions[secret_id]) :
          "projects/123456789012/secrets/${secret_id}/versions/${version}"
        ])
      )
    ])
    error_message = "Every grant must restrict access to exact numeric project/secret/version names, including rollback and custom Bunny names."
  }
  assert {
    condition = alltrue([
      for refs in [module.cloud_run.secret_references, module.migrate_job.secret_references] :
      toset(keys(refs)) == toset(keys(var.secret_versions)) &&
      alltrue([for name, ref in refs : ref.version == var.secret_versions[name]]) &&
      refs.BUNNY_STREAM_API_KEY.secret == format("%s", "example-api") && refs.BUNNY_STREAM_TOKEN_KEY.secret == format("%s", "example-token")
    ])
    error_message = "Service and migrate must consume the selected secret names and distinct pinned versions."
  }
  assert {
    condition     = length(module.smoke_job.secret_references) == 0 && length(module.smoke_job.environment_variable_names) == 0
    error_message = "Enabling Bunny must not inject any configuration or secrets into HTTP-only smoke."
  }
}

run "partial_pin_preserves_other_defaults" {
  command = plan
  variables {
    secret_versions = { DATABASE_URL = "2" }
  }
  assert {
    condition = alltrue([
      for refs in [module.cloud_run.secret_references, module.migrate_job.secret_references] :
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

run "reject_shared_smoke_identity" {
  command = plan
  variables {
    runtime_service_account_id = "shortform-smoke"
  }
  expect_failures = [google_service_account.smoke]
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

run "reject_allowlist_missing_secret" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["1"] }
    secret_versions                 = {}
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_allowlist_extra_secret" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["1"], database-url = ["2"], unused = ["1"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_allowlist_latest_selector" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["1"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "latest" }
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_allowlist_omitted_selector" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["1"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1" }
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_allowlist_unlisted_selector" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["1"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "3" }
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_allowlist_empty" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = [], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_null_set" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = null, database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_null_member" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = [null], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_alias" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["latest"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_zero" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["0"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_negative" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["-1"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_leading_zero" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["01"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "reject_allowlist_text" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { django-secret-key = ["candidate"], database-url = ["2"] }
    secret_versions                 = { DJANGO_SECRET_KEY = "1", DATABASE_URL = "2" }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

run "shared_secret_requires_both_consumer_versions" {
  command = plan
  variables {
    video_provider                = "bunny"
    bunny_stream_library_id       = "123"
    bunny_stream_cdn_hostname     = "example.invalid"
    bunny_stream_api_key_secret   = format("%s", "shared-bunny")
    bunny_stream_token_key_secret = format("%s", "shared-bunny")
    extra_secret_ids              = ["shared-bunny"]
    secret_versions = {
      DJANGO_SECRET_KEY = "1", DATABASE_URL = "2", BUNNY_STREAM_API_KEY = "3", BUNNY_STREAM_TOKEN_KEY = "4"
    }
    runtime_secret_allowed_versions = { django-secret-key = ["1"], database-url = ["2"], shared-bunny = ["3"] }
  }
  expect_failures = [google_secret_manager_secret_iam_member.runtime_accessor]
}

run "reject_allowlist_invalid_secret_id" {
  command = plan
  variables {
    runtime_secret_allowed_versions = { "not/a/secret" = ["1"] }
  }
  expect_failures = [var.runtime_secret_allowed_versions]
}

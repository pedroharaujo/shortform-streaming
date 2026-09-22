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
  cloud_run_image      = "example.invalid/stovio:synthetic"
  django_allowed_hosts = "localhost"
  firebase_project_id  = "example-only"
  github_repository    = "example-org/example-repo"
  budget_amount_units  = "1"
  budget_currency_code = "EUR"
  hosted_sandbox = {
    service_name          = "example-consumer-test"
    image                 = "example.invalid/stovio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    max_instances         = 2
    revenuecat_project_id = "example-project"
    secrets = {
      DJANGO_SECRET_KEY            = { secret = format("%s", "example-django"), version = "1" }
      DATABASE_URL                 = { secret = format("%s", "example-database"), version = "2" }
      COIN_PURCHASE_PRODUCTS       = { secret = format("%s", "example-products"), version = "3" }
      COIN_PURCHASE_AUTHORIZATION  = { secret = format("%s", "example-auth"), version = "4" }
      COIN_PURCHASE_SIGNING_SECRET = { secret = format("%s", "example-signature"), version = "5" }
      REVENUECAT_API_KEY           = { secret = format("%s", "example-provider"), version = "6" }
    }
  }
}

run "disabled_creates_nothing" {
  command = plan
  variables { hosted_sandbox = null }
  assert {
    condition = (length(google_cloud_run_v2_service.hosted_sandbox) == 0 &&
      length(google_service_account.hosted_sandbox) == 0 &&
      length(google_secret_manager_secret_iam_member.hosted_sandbox) == 0
    )
    error_message = "Default must create no consumer service, identity or secret grants."
  }
}

run "private_bootstrap_has_secure_sandbox_only" {
  command = plan
  assert {
    condition = (
      google_project_iam_custom_role.hosted_sandbox_identity["consumer"].project == "example-only" &&
      toset(google_project_iam_custom_role.hosted_sandbox_identity["consumer"].permissions) == toset(["firebaseauth.users.get", "firebaseauth.users.delete"])
    )
    error_message = "Consumer identity must support revoked-token checks and account deletion without broad Firebase privileges."
  }
  assert {
    condition = (google_cloud_run_v2_service.hosted_sandbox["consumer"].ingress == "INGRESS_TRAFFIC_INTERNAL_ONLY" &&
      !google_cloud_run_v2_service.hosted_sandbox["consumer"].invoker_iam_disabled
    )
    error_message = "Bootstrap must retain private ingress and invocation authentication."
  }
  assert {
    condition = (alltrue([for name, expected in {
      DJANGO_SETTINGS_MODULE             = "config.settings.hosted_sandbox"
      COIN_PURCHASE_MODE                 = "revenuecat_sandbox"
      COIN_SPENDING_MODE                 = "revenuecat_sandbox"
      FIREBASE_AUTH_MODE                 = "admin"
      REWARDED_ADS_MODE                  = "disabled"
      REVENUECAT_SANDBOX_WEBHOOK_ENABLED = "true"
      } : one([for entry in google_cloud_run_v2_service.hosted_sandbox["consumer"].template[0].containers[0].env : entry.value if entry.name == name]) == expected])
    )
    error_message = "Consumer must use secure sandbox settings and real identity verification only."
  }
  assert {
    condition = (google_cloud_run_v2_service.hosted_sandbox["consumer"].template[0].scaling[0].min_instance_count == 0 &&
      google_cloud_run_v2_service.hosted_sandbox["consumer"].template[0].scaling[0].max_instance_count == 2 &&
      alltrue([for name, grant in google_secret_manager_secret_iam_member.hosted_sandbox :
        length(grant.condition) == 1 && strcontains(grant.condition[0].expression, "projects/123456789012/secrets/${name}/versions/")
      ])
    )
    error_message = "Sandbox needs explicit capacity and only exact numeric secret-version access."
  }
}

run "reject_public_without_app_verification" {
  command = plan
  variables {
    hosted_sandbox = merge({
      service_name          = "example-consumer-test"
      image                 = "example.invalid/stovio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      max_instances         = 2
      revenuecat_project_id = "example-project"
      secrets = {
        DJANGO_SECRET_KEY            = { secret = format("%s", "example-django"), version = "1" }
        DATABASE_URL                 = { secret = format("%s", "example-database"), version = "2" }
        COIN_PURCHASE_PRODUCTS       = { secret = format("%s", "example-products"), version = "3" }
        COIN_PURCHASE_AUTHORIZATION  = { secret = format("%s", "example-auth"), version = "4" }
        COIN_PURCHASE_SIGNING_SECRET = { secret = format("%s", "example-signature"), version = "5" }
        REVENUECAT_API_KEY           = { secret = format("%s", "example-provider"), version = "6" }
      }
    }, { public_access = true })
  }
  expect_failures = [google_cloud_run_v2_service.hosted_sandbox]
}

run "public_opt_in_keeps_staff_private" {
  command = plan
  variables {
    firebase_app_check_mode   = "enforce"
    firebase_app_check_app_id = "1:123456789012:android:synthetic"
    hosted_sandbox = merge({
      service_name          = "example-consumer-test"
      image                 = "example.invalid/stovio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      max_instances         = 2
      revenuecat_project_id = "example-project"
      secrets = {
        DJANGO_SECRET_KEY            = { secret = format("%s", "example-django"), version = "1" }
        DATABASE_URL                 = { secret = format("%s", "example-database"), version = "2" }
        COIN_PURCHASE_PRODUCTS       = { secret = format("%s", "example-products"), version = "3" }
        COIN_PURCHASE_AUTHORIZATION  = { secret = format("%s", "example-auth"), version = "4" }
        COIN_PURCHASE_SIGNING_SECRET = { secret = format("%s", "example-signature"), version = "5" }
        REVENUECAT_API_KEY           = { secret = format("%s", "example-provider"), version = "6" }
      }
    }, { public_access = true })
  }
  assert {
    condition = (google_cloud_run_v2_service.hosted_sandbox["consumer"].ingress == "INGRESS_TRAFFIC_ALL" &&
      google_cloud_run_v2_service.hosted_sandbox["consumer"].invoker_iam_disabled &&
      module.cloud_run.service_name == "stovio-api"
    )
    error_message = "Only the distinct consumer service may opt into direct public invocation."
  }
}

run "reject_secret_alias" {
  command = plan
  variables {
    hosted_sandbox = merge({
      service_name          = "example-consumer-test"
      image                 = "example.invalid/stovio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      max_instances         = 2
      revenuecat_project_id = "example-project"
      secrets = {
        DJANGO_SECRET_KEY            = { secret = format("%s", "example-django"), version = "1" }
        DATABASE_URL                 = { secret = format("%s", "example-database"), version = "2" }
        COIN_PURCHASE_PRODUCTS       = { secret = format("%s", "example-products"), version = "3" }
        COIN_PURCHASE_AUTHORIZATION  = { secret = format("%s", "example-auth"), version = "4" }
        COIN_PURCHASE_SIGNING_SECRET = { secret = format("%s", "example-signature"), version = "5" }
        REVENUECAT_API_KEY           = { secret = format("%s", "example-provider"), version = "6" }
      }
      }, {
      secrets = merge(({
        service_name          = "example-consumer-test"
        image                 = "example.invalid/stovio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        max_instances         = 2
        revenuecat_project_id = "example-project"
        secrets = {
          DJANGO_SECRET_KEY            = { secret = format("%s", "example-django"), version = "1" }
          DATABASE_URL                 = { secret = format("%s", "example-database"), version = "2" }
          COIN_PURCHASE_PRODUCTS       = { secret = format("%s", "example-products"), version = "3" }
          COIN_PURCHASE_AUTHORIZATION  = { secret = format("%s", "example-auth"), version = "4" }
          COIN_PURCHASE_SIGNING_SECRET = { secret = format("%s", "example-signature"), version = "5" }
          REVENUECAT_API_KEY           = { secret = format("%s", "example-provider"), version = "6" }
        }
        }).secrets, {
        DATABASE_URL = { secret = format("%s", "example-database"), version = "latest" }
      })
    })
  }
  expect_failures = [var.hosted_sandbox]
}

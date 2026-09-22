# P5-T04 / #101: synthetic plans; no credentials, state reads or live apply.
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

run "default_creates_no_private_route_or_compute_api" {
  command = plan
  assert {
    condition = (
      length(google_compute_network.smoke) == 0 &&
      length(google_compute_subnetwork.smoke) == 0 &&
      length(module.smoke_job.vpc_access) == 0 &&
      !contains(keys(google_project_service.required), "compute.googleapis.com")
    )
    error_message = "Default staging must add no network, subnet, VPC attachment or Compute API."
  }
}

run "opt_in_routes_only_smoke_through_private_google_access" {
  command = plan
  variables {
    smoke_private_network_enabled = true
  }
  assert {
    condition = (
      length(google_compute_network.smoke) == 1 &&
      !google_compute_network.smoke[0].auto_create_subnetworks &&
      google_compute_network.smoke[0].routing_mode == "REGIONAL" &&
      length(google_compute_subnetwork.smoke) == 1 &&
      google_compute_subnetwork.smoke[0].region == var.region &&
      google_compute_subnetwork.smoke[0].private_ip_google_access &&
      google_compute_subnetwork.smoke[0].stack_type == "IPV4_ONLY" &&
      google_compute_subnetwork.smoke[0].ip_cidr_range == "10.254.0.0/26" &&
      contains(keys(google_project_service.required), "compute.googleapis.com")
    )
    error_message = "Opt-in must create one dedicated regional IPv4 subnet with Private Google Access and enable Compute."
  }
  assert {
    condition = (
      length(module.smoke_job.vpc_access) == 1 &&
      module.smoke_job.vpc_access[0].egress == "ALL_TRAFFIC" &&
      module.smoke_job.vpc_access[0].network_interfaces[0].network == "projects/example-only/global/networks/shortform-smoke-private" &&
      module.smoke_job.vpc_access[0].network_interfaces[0].subnetwork == "projects/example-only/regions/europe-west9/subnetworks/shortform-smoke-private" &&
      length(module.migrate_job.vpc_access) == 0 &&
      length(module.smoke_job.environment_variable_names) == 0 &&
      length(module.smoke_job.secret_references) == 0
    )
    error_message = "Only HTTP smoke may attach to the exact dedicated route with ALL_TRAFFIC; no backend env or secrets may be injected."
  }
  assert {
    condition = (
      !contains(keys(google_project_service.required), "monitoring.googleapis.com") &&
      !contains(keys(google_project_service.required), "logging.googleapis.com")
    )
    error_message = "Private smoke networking must not turn on observability."
  }
}

run "reject_too_small_subnet" {
  command = plan
  variables {
    smoke_private_network_enabled = true
    smoke_private_subnet_cidr     = "10.254.0.0/27"
  }
  expect_failures = [var.smoke_private_subnet_cidr]
}

run "reject_public_subnet" {
  command = plan
  variables {
    smoke_private_network_enabled = true
    smoke_private_subnet_cidr     = "203.0.113.0/26"
  }
  expect_failures = [var.smoke_private_subnet_cidr]
}

run "reject_noncanonical_subnet" {
  command = plan
  variables {
    smoke_private_subnet_cidr = "10.254.0.1/26"
  }
  expect_failures = [var.smoke_private_subnet_cidr]
}

run "reject_malformed_subnet" {
  command = plan
  variables {
    smoke_private_subnet_cidr = "invalid"
  }
  expect_failures = [var.smoke_private_subnet_cidr]
}

run "reject_range_extending_outside_private_block" {
  command = plan
  variables {
    smoke_private_subnet_cidr = "10.0.0.0/7"
  }
  expect_failures = [var.smoke_private_subnet_cidr]
}

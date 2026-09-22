# Module validation uses synthetic resource paths and mocked provider plans.
mock_provider "google" {}

variables {
  project_id                    = "example-only"
  region                        = "europe-west9"
  job_name                      = "example-smoke"
  image                         = "example.invalid/shortform:synthetic"
  runtime_service_account_email = "smoke@example-only.iam.gserviceaccount.com"
  include_django_configuration  = false
}

run "reject_missing_network" {
  command = plan
  module {
    source = "../../modules/cloud_run_job"
  }
  variables {
    direct_vpc = {
      network    = ""
      subnetwork = "projects/example-only/regions/europe-west9/subnetworks/example-smoke"
      egress     = "ALL_TRAFFIC"
    }
  }
  expect_failures = [var.direct_vpc]
}

run "reject_missing_subnet" {
  command = plan
  module {
    source = "../../modules/cloud_run_job"
  }
  variables {
    direct_vpc = {
      network    = "projects/example-only/global/networks/example-smoke"
      subnetwork = ""
      egress     = "ALL_TRAFFIC"
    }
  }
  expect_failures = [var.direct_vpc]
}

run "reject_unspecified_routing" {
  command = plan
  module {
    source = "../../modules/cloud_run_job"
  }
  variables {
    direct_vpc = {
      network    = "projects/example-only/global/networks/example-smoke"
      subnetwork = "projects/example-only/regions/europe-west9/subnetworks/example-smoke"
      egress     = ""
    }
  }
  expect_failures = [var.direct_vpc]
}

run "reject_wrong_project" {
  command = plan
  module {
    source = "../../modules/cloud_run_job"
  }
  variables {
    direct_vpc = {
      network    = "projects/other-example/global/networks/example-smoke"
      subnetwork = "projects/example-only/regions/europe-west9/subnetworks/example-smoke"
      egress     = "ALL_TRAFFIC"
    }
  }
  expect_failures = [google_cloud_run_v2_job.this]
}

run "reject_wrong_region" {
  command = plan
  module {
    source = "../../modules/cloud_run_job"
  }
  variables {
    direct_vpc = {
      network    = "projects/example-only/global/networks/example-smoke"
      subnetwork = "projects/example-only/regions/europe-west1/subnetworks/example-smoke"
      egress     = "ALL_TRAFFIC"
    }
  }
  expect_failures = [google_cloud_run_v2_job.this]
}

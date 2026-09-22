# Exercise the local module directly with a mocked Google provider.
mock_provider "google" {}

variables {
  project_id   = "example-only"
  region       = "europe-west9"
  service_name = "shortform-api"
  job_names    = ["shortform-migrate", "shortform-smoke"]
  labels = {
    product     = "shortform"
    environment = "staging"
  }
}

run "module_disabled_default_has_zero_resources" {
  command = plan

  module {
    source = "../../modules/observability"
  }

  assert {
    condition     = length(google_logging_metric.request_completed) == 0 && length(google_logging_metric.request_duration) == 0 && length(google_monitoring_dashboard.backend) == 0
    error_message = "Disabled module must create no log metric or dashboard."
  }
  assert {
    condition     = length(google_monitoring_alert_policy.api_5xx) == 0 && length(google_monitoring_alert_policy.api_latency) == 0 && length(terraform_data.alert_configuration) == 0
    error_message = "Disabled module must create no alert resources."
  }
}

run "module_enabled_uses_only_existing_safe_signals" {
  command = plan

  module {
    source = "../../modules/observability"
  }

  variables {
    enabled = true
  }

  assert {
    condition     = length(google_logging_metric.request_completed) == 1 && length(google_logging_metric.request_duration) == 1 && length(google_monitoring_dashboard.backend) == 1
    error_message = "Enabled observability must create two reviewed log metrics and one dashboard."
  }
  assert {
    condition     = length(google_monitoring_alert_policy.api_5xx) == 0 && length(google_monitoring_alert_policy.api_latency) == 0
    error_message = "Dashboard enablement alone must not activate alerts."
  }
  assert {
    condition = alltrue([
      for metric in [
        google_logging_metric.request_completed[0],
        google_logging_metric.request_duration[0]
      ] : strcontains(metric.filter, "jsonPayload.event=\"request_completed\"") &&
      strcontains(metric.filter, "resource.type=\"cloud_run_revision\"") &&
      strcontains(metric.filter, "resource.labels.service_name") &&
      strcontains(metric.filter, "resource.labels.location") &&
      !strcontains(metric.filter, "request_id") &&
      !strcontains(lower(metric.filter), "query") &&
      !strcontains(lower(metric.filter), "authorization") &&
      toset(keys(metric.label_extractors)) == toset(["http_route", "http_status"])
    ])
    error_message = "Log metrics must use only the reviewed completion event and low-cardinality labels."
  }
  assert {
    condition = alltrue([
      for metric_type in [
        "run.googleapis.com/request_count",
        "run.googleapis.com/request_latencies",
        "run.googleapis.com/container/completed_probe_count",
        "run.googleapis.com/job/completed_execution_count",
        "logging.googleapis.com/user/shortform_request_completed",
        "logging.googleapis.com/user/shortform_request_duration_ms"
      ] : strcontains(google_monitoring_dashboard.backend[0].dashboard_json, metric_type)
    ])
    error_message = "Dashboard must chart only the documented Cloud Run and request-completion signals."
  }
  assert {
    condition = alltrue([
      for tile_index in [2, 4] :
      jsondecode(google_monitoring_dashboard.backend[0].dashboard_json).mosaicLayout.tiles[tile_index].widget.xyChart.dataSets[0].timeSeriesQuery.timeSeriesFilter.aggregation.perSeriesAligner == "ALIGN_SUM" &&
      jsondecode(google_monitoring_dashboard.backend[0].dashboard_json).mosaicLayout.tiles[tile_index].widget.xyChart.dataSets[0].timeSeriesQuery.timeSeriesFilter.aggregation.crossSeriesReducer == "REDUCE_PERCENTILE_95"
    ])
    error_message = "Latency charts must preserve distributions before reducing to p95."
  }
  assert {
    condition = alltrue([
      for forbidden in [
        "database_saturation",
        "commerce_mismatch",
        "playback_failure",
        "crashlytics",
        "transcoding",
        "cdn_error"
      ] : !strcontains(lower(google_monitoring_dashboard.backend[0].dashboard_json), forbidden)
    ])
    error_message = "Dashboard must not invent telemetry that no source emits."
  }
}

run "module_rejects_owner_that_cannot_be_a_monitoring_label" {
  command = plan

  module {
    source = "../../modules/observability"
  }

  variables {
    owner = "Platform On-call"
  }

  expect_failures = [var.owner]
}

run "module_alerts_require_operator_configuration" {
  command = plan

  module {
    source = "../../modules/observability"
  }

  variables {
    enabled        = true
    alerts_enabled = true
  }

  expect_failures = [terraform_data.alert_configuration]
}

run "module_alerts_use_operator_values" {
  command = plan

  module {
    source = "../../modules/observability"
  }

  variables {
    enabled                  = true
    alerts_enabled           = true
    notification_channel_ids = ["projects/example-only/notificationChannels/123"]
    owner                    = "staging-operations"
    severity                 = "critical"
    runbook_url              = "https://example.invalid/runbooks/api"
    api_5xx_count_threshold  = 3
    api_p95_latency_ms       = 750
  }

  assert {
    condition     = length(google_monitoring_alert_policy.api_5xx) == 1 && length(google_monitoring_alert_policy.api_latency) == 1
    error_message = "Intentional alert configuration must create exactly the two source-backed API policies."
  }
  assert {
    condition     = google_monitoring_alert_policy.api_5xx[0].conditions[0].condition_threshold[0].threshold_value == 3
    error_message = "The 5xx policy must use the operator-selected count threshold."
  }
  assert {
    condition     = google_monitoring_alert_policy.api_latency[0].conditions[0].condition_threshold[0].threshold_value == 750
    error_message = "The latency policy must use the operator-selected millisecond threshold."
  }
  assert {
    condition     = toset(google_monitoring_alert_policy.api_5xx[0].notification_channels) == toset(var.notification_channel_ids)
    error_message = "Alerts must use only the explicitly supplied notification channels."
  }
  assert {
    condition     = google_monitoring_alert_policy.api_5xx[0].user_labels.severity == "critical"
    error_message = "Alerts must use the operator-selected severity."
  }
  assert {
    condition     = google_monitoring_alert_policy.api_latency[0].conditions[0].condition_threshold[0].aggregations[0].per_series_aligner == "ALIGN_SUM" && google_monitoring_alert_policy.api_latency[0].conditions[0].condition_threshold[0].aggregations[0].cross_series_reducer == "REDUCE_PERCENTILE_95"
    error_message = "Latency aggregation must preserve request distributions before reducing to global p95."
  }
}

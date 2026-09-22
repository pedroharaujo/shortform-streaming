locals {
  monitoring_service_filter = join(" AND ", [
    "resource.type=\"cloud_run_revision\"",
    "resource.label.service_name=\"${var.service_name}\"",
    "resource.label.location=\"${var.region}\"",
  ])

  request_log_filter = join(" AND ", [
    "resource.type=\"cloud_run_revision\"",
    "resource.labels.service_name=\"${var.service_name}\"",
    "resource.labels.location=\"${var.region}\"",
    "jsonPayload.event=\"request_completed\"",
  ])

  job_filter = length(var.job_names) == 0 ? "resource.type=\"cloud_run_job\"" : join(" AND ", [
    "resource.type=\"cloud_run_job\"",
    "resource.label.location=\"${var.region}\"",
    "(${join(" OR ", [for job_name in sort(tolist(var.job_names)) : "resource.label.job_name=\"${job_name}\""])})",
  ])

  metric_labels = {
    http_route  = "EXTRACT(jsonPayload.http_route)"
    http_status = "EXTRACT(jsonPayload.http_status)"
  }

  dashboard_json = jsonencode({
    displayName = "Shortform staging backend"
    labels      = var.labels
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          xPos   = 0
          yPos   = 0
          width  = 6
          height = 4
          widget = {
            title = "API requests per second"
            xyChart = {
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND ${local.monitoring_service_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              yAxis = {
                label = "requests/s"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 6
          yPos   = 0
          width  = 6
          height = 4
          widget = {
            title = "API 5xx responses per minute"
            xyChart = {
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND metric.label.response_code_class=\"5xx\" AND ${local.monitoring_service_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              yAxis = {
                label = "responses/min"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 0
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "API p95 latency"
            xyChart = {
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_latencies\" AND ${local.monitoring_service_filter}"
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_PERCENTILE_95"
                    }
                  }
                }
              }]
              yAxis = {
                label = "ms"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 6
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Request completions by route"
            xyChart = {
              dataSets = [{
                plotType   = "STACKED_BAR"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/shortform_request_completed\" AND ${local.monitoring_service_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.http_route"]
                    }
                  }
                }
              }]
              yAxis = {
                label = "requests/s"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 0
          yPos   = 8
          width  = 6
          height = 4
          widget = {
            title = "Request p95 duration by route"
            xyChart = {
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/shortform_request_duration_ms\" AND ${local.monitoring_service_filter}"
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      groupByFields      = ["metric.label.http_route"]
                    }
                  }
                }
              }]
              yAxis = {
                label = "ms"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 6
          yPos   = 8
          width  = 6
          height = 4
          widget = {
            title = "Unhealthy container probes"
            xyChart = {
              dataSets = [{
                plotType   = "STACKED_BAR"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/completed_probe_count\" AND metric.label.is_healthy=false AND ${local.monitoring_service_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.probe_type"]
                    }
                  }
                }
              }]
              yAxis = {
                label = "failed probes/min"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 0
          yPos   = 12
          width  = 12
          height = 4
          widget = {
            title = "Cloud Run job completion outcomes"
            xyChart = {
              dataSets = [{
                plotType   = "STACKED_BAR"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/job/completed_execution_count\" AND ${local.job_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["resource.label.job_name", "metric.label.result"]
                    }
                  }
                }
              }]
              yAxis = {
                label = "executions/min"
                scale = "LINEAR"
              }
            }
          }
        },
      ]
    }
  })
}

resource "google_logging_metric" "request_completed" {
  count = var.enabled ? 1 : 0

  project     = var.project_id
  name        = "shortform_request_completed"
  description = "Privacy-safe request completions emitted by shortform.request."
  filter      = local.request_log_filter

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"

    labels {
      key         = "http_route"
      value_type  = "STRING"
      description = "Bounded Django route template or coarse route family."
    }
    labels {
      key         = "http_status"
      value_type  = "INT64"
      description = "Numeric HTTP response status."
    }
  }

  label_extractors = local.metric_labels
}

resource "google_logging_metric" "request_duration" {
  count = var.enabled ? 1 : 0

  project         = var.project_id
  name            = "shortform_request_duration_ms"
  description     = "Privacy-safe request duration emitted by shortform.request."
  filter          = local.request_log_filter
  value_extractor = "EXTRACT(jsonPayload.duration_ms)"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"

    labels {
      key         = "http_route"
      value_type  = "STRING"
      description = "Bounded Django route template or coarse route family."
    }
    labels {
      key         = "http_status"
      value_type  = "INT64"
      description = "Numeric HTTP response status."
    }
  }

  bucket_options {
    exponential_buckets {
      num_finite_buckets = 20
      growth_factor      = 2
      scale              = 1
    }
  }

  label_extractors = local.metric_labels
}

resource "google_monitoring_dashboard" "backend" {
  count = var.enabled ? 1 : 0

  project        = var.project_id
  dashboard_json = local.dashboard_json

  depends_on = [
    google_logging_metric.request_completed,
    google_logging_metric.request_duration,
  ]
}

resource "terraform_data" "alert_configuration" {
  count = var.alerts_enabled ? 1 : 0

  lifecycle {
    precondition {
      condition     = var.enabled
      error_message = "alerts_enabled requires enabled=true."
    }
    precondition {
      condition     = length(var.notification_channel_ids) > 0
      error_message = "alerts_enabled requires at least one existing notification channel."
    }
    precondition {
      condition     = length(trimspace(var.owner)) > 0 && !strcontains(lower(var.owner), "placeholder") && !strcontains(lower(var.owner), "unassigned")
      error_message = "alerts_enabled requires a non-placeholder operational owner."
    }
    precondition {
      condition     = contains(["info", "warning", "critical"], var.severity)
      error_message = "alerts_enabled requires an explicit info, warning, or critical severity."
    }
    precondition {
      condition     = can(regex("^https://", var.runbook_url))
      error_message = "alerts_enabled requires an HTTPS runbook_url."
    }
    precondition {
      condition     = try(var.api_5xx_count_threshold > 0, false)
      error_message = "alerts_enabled requires a positive api_5xx_count_threshold."
    }
    precondition {
      condition     = try(var.api_p95_latency_ms > 0, false)
      error_message = "alerts_enabled requires a positive api_p95_latency_ms."
    }
  }
}

resource "google_monitoring_alert_policy" "api_5xx" {
  count = var.enabled && var.alerts_enabled ? 1 : 0

  project               = var.project_id
  display_name          = "Shortform staging API 5xx"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channel_ids
  user_labels           = merge(var.labels, { owner = var.owner, severity = var.severity })

  documentation {
    mime_type = "text/markdown"
    content   = "Owner: ${var.owner}\n\nSeverity: ${var.severity}\n\nRunbook: ${var.runbook_url}"
  }

  conditions {
    display_name = "5xx responses exceed the operator threshold"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" AND metric.label.response_code_class=\"5xx\" AND ${local.monitoring_service_filter}"
      comparison      = "COMPARISON_GT"
      duration        = "0s"
      threshold_value = var.api_5xx_count_threshold

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  depends_on = [terraform_data.alert_configuration]
}

resource "google_monitoring_alert_policy" "api_latency" {
  count = var.enabled && var.alerts_enabled ? 1 : 0

  project               = var.project_id
  display_name          = "Shortform staging API p95 latency"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channel_ids
  user_labels           = merge(var.labels, { owner = var.owner, severity = var.severity })

  documentation {
    mime_type = "text/markdown"
    content   = "Owner: ${var.owner}\n\nSeverity: ${var.severity}\n\nRunbook: ${var.runbook_url}"
  }

  conditions {
    display_name = "p95 latency exceeds the operator threshold"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_latencies\" AND ${local.monitoring_service_filter}"
      comparison      = "COMPARISON_GT"
      duration        = "300s"
      threshold_value = var.api_p95_latency_ms

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
      }

      trigger {
        count = 1
      }
    }
  }

  depends_on = [terraform_data.alert_configuration]
}

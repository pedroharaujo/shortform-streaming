output "dashboard_id" {
  description = "Monitoring dashboard ID when enabled, otherwise null."
  value       = try(google_monitoring_dashboard.backend[0].id, null)
}

output "log_metric_names" {
  description = "Project log-metric names created by this module."
  value = var.enabled ? {
    request_completed   = google_logging_metric.request_completed[0].name
    request_duration_ms = google_logging_metric.request_duration[0].name
  } : {}
}

output "alert_policy_ids" {
  description = "Monitoring alert-policy IDs when intentionally enabled."
  value = var.enabled && var.alerts_enabled ? {
    api_5xx     = google_monitoring_alert_policy.api_5xx[0].id
    api_latency = google_monitoring_alert_policy.api_latency[0].id
  } : {}
}


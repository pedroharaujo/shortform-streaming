module "observability" {
  source = "../../modules/observability"

  enabled                  = var.observability_enabled
  alerts_enabled           = var.observability_alerts_enabled
  project_id               = var.project_id
  region                   = var.region
  service_name             = var.cloud_run_service_name
  job_names                = [var.migrate_job_name, var.smoke_job_name]
  labels                   = local.labels
  notification_channel_ids = var.observability_notification_channel_ids
  owner                    = var.observability_owner
  severity                 = var.observability_severity
  runbook_url              = var.observability_runbook_url
  api_5xx_count_threshold  = var.observability_api_5xx_count_threshold
  api_p95_latency_ms       = var.observability_api_p95_latency_ms

  depends_on = [
    google_project_service.required,
    module.cloud_run,
    module.migrate_job,
    module.smoke_job,
  ]
}

variable "enabled" {
  type        = bool
  description = "Create the offline-reviewed monitoring foundation. False creates no resources."
  default     = false
}

variable "alerts_enabled" {
  type        = bool
  description = "Create API alert policies after every operator-owned input is supplied."
  default     = false
}

variable "project_id" {
  type        = string
  description = "GCP project ID containing the monitored Cloud Run resources."
}

variable "region" {
  type        = string
  description = "Caller-selected Cloud Run location. This module does not approve D-020."
}

variable "service_name" {
  type        = string
  description = "Existing Cloud Run service whose platform and application signals are charted."
}

variable "job_names" {
  type        = set(string)
  description = "Existing Cloud Run jobs whose completion outcomes are charted by documented result label."
  default     = []
}

variable "labels" {
  type        = map(string)
  description = "Low-cardinality resource labels."
  default     = {}
}

variable "notification_channel_ids" {
  type        = list(string)
  description = "Existing Monitoring notification-channel resource names. The module creates no channels."
  default     = []

  validation {
    condition = alltrue([
      for channel in var.notification_channel_ids :
      can(regex("^projects/[^/]+/notificationChannels/[^/]+$", channel))
    ])
    error_message = "notification_channel_ids must be full Monitoring notification-channel resource names."
  }
}

variable "owner" {
  type        = string
  description = "Operational owner label. Required and non-placeholder when alerts are enabled."
  default     = ""

  validation {
    condition     = var.owner == "" || can(regex("^[a-z][a-z0-9_-]{0,62}$", var.owner))
    error_message = "owner must be empty or a lowercase Monitoring label value of at most 63 characters."
  }
}

variable "severity" {
  type        = string
  description = "Operator-selected alert severity. Required when alerts are enabled."
  default     = ""

  validation {
    condition     = contains(["", "info", "warning", "critical"], var.severity)
    error_message = "severity must be empty, info, warning, or critical."
  }
}

variable "runbook_url" {
  type        = string
  description = "HTTPS incident runbook URL. Required when alerts are enabled."
  default     = ""
}

variable "api_5xx_count_threshold" {
  type        = number
  description = "Operator-selected 5xx count in one minute that opens an incident. No default."
  default     = null
  nullable    = true
}

variable "api_p95_latency_ms" {
  type        = number
  description = "Operator-selected p95 request latency in milliseconds over five minutes. No default."
  default     = null
  nullable    = true
}

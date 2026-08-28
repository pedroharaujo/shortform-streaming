variable "project_id" {
  type        = string
  description = "GCP project ID. Required with no default. Not a D-020/D-025 approval."
}

variable "region" {
  type        = string
  description = "GCP region for regional resources. Required with no default. Supplying a region at apply time is not a D-020 residency approval."
}

variable "billing_account_id" {
  type        = string
  description = "Cloud Billing account ID. Required with no default. Not a D-024/D-025 legal-entity or registration approval."
}

variable "label_product" {
  type        = string
  description = "Product label."
  default     = "shortform"
}

variable "label_environment" {
  type        = string
  description = "Environment label."
  default     = "staging"
}

variable "label_owner" {
  type        = string
  description = "Owner label placeholder. Not a staffing or legal-entity decision."
  default     = "engineering-placeholder"
}

variable "label_cost_center" {
  type        = string
  description = "Cost-center label placeholder. Not a finance or D-022 currency decision."
  default     = "unassigned-placeholder"
}

variable "artifact_registry_repository_id" {
  type        = string
  description = "Docker Artifact Registry repository ID."
  default     = "shortform"
}

variable "private_bucket_name" {
  type        = string
  description = "Globally unique private non-video bucket name. Not a video origin."
}

variable "cloud_run_service_name" {
  type        = string
  description = "Cloud Run service name. No custom domain or DNS."
  default     = "shortform-api"
}

variable "cloud_run_image" {
  type        = string
  description = "Container image URI. Required with no public hello-world default. Example values belong in staging.tfvars.example only."
}

variable "runtime_service_account_id" {
  type        = string
  description = "Account ID for the dedicated Cloud Run runtime service account."
  default     = "shortform-runtime"
}

variable "secret_ids" {
  type        = list(string)
  description = "Secret Manager secret_id values to create (names only, including Bunny Stream credential names). No versions or values."
  default     = ["bunny-stream-api-key"]
}

variable "extra_secret_ids" {
  type        = list(string)
  description = "Optional additional secret_id values to create (names only)."
  default     = []
}

variable "budget_amount_units" {
  type        = string
  description = "Budget amount in whole currency units as a string. Required with no default; not a D-022 EUR approval."
}

variable "budget_currency_code" {
  type        = string
  description = "ISO 4217 currency code for the budget. Required with no default; not a D-022 EUR approval."
}

variable "budget_actual_threshold_percent" {
  type        = number
  description = "Threshold percent for actual (CURRENT_SPEND) budget alerts."
  default     = 0.5
}

variable "budget_forecast_threshold_percent" {
  type        = number
  description = "Threshold percent for forecast (FORECASTED_SPEND) budget alerts."
  default     = 1.0
}

variable "budget_notification_channel_ids" {
  type        = list(string)
  description = "Optional Monitoring notification channel IDs for budget updates. Empty by default."
  default     = []
}

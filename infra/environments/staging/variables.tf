variable "smoke_private_network_enabled" {
  type        = bool
  description = "Opt in to the dedicated staging smoke Direct VPC route and Compute API. Required before HTTP smoke can reach internal-only Cloud Run."
  default     = false
  nullable    = false
}

variable "smoke_private_subnet_cidr" {
  type        = string
  description = "Dedicated smoke IPv4 RFC1918 subnet, /26 or larger. Verify no overlap before enabling; this subnet is not shared with other workloads."
  default     = "10.254.0.0/26"
  nullable    = false

  validation {
    condition = try(
      cidrhost(var.smoke_private_subnet_cidr, 0) == split("/", var.smoke_private_subnet_cidr)[0] &&
      tonumber(split("/", var.smoke_private_subnet_cidr)[1]) <= 26 && (
        (can(regex("^10\\.", var.smoke_private_subnet_cidr)) && tonumber(split("/", var.smoke_private_subnet_cidr)[1]) >= 8) ||
        (can(regex("^172\\.(1[6-9]|2[0-9]|3[01])\\.", var.smoke_private_subnet_cidr)) && tonumber(split("/", var.smoke_private_subnet_cidr)[1]) >= 12) ||
        (can(regex("^192\\.168\\.", var.smoke_private_subnet_cidr)) && tonumber(split("/", var.smoke_private_subnet_cidr)[1]) >= 16)
      ), false
    )
    error_message = "smoke_private_subnet_cidr must be a canonical RFC1918 IPv4 network CIDR with at least a /26 subnet (64 addresses)."
  }
}

variable "secret_versions" {
  type        = map(string)
  description = "Secret version selectors by runtime env name, never values. Omitted entries use latest for compatibility; pin positive numeric versions before rotation."
  default     = {}
  nullable    = false

  validation {
    condition = length(setsubtract(toset(keys(var.secret_versions)), toset([
      "DJANGO_SECRET_KEY", "DATABASE_URL", "BUNNY_STREAM_API_KEY", "BUNNY_STREAM_TOKEN_KEY"
      ]))) == 0 && alltrue([
      for version in values(var.secret_versions) : can(regex("^(latest|[1-9][0-9]*)$", version))
    ])
    error_message = "secret_versions accepts only the four supported runtime env names and latest or positive numeric version strings."
  }
}

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

variable "django_allowed_hosts" {
  type        = string
  description = "Comma-separated DJANGO_ALLOWED_HOSTS for Cloud Run and jobs. Required with no default."
}

variable "firebase_project_id" {
  type        = string
  description = "FIREBASE_PROJECT_ID for Cloud Run and jobs. Required with no default."
}

variable "firebase_app_check_mode" {
  type        = string
  description = "FIREBASE_APP_CHECK_MODE for the API service. Keep disabled until P5-T05-F3 provider/device validation passes."
  default     = "disabled"

  validation {
    condition     = contains(["disabled", "enforce"], var.firebase_app_check_mode)
    error_message = "firebase_app_check_mode must be disabled or enforce."
  }
}

variable "firebase_app_check_app_id" {
  type        = string
  description = "Public Firebase Android app ID for exact App Check subject validation."
  default     = ""

  validation {
    condition     = var.firebase_app_check_mode == "disabled" || length(trimspace(var.firebase_app_check_app_id)) > 0
    error_message = "firebase_app_check_app_id is required when App Check enforcement is enabled."
  }
}

variable "video_provider" {
  type        = string
  description = "Optional video provider. Empty default injects no Bunny env into Cloud Run or jobs."
  default     = ""

  validation {
    condition     = var.video_provider == "" || var.video_provider == "bunny"
    error_message = "video_provider must be empty or bunny."
  }
}

variable "bunny_stream_library_id" {
  type        = string
  description = "Non-secret Bunny library ID; used only when video_provider is bunny."
  default     = ""
}

variable "bunny_stream_cdn_hostname" {
  type        = string
  description = "Non-secret Bunny CDN hostname; used only when video_provider is bunny."
  default     = ""
}

variable "bunny_stream_api_key_secret" {
  type        = string
  description = "Consumed Bunny API secret_id; must be created through secret_ids or extra_secret_ids when Bunny is enabled."
  default     = "bunny-stream-api-key"
}

variable "bunny_stream_token_key_secret" {
  type        = string
  description = "Consumed Bunny token secret_id; must be created through secret_ids or extra_secret_ids when Bunny is enabled."
  default     = "bunny-stream-token-key"
}

variable "github_repository" {
  type        = string
  description = "GitHub owner/repo allowed to federate. Real name belongs in gitignored tfvars and the runbook, not committed .tf."
}

variable "github_environment" {
  type        = string
  description = "GitHub Environment name required on the OIDC token."
  default     = "staging"
}

variable "migrate_job_name" {
  type        = string
  description = "Cloud Run Job that runs the image migrate entrypoint before traffic."
  default     = "shortform-migrate"
}

variable "smoke_job_name" {
  type        = string
  description = "Cloud Run Job that smokes an untrafficked candidate revision from inside the project."
  default     = "shortform-smoke"
}

variable "secret_ids" {
  type        = list(string)
  description = "Secret Manager secret_id values to create (names only, including Bunny Stream credential names). No versions or values."
  default     = ["bunny-stream-api-key", "django-secret-key", "database-url"]
}

variable "extra_secret_ids" {
  type        = list(string)
  description = "Optional additional secret_id values to create (names only). Creation never grants runtime access unless explicitly consumed."
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

variable "observability_enabled" {
  type        = bool
  description = "Create reviewed staging log metrics and dashboard. Disabled by default pending intentional apply."
  default     = false
}

variable "observability_alerts_enabled" {
  type        = bool
  description = "Create API alert policies after operator channels, owner, runbook and thresholds are supplied."
  default     = false
}

variable "observability_notification_channel_ids" {
  type        = list(string)
  description = "Existing Monitoring notification-channel resource names. Empty by default."
  default     = []
}

variable "observability_owner" {
  type        = string
  description = "Operational alert owner. Empty until a real owner is assigned."
  default     = ""
}

variable "observability_severity" {
  type        = string
  description = "Operator-selected alert severity. Empty until alerts are intentionally configured."
  default     = ""

  validation {
    condition     = contains(["", "info", "warning", "critical"], var.observability_severity)
    error_message = "observability_severity must be empty, info, warning, or critical."
  }
}

variable "observability_runbook_url" {
  type        = string
  description = "HTTPS operational runbook URL. Empty until a reachable runbook is assigned."
  default     = ""
}

variable "observability_api_5xx_count_threshold" {
  type        = number
  description = "Operator-selected API 5xx count per minute. Null means no approved threshold."
  default     = null
  nullable    = true
}

variable "observability_api_p95_latency_ms" {
  type        = number
  description = "Operator-selected API p95 latency threshold in milliseconds. Null means no approved threshold."
  default     = null
  nullable    = true
}

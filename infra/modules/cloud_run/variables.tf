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
  description = "GCP project ID. Required with no default; not a D-025 registration decision."
}

variable "region" {
  type        = string
  description = "Cloud Run location. Required with no default; not a D-020 residency approval."
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name. No custom domain or DNS is attached."
}

variable "image" {
  type        = string
  description = "Container image URI from Artifact Registry. No public hello-world default."

  validation {
    condition = !contains(
      [
        "us-docker.pkg.dev/cloudrun/container/hello",
        "gcr.io/cloudrun/hello",
      ],
      var.image
    )
    error_message = "Cloud Run image must not be a public Cloud Run hello-world image."
  }
}

variable "runtime_service_account_email" {
  type        = string
  description = "Dedicated runtime service account email. Deploy/WIF identities are a separate SA."
}

variable "labels" {
  type        = map(string)
  description = "Resource labels (product, environment, owner, cost_center)."
  default     = {}
}

variable "min_instance_count" {
  type        = number
  description = "Minimum instances. Staging stays at zero unless scaled by traffic."
  default     = 0
}

variable "ingress" {
  type        = string
  description = "Ingress restriction. Public activation stays off."
  default     = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  validation {
    condition     = var.ingress == "INGRESS_TRAFFIC_INTERNAL_ONLY"
    error_message = "Public ingress is out of scope; ingress must remain INGRESS_TRAFFIC_INTERNAL_ONLY."
  }
}

variable "django_settings_module" {
  type        = string
  description = "Django settings module injected as plain env. Do not set PORT."
  default     = "config.settings.production"
}

variable "django_allowed_hosts" {
  type        = string
  description = "Comma-separated DJANGO_ALLOWED_HOSTS. Required with no default."
}

variable "firebase_project_id" {
  type        = string
  description = "FIREBASE_PROJECT_ID plain env. Required with no default."
}

variable "firebase_app_check_mode" {
  type        = string
  description = "App Check enforcement switch. Keep disabled until provider/device evidence passes."
  default     = "disabled"

  validation {
    condition     = contains(["disabled", "enforce"], var.firebase_app_check_mode)
    error_message = "firebase_app_check_mode must be disabled or enforce."
  }
}

variable "firebase_app_check_app_id" {
  type        = string
  description = "Public Firebase Android app ID. Required before App Check enforcement."
  default     = ""

  validation {
    condition     = var.firebase_app_check_mode == "disabled" || length(trimspace(var.firebase_app_check_app_id)) > 0
    error_message = "firebase_app_check_app_id is required when App Check enforcement is enabled."
  }
}

variable "video_provider" {
  type        = string
  description = "Optional video provider. Empty default injects no Bunny env. Only bunny is supported."
  default     = ""

  validation {
    condition     = var.video_provider == "" || var.video_provider == "bunny"
    error_message = "video_provider must be empty or bunny."
  }
}

variable "bunny_stream_library_id" {
  type        = string
  description = "Bunny Stream library id. Injected only when video_provider is bunny."
  default     = ""
}

variable "bunny_stream_cdn_hostname" {
  type        = string
  description = "Bunny Stream CDN hostname. Injected only when video_provider is bunny."
  default     = ""
}

variable "bunny_stream_api_key_secret" {
  type        = string
  description = "Secret Manager secret_id for BUNNY_STREAM_API_KEY. Used only when video_provider is bunny."
  default     = "bunny-stream-api-key"
}

variable "bunny_stream_token_key_secret" {
  type        = string
  description = "Secret Manager secret_id for BUNNY_STREAM_TOKEN_KEY. Used only when video_provider is bunny."
  default     = "bunny-stream-token-key"
}

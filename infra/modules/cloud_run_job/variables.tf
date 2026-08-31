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
  description = "Cloud Run job location. Required with no default; not a D-020 residency approval."
}

variable "job_name" {
  type        = string
  description = "Cloud Run job name."
}

variable "image" {
  type        = string
  description = "Container image URI from Artifact Registry. CI owns the digest after apply."

  validation {
    condition = !contains(
      [
        "us-docker.pkg.dev/cloudrun/container/hello",
        "gcr.io/cloudrun/hello",
      ],
      var.image
    )
    error_message = "Cloud Run job image must not be a public Cloud Run hello-world image."
  }
}

variable "runtime_service_account_email" {
  type        = string
  description = "Dedicated runtime service account email. Jobs must not run as the deploy/WIF SA."
}

variable "labels" {
  type        = map(string)
  description = "Resource labels (product, environment, owner, cost_center)."
  default     = {}
}

variable "command" {
  type        = list(string)
  description = "Optional container command. Empty keeps the image entrypoint."
  default     = []
}

variable "args" {
  type        = list(string)
  description = "Optional container args. Empty keeps the image command."
  default     = []
}

variable "max_retries" {
  type        = number
  description = "Task retries. Deploy migrate and smoke use 0."
  default     = 0
}

variable "django_settings_module" {
  type        = string
  description = "Django settings module injected as plain env."
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

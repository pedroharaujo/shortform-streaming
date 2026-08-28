variable "project_id" {
  type        = string
  description = "GCP project ID. Required with no default; not a D-025 registration decision."
}

variable "github_repository" {
  type        = string
  description = "GitHub owner/repo that may federate. No default. Example values belong in tfvars.example only."

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must match owner/repo."
  }
}

variable "github_ref" {
  type        = string
  description = "Exact git ref that may federate."
  default     = "refs/heads/main"

  validation {
    condition     = can(regex("^[A-Za-z0-9._/-]+$", var.github_ref))
    error_message = "github_ref must be an exact git ref using letters, digits, dot, underscore, slash, or hyphen only."
  }
}

variable "github_environment" {
  type        = string
  description = "Exact GitHub Environment name that must appear on the OIDC token."

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]+$", var.github_environment))
    error_message = "github_environment must use letters, digits, dot, underscore, or hyphen only."
  }
}

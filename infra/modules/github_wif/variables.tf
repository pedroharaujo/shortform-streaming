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
}

variable "github_environment" {
  type        = string
  description = "Exact GitHub Environment name that must appear on the OIDC token."
}

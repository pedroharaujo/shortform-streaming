variable "project_id" {
  type        = string
  description = "GCP project ID. Required with no default; not a D-025 registration decision."
}

variable "secret_ids" {
  type        = list(string)
  description = "Secret Manager secret_id values to create (names only). No versions or secret values are provisioned."

  validation {
    condition     = length(var.secret_ids) > 0
    error_message = "At least one secret_id is required (names only, no values)."
  }
}

variable "labels" {
  type        = map(string)
  description = "Resource labels (product, environment, owner, cost_center)."
  default     = {}
}

variable "project_id" {
  type        = string
  description = "GCP project ID. Required with no default; not a D-025 registration decision."
}

variable "region" {
  type        = string
  description = "Artifact Registry location. Required with no default; not a D-020 residency approval."
}

variable "repository_id" {
  type        = string
  description = "Repository ID for the single Docker Artifact Registry repository."
}

variable "description" {
  type        = string
  description = "Human-readable repository description."
  default     = "Staging container images. Not a public registry."
}

variable "labels" {
  type        = map(string)
  description = "Resource labels (product, environment, owner, cost_center)."
  default     = {}
}

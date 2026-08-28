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
  description = "Dedicated runtime service account email. Deploy/WIF identities are out of scope."
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

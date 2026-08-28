variable "project_id" {
  type        = string
  description = "GCP project ID. Required with no default; not a D-025 registration decision."
}

variable "region" {
  type        = string
  description = "Bucket location. Required with no default; not a D-020 residency approval."
}

variable "bucket_name" {
  type        = string
  description = "Globally unique bucket name. This bucket is not a video origin and must stay private."
}

variable "labels" {
  type        = map(string)
  description = "Resource labels (product, environment, owner, cost_center)."
  default     = {}
}

variable "abort_incomplete_multipart_days" {
  type        = number
  description = "Days after which incomplete multipart uploads are aborted. Not an object age-delete / D-020 retention policy."
  default     = 7
}

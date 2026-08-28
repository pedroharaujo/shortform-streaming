# Partial GCS backend. Real bucket/prefix are supplied at init via a local
# backend.hcl copied from backend.hcl.example (gitignored; never commit a
# real bucket name).
#
# GCS encrypts objects at rest by default. Optional CMEK/KMS for state is
# P5-T01-B / GitHub issue #71. The state bucket is NOT managed here.
terraform {
  backend "gcs" {}
}

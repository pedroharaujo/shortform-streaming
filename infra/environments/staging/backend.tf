# Partial GCS backend. Real bucket/prefix are supplied at init via a local
# backend.hcl copied from backend.hcl.example (gitignored; never commit a
# real bucket name).
#
# GCS encrypts objects at rest by default. KMS/CMEK for state was not added.
# The state bucket is NOT managed here.
terraform {
  backend "gcs" {}
}

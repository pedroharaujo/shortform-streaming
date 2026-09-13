# P5-T04 / #101: only the HTTP-only smoke job uses this private route.
# Keep the default internet-gateway route: Private Google Access uses it to
# reach Google's run.app frontend without NAT or public job IP addresses.
resource "google_compute_network" "smoke" {
  count                   = var.smoke_private_network_enabled ? 1 : 0
  project                 = var.project_id
  name                    = "${var.smoke_job_name}-private"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  description             = "Dedicated private route for staging HTTP smoke."

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "smoke" {
  count                    = var.smoke_private_network_enabled ? 1 : 0
  project                  = var.project_id
  region                   = var.region
  name                     = "${var.smoke_job_name}-private"
  network                  = google_compute_network.smoke[0].id
  ip_cidr_range            = var.smoke_private_subnet_cidr
  private_ip_google_access = true
  stack_type               = "IPV4_ONLY"
  description              = "Private Google Access for the staging smoke job."
}

# Same-project Direct VPC uses the existing Cloud Run service agent's
# roles/run.serviceAgent permissions. Do not give the smoke runtime identity
# Compute roles, or add a redundant project-wide roles/compute.networkUser.

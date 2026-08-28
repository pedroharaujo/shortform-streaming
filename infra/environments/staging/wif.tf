module "github_wif" {
  source = "../../modules/github_wif"

  project_id         = var.project_id
  github_repository  = var.github_repository
  github_environment = var.github_environment

  depends_on = [google_project_service.required]
}

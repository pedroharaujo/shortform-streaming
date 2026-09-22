# #121 / #164: a separate consumer-only test service. Null creates nothing.
# Bootstrap privately, verify the image, then approve public_access separately.
variable "hosted_sandbox" {
  type = object({
    service_name          = string
    image                 = string
    max_instances         = number
    public_access         = optional(bool, false)
    revenuecat_project_id = string
    secrets = map(object({
      secret  = string
      version = string
    }))
  })
  default     = null
  description = "Opt-in hosted Android SANDBOX only. Secret names/versions, never values. An image digest containing hosted_sandbox settings is required. No live changes are authorized by supplying this object."

  validation {
    condition = var.hosted_sandbox == null ? true : (
      can(regex("^[a-z][a-z0-9-]{0,47}$", var.hosted_sandbox.service_name)) &&
      var.hosted_sandbox.service_name != var.cloud_run_service_name &&
      can(regex("@sha256:[a-f0-9]{64}$", var.hosted_sandbox.image)) &&
      contains([1, 2, 3], var.hosted_sandbox.max_instances) &&
      can(regex("^[A-Za-z0-9_-]{1,128}$", var.hosted_sandbox.revenuecat_project_id)) &&
      toset(keys(var.hosted_sandbox.secrets)) == toset(concat([
        "DJANGO_SECRET_KEY", "DATABASE_URL", "COIN_PURCHASE_PRODUCTS",
        "COIN_PURCHASE_AUTHORIZATION", "COIN_PURCHASE_SIGNING_SECRET", "REVENUECAT_API_KEY"
      ], var.video_provider == "bunny" ? ["BUNNY_STREAM_API_KEY", "BUNNY_STREAM_TOKEN_KEY"] : [])) &&
      alltrue([for ref in values(var.hosted_sandbox.secrets) :
        can(regex("^[A-Za-z0-9_-]{1,255}$", ref.secret)) && can(regex("^[1-9][0-9]*$", ref.version))
      ])
    )
    error_message = "Hosted sandbox needs a distinct valid service, immutable image digest, 1–3 instances, RevenueCat project, and exactly the consumed secrets with numeric versions."
  }
}

locals {
  hosted_sandbox_services = var.hosted_sandbox == null ? {} : { consumer = var.hosted_sandbox }
  hosted_sandbox_environment = merge({
    DJANGO_SETTINGS_MODULE = "config.settings.hosted_sandbox"
    # Google controls this HTTPS namespace, including tagged candidate addresses.
    DJANGO_ALLOWED_HOSTS               = "localhost,.run.app"
    FIREBASE_AUTH_MODE                 = "admin"
    FIREBASE_PROJECT_ID                = var.firebase_project_id
    FIREBASE_APP_CHECK_MODE            = var.firebase_app_check_mode
    FIREBASE_APP_CHECK_APP_ID          = var.firebase_app_check_app_id
    COIN_PURCHASE_MODE                 = "revenuecat_sandbox"
    COIN_SPENDING_MODE                 = "revenuecat_sandbox"
    REVENUECAT_SANDBOX_WEBHOOK_ENABLED = "true"
    REWARDED_ADS_MODE                  = "disabled"
    }, var.video_provider == "bunny" ? {
    VIDEO_PROVIDER            = "bunny"
    BUNNY_STREAM_LIBRARY_ID   = var.bunny_stream_library_id
    BUNNY_STREAM_CDN_HOSTNAME = var.bunny_stream_cdn_hostname
  } : {})
}

data "google_project" "hosted_sandbox" {
  for_each   = local.hosted_sandbox_services
  project_id = var.project_id
}

resource "google_service_account" "hosted_sandbox" {
  for_each     = local.hosted_sandbox_services
  project      = var.project_id
  account_id   = "stovio-consumer-test"
  display_name = "Consumer sandbox runtime, no staff storage access"
  depends_on   = [google_project_service.required]
}

# Firebase can be a distinct project. These are needed by existing revoked-token
# verification and the authenticated account-deletion flow, not sign-in itself.
resource "google_project_iam_custom_role" "hosted_sandbox_identity" {
  for_each    = local.hosted_sandbox_services
  project     = var.firebase_project_id
  role_id     = "stovioConsumerSandboxIdentity"
  title       = "Consumer sandbox Firebase account lifecycle"
  permissions = ["firebaseauth.users.get", "firebaseauth.users.delete"]
}

resource "google_project_iam_member" "hosted_sandbox_identity" {
  for_each = local.hosted_sandbox_services
  project  = var.firebase_project_id
  role     = google_project_iam_custom_role.hosted_sandbox_identity[each.key].name
  member   = "serviceAccount:${google_service_account.hosted_sandbox[each.key].email}"
}

resource "google_secret_manager_secret_iam_member" "hosted_sandbox" {
  for_each = var.hosted_sandbox == null ? {} : {
    for secret in toset([for ref in values(var.hosted_sandbox.secrets) : ref.secret]) : secret => [
      for ref in values(var.hosted_sandbox.secrets) : ref.version if ref.secret == secret
    ]
  }
  project   = var.project_id
  secret_id = each.key
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.hosted_sandbox["consumer"].email}"
  condition {
    title = "consumer-test-pinned-versions"
    expression = format("resource.type == 'secretmanager.googleapis.com/SecretVersion' && resource.name in %s", jsonencode([
      for version in sort(distinct(each.value)) :
      "projects/${data.google_project.hosted_sandbox["consumer"].number}/secrets/${each.key}/versions/${version}"
    ]))
  }
  # Secret containers and values must already exist; this creates neither.
}

resource "google_cloud_run_v2_service" "hosted_sandbox" {
  for_each             = local.hosted_sandbox_services
  project              = var.project_id
  location             = var.region
  name                 = each.value.service_name
  labels               = merge(local.labels, { purpose = "consumer-sandbox" })
  ingress              = each.value.public_access ? "INGRESS_TRAFFIC_ALL" : "INGRESS_TRAFFIC_INTERNAL_ONLY"
  invoker_iam_disabled = each.value.public_access

  template {
    service_account                  = google_service_account.hosted_sandbox[each.key].email
    timeout                          = "60s"
    max_instance_request_concurrency = 8
    scaling {
      min_instance_count = 0
      max_instance_count = each.value.max_instances
    }
    containers {
      image = each.value.image
      ports { container_port = 8080 }
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = false
      }
      dynamic "env" {
        for_each = merge(local.hosted_sandbox_environment, { REVENUECAT_PROJECT_ID = each.value.revenuecat_project_id })
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = each.value.secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }
      startup_probe {
        http_get {
          path = "/health/ready"
          port = 8080
          http_headers {
            name  = "X-Forwarded-Proto"
            value = "https"
          }
          http_headers {
            name  = "Host"
            value = "localhost"
          }
        }
        period_seconds    = 10
        failure_threshold = 24
        timeout_seconds   = 3
      }
      liveness_probe {
        http_get {
          path = "/health/live"
          port = 8080
          http_headers {
            name  = "X-Forwarded-Proto"
            value = "https"
          }
          http_headers {
            name  = "Host"
            value = "localhost"
          }
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 3
      }
    }
  }
  lifecycle {
    ignore_changes = [template[0].containers[0].image, traffic]
    precondition {
      condition = !each.value.public_access || (
        var.firebase_app_check_mode == "enforce" && length(trimspace(var.firebase_app_check_app_id)) > 0
      )
      error_message = "Verify Android App Check before exposing the consumer sandbox publicly. Authenticated RevenueCat callbacks remain exempt."
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.hosted_sandbox, google_project_iam_member.hosted_sandbox_identity]
}

resource "google_cloud_run_v2_service_iam_member" "hosted_sandbox_smoke" {
  for_each = google_cloud_run_v2_service.hosted_sandbox
  project  = var.project_id
  location = var.region
  name     = each.value.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.smoke.email}"
}

resource "google_cloud_run_v2_service_iam_member" "hosted_sandbox_deploy" {
  for_each = google_cloud_run_v2_service.hosted_sandbox
  project  = var.project_id
  location = var.region
  name     = each.value.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_acts_as_hosted_sandbox" {
  for_each           = google_service_account.hosted_sandbox
  service_account_id = each.value.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

output "hosted_sandbox_service_name" {
  description = "Optional GitHub staging variable HOSTED_SANDBOX_SERVICE. Empty leaves deployment unchanged."
  value       = try(google_cloud_run_v2_service.hosted_sandbox["consumer"].name, "")
}

output "hosted_sandbox_url" {
  description = "Generated HTTPS origin; append /v1/purchases/revenuecat for the permanent sandbox notification endpoint."
  value       = try(google_cloud_run_v2_service.hosted_sandbox["consumer"].uri, "")
}

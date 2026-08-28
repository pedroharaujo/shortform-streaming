resource "google_cloud_run_v2_service" "this" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = var.ingress
  labels   = var.labels

  # Keep IAM invocation checks enabled. Do not grant allUsers.
  invoker_iam_disabled = false

  template {
    service_account = var.runtime_service_account_email

    scaling {
      min_instance_count = var.min_instance_count
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "DJANGO_SETTINGS_MODULE"
        value = var.django_settings_module
      }

      env {
        name  = "DJANGO_ALLOWED_HOSTS"
        value = var.django_allowed_hosts
      }

      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.firebase_project_id
      }

      env {
        name = "DJANGO_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = format("%s", "django-secret-key")
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = format("%s", "database-url")
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.video_provider == "bunny" ? [1] : []
        content {
          name  = "VIDEO_PROVIDER"
          value = "bunny"
        }
      }

      dynamic "env" {
        for_each = var.video_provider == "bunny" ? [1] : []
        content {
          name  = "BUNNY_STREAM_LIBRARY_ID"
          value = var.bunny_stream_library_id
        }
      }

      dynamic "env" {
        for_each = var.video_provider == "bunny" ? [1] : []
        content {
          name  = "BUNNY_STREAM_CDN_HOSTNAME"
          value = var.bunny_stream_cdn_hostname
        }
      }

      dynamic "env" {
        for_each = var.video_provider == "bunny" ? [1] : []
        content {
          name = "BUNNY_STREAM_API_KEY"
          value_source {
            secret_key_ref {
              secret  = format("%s", var.bunny_stream_api_key_secret)
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.video_provider == "bunny" ? [1] : []
        content {
          name = "BUNNY_STREAM_TOKEN_KEY"
          value_source {
            secret_key_ref {
              secret  = format("%s", var.bunny_stream_token_key_secret)
              version = "latest"
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
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 3
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

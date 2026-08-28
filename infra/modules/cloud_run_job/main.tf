resource "google_cloud_run_v2_job" "this" {
  project  = var.project_id
  name     = var.job_name
  location = var.region
  labels   = var.labels

  template {
    template {
      service_account = var.runtime_service_account_email
      max_retries     = var.max_retries

      containers {
        image   = var.image
        command = length(var.command) > 0 ? var.command : null
        args    = length(var.args) > 0 ? var.args : null

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
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}

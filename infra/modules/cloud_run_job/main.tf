resource "google_cloud_run_v2_job" "this" {
  project  = var.project_id
  name     = var.job_name
  location = var.region
  labels   = var.labels

  template {
    template {
      service_account = var.runtime_service_account_email
      max_retries     = var.max_retries

      dynamic "vpc_access" {
        for_each = var.direct_vpc == null ? [] : [var.direct_vpc]
        content {
          egress = vpc_access.value.egress
          network_interfaces {
            network    = vpc_access.value.network
            subnetwork = vpc_access.value.subnetwork
          }
        }
      }

      containers {
        image   = var.image
        command = length(var.command) > 0 ? var.command : null
        args    = length(var.args) > 0 ? var.args : null

        dynamic "env" {
          for_each = var.include_django_configuration ? {
            DJANGO_SETTINGS_MODULE = var.django_settings_module
            DJANGO_ALLOWED_HOSTS   = var.django_allowed_hosts
            FIREBASE_PROJECT_ID    = var.firebase_project_id
          } : {}
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.include_django_configuration ? {
            DJANGO_SECRET_KEY = format("%s", "django-secret-key")
            DATABASE_URL      = "database-url"
          } : {}
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = lookup(var.secret_versions, env.key, "latest")
              }
            }
          }
        }

        dynamic "env" {
          for_each = var.include_django_configuration && var.video_provider == "bunny" ? [1] : []
          content {
            name  = "VIDEO_PROVIDER"
            value = "bunny"
          }
        }

        dynamic "env" {
          for_each = var.include_django_configuration && var.video_provider == "bunny" ? [1] : []
          content {
            name  = "BUNNY_STREAM_LIBRARY_ID"
            value = var.bunny_stream_library_id
          }
        }

        dynamic "env" {
          for_each = var.include_django_configuration && var.video_provider == "bunny" ? [1] : []
          content {
            name  = "BUNNY_STREAM_CDN_HOSTNAME"
            value = var.bunny_stream_cdn_hostname
          }
        }

        dynamic "env" {
          for_each = var.include_django_configuration && var.video_provider == "bunny" ? [1] : []
          content {
            name = "BUNNY_STREAM_API_KEY"
            value_source {
              secret_key_ref {
                secret  = format("%s", var.bunny_stream_api_key_secret)
                version = lookup(var.secret_versions, "BUNNY_STREAM_API_KEY", "latest")
              }
            }
          }
        }

        dynamic "env" {
          for_each = var.include_django_configuration && var.video_provider == "bunny" ? [1] : []
          content {
            name = "BUNNY_STREAM_TOKEN_KEY"
            value_source {
              secret_key_ref {
                secret  = format("%s", var.bunny_stream_token_key_secret)
                version = lookup(var.secret_versions, "BUNNY_STREAM_TOKEN_KEY", "latest")
              }
            }
          }
        }
      }
    }
  }

  lifecycle {
    precondition {
      condition = var.direct_vpc == null ? true : (
        can(regex("^projects/${var.project_id}/global/networks/[a-z][a-z0-9-]*$", var.direct_vpc.network)) &&
        can(regex("^projects/${var.project_id}/regions/${var.region}/subnetworks/[a-z][a-z0-9-]*$", var.direct_vpc.subnetwork))
      )
      error_message = "Direct VPC resource IDs must belong to this project, and the subnetwork must be in the job region."
    }
    precondition {
      condition = !var.include_django_configuration || (
        var.django_allowed_hosts != null && var.firebase_project_id != null
      )
      error_message = "Django jobs require django_allowed_hosts and firebase_project_id; HTTP-only jobs must disable include_django_configuration."
    }
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}

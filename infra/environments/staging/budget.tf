resource "google_billing_budget" "staging" {
  billing_account = var.billing_account_id
  display_name    = "${var.label_product}-${var.label_environment}-monthly"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      # Amount and currency are required variables with no defaults so this
      # composition cannot silently encode D-022 (EUR).
      currency_code = var.budget_currency_code
      units         = var.budget_amount_units
    }
  }

  threshold_rules {
    threshold_percent = var.budget_actual_threshold_percent
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = var.budget_forecast_threshold_percent
    spend_basis       = "FORECASTED_SPEND"
  }

  dynamic "all_updates_rule" {
    for_each = length(var.budget_notification_channel_ids) > 0 ? [1] : []
    content {
      monitoring_notification_channels = var.budget_notification_channel_ids
    }
  }

  depends_on = [google_project_service.required]
}

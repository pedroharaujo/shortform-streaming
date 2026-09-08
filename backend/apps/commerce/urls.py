from django.urls import path

from apps.commerce.views import (
    PurchaseCallbackView,
    PurchaseCatalogView,
    PurchaseHistoryView,
    PurchaseIdentityView,
    PurchaseStatusView,
)

urlpatterns = [
    path("v1/purchases/history", PurchaseHistoryView.as_view(), name="purchase-history"),
    path("v1/purchases/catalog", PurchaseCatalogView.as_view(), name="purchase-catalog"),
    path("v1/purchases/status", PurchaseStatusView.as_view(), name="purchase-status"),
    path("v1/purchases/identity", PurchaseIdentityView.as_view(), name="purchase-identity"),
    path("v1/purchases/revenuecat", PurchaseCallbackView.as_view(), name="purchase-callback"),
]

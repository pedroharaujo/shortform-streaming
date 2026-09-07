from django.urls import path

from apps.commerce.views import PurchaseCallbackView, PurchaseIdentityView

urlpatterns = [
    path("v1/purchases/identity", PurchaseIdentityView.as_view(), name="purchase-identity"),
    path("v1/purchases/revenuecat", PurchaseCallbackView.as_view(), name="purchase-callback"),
]

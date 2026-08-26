from __future__ import annotations

from django.urls import path

from apps.accounts.views import MeView

urlpatterns = [
    path("v1/me", MeView.as_view(), name="accounts-me"),
]

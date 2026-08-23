from __future__ import annotations

from django.urls import path

from .views import LiveView, ReadyView

urlpatterns = [
    path("live", LiveView.as_view(), name="health-live"),
    path("ready", ReadyView.as_view(), name="health-ready"),
]

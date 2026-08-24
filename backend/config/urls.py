from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", include("apps.health.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.playback.urls")),
]

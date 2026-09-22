from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Stovio administration"
admin.site.site_title = "Stovio Admin"
admin.site.index_title = "Stovio administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", include("apps.health.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.playback.urls")),
    path("", include("apps.entitlements.urls")),
    path("", include("apps.progress.urls")),
    path("", include("apps.advertising.urls")),
    path("", include("apps.wallet.urls")),
    path("", include("apps.commerce.urls")),
]

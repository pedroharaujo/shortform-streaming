"""Public consumer routes; staff ingestion is only in the private URL configuration."""

from django.urls import include, path

from apps.playback.views import PlaybackAuthorizeView

urlpatterns = [
    path("health/", include("apps.health.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.accounts.urls")),
    path(
        "v1/playback/<str:episode_id>/authorize",
        PlaybackAuthorizeView.as_view(),
        name="playback-authorize",
    ),
    path("", include("apps.entitlements.urls")),
    path("", include("apps.progress.urls")),
    path("", include("apps.advertising.urls")),
    path("", include("apps.wallet.urls")),
    path("", include("apps.commerce.urls")),
]

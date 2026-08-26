from __future__ import annotations

from django.urls import path

from apps.playback.views import PlaybackAuthorizeView

urlpatterns = [
    path(
        "v1/playback/<str:episode_id>/authorize",
        PlaybackAuthorizeView.as_view(),
        name="playback-authorize",
    ),
]

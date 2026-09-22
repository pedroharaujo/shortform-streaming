from __future__ import annotations

from django.urls import path

from apps.progress.views import ContinueWatchingView, WatchProgressView

urlpatterns = [
    path(
        "v1/progress/continue",
        ContinueWatchingView.as_view(),
        name="watch-progress-continue",
    ),
    path(
        "v1/progress/<str:episode_id>",
        WatchProgressView.as_view(),
        name="watch-progress",
    ),
]

from __future__ import annotations

from django.conf import settings
from django.urls import path

from apps.playback.views import PlaybackAuthorizeView

urlpatterns = [
    path(
        "v1/playback/<str:episode_id>/authorize",
        PlaybackAuthorizeView.as_view(),
        name="playback-authorize",
    ),
]

if str(getattr(settings, "STAFF_UPLOAD_STORE", "")).strip().lower() == "fake":
    from apps.playback.upload_views import fake_staff_master_put

    urlpatterns.append(
        path(
            "internal/staff-masters/<int:pk>",
            fake_staff_master_put,
            name="staff-master-fake-put",
        )
    )

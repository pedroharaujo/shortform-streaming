from __future__ import annotations

from django.urls import path

from apps.entitlements.views import EpisodeOffersView

urlpatterns = [
    path(
        "v1/offers/<str:episode_id>",
        EpisodeOffersView.as_view(),
        name="episode-offers",
    ),
]

from __future__ import annotations

from django.urls import path

from apps.catalog.views import CatalogHomeView, EpisodeDetailView, SeriesDetailView

urlpatterns = [
    path("v1/catalog/home", CatalogHomeView.as_view(), name="catalog-home"),
    path("v1/series/<str:public_id>", SeriesDetailView.as_view(), name="catalog-series-detail"),
    path("v1/episodes/<str:public_id>", EpisodeDetailView.as_view(), name="catalog-episode-detail"),
]

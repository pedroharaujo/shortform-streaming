from __future__ import annotations

from collections import defaultdict

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.eligibility import (
    eligible_episodes_for_series,
    eligible_series_queryset,
    episode_is_eligible,
)
from apps.catalog.models import Episode
from apps.catalog.serializers import (
    CatalogEpisodeDetailSerializer,
    CatalogHomeSerializer,
    CatalogSeriesDetailSerializer,
    serialize_episode_detail,
    serialize_series_card,
    serialize_series_detail,
)

_NOT_FOUND_MESSAGE = "Resource not found."

PUBLIC_ID_PARAMETER = OpenApiParameter(
    name="public_id",
    location=OpenApiParameter.PATH,
    required=True,
    description="Opaque public identifier. Sequential database integers are never exposed.",
    type={"$ref": "#/components/schemas/PublicId"},
)

ERROR_404 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description="Unknown or unavailable public id. Does not confirm whether the id exists.",
)


class CatalogAnonymousView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]


class CatalogHomeView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["catalog"],
        summary="Home catalog",
        description="Published self-owned English series for the France/Android MVP.",
        responses={200: CatalogHomeSerializer},
    )
    def get(self, request: Request) -> Response:
        del request
        series_list = list(eligible_series_queryset())
        return Response(
            {
                "rails": [
                    {
                        "id": "featured",
                        "title": "Featured",
                        "series": [serialize_series_card(series) for series in series_list],
                    }
                ]
            }
        )


class SeriesDetailView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["catalog"],
        summary="Series detail",
        parameters=[PUBLIC_ID_PARAMETER],
        responses={200: CatalogSeriesDetailSerializer, 404: ERROR_404},
    )
    def get(self, request: Request, public_id: str) -> Response:
        del request
        series = (
            eligible_series_queryset()
            .filter(public_id=public_id)
            .prefetch_related("genres", "seasons")
            .first()
        )
        if series is None:
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        by_season: dict[int, list[Episode]] = defaultdict(list)
        for episode in eligible_episodes_for_series(series):
            by_season[episode.season.number].append(episode)
        return Response(serialize_series_detail(series, by_season, list(series.seasons.all())))


class EpisodeDetailView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["catalog"],
        summary="Episode detail",
        parameters=[PUBLIC_ID_PARAMETER],
        responses={200: CatalogEpisodeDetailSerializer, 404: ERROR_404},
    )
    def get(self, request: Request, public_id: str) -> Response:
        del request
        episode = (
            Episode.objects.select_related("series", "season").filter(public_id=public_id).first()
        )
        if episode is None or not episode_is_eligible(episode):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        return Response(serialize_episode_detail(episode))

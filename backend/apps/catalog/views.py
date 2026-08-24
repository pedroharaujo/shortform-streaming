from __future__ import annotations

from collections import defaultdict

from drf_spectacular.types import OpenApiTypes
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
from apps.catalog.request_context import parse_catalog_context
from apps.catalog.serializers import (
    CatalogEpisodeDetailSerializer,
    CatalogHomeSerializer,
    CatalogSeriesDetailSerializer,
    serialize_episode_detail,
    serialize_series_card,
    serialize_series_detail,
)

_NOT_FOUND_MESSAGE = "Resource not found."

CATALOG_CONTEXT_PARAMETERS = [
    OpenApiParameter(
        name="X-Territory",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.HEADER,
        required=True,
        description=(
            "ISO 3166-1 alpha-2 territory (for example FR). Required and never inferred "
            "from Accept-Language or UI language."
        ),
    ),
    OpenApiParameter(
        name="X-Platform",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.HEADER,
        required=True,
        enum=["ios", "android"],
        description="Client platform. Required. Values: ios, android.",
    ),
    OpenApiParameter(
        name="X-Language",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.HEADER,
        required=True,
        description=(
            "ISO 639-1 catalog language (MVP: en). Required and never inferred from "
            "Accept-Language."
        ),
    ),
]

PUBLIC_ID_PARAMETER = OpenApiParameter(
    name="public_id",
    location=OpenApiParameter.PATH,
    required=True,
    description=(
        "Opaque public identifier. Sequential database integers are never used as public IDs."
    ),
    type={"$ref": "#/components/schemas/PublicId"},
)

ERROR_400 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description="Missing or malformed catalog context headers.",
)
ERROR_404 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description="Unknown or ineligible public id. Does not confirm whether the id exists.",
)


class CatalogAnonymousView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]


class CatalogHomeView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["catalog"],
        summary="Home catalog rails",
        description=(
            "Small rails document of series eligible for the explicit request territory, "
            "platform, language, and current time. Not a CursorPage. Catalog is tiny; "
            "home is not paginated in P2-T03. Missing or malformed context headers are 400. "
            "A well-formed context with no eligible titles is 200 with an empty featured rail."
        ),
        parameters=CATALOG_CONTEXT_PARAMETERS,
        responses={200: CatalogHomeSerializer, 400: ERROR_400},
    )
    def get(self, request: Request) -> Response:
        context = parse_catalog_context(request)
        series_list = list(eligible_series_queryset(context).prefetch_related("translations"))
        payload = {
            "rails": [
                {
                    "id": "featured",
                    "title": "Featured",
                    "series": [serialize_series_card(series, context) for series in series_list],
                }
            ]
        }
        return Response(payload)


class SeriesDetailView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["catalog"],
        summary="Series detail",
        description=(
            "Localized series detail with ordered published episodes. Ineligible or "
            "unpublished public ids return 404 ErrorEnvelope, never 403."
        ),
        parameters=[PUBLIC_ID_PARAMETER, *CATALOG_CONTEXT_PARAMETERS],
        responses={200: CatalogSeriesDetailSerializer, 400: ERROR_400, 404: ERROR_404},
    )
    def get(self, request: Request, public_id: str) -> Response:
        context = parse_catalog_context(request)
        series = (
            eligible_series_queryset(context)
            .filter(public_id=public_id)
            .prefetch_related("translations", "genres", "seasons", "episodes__translations")
            .first()
        )
        if series is None:
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        episodes = list(eligible_episodes_for_series(series).prefetch_related("translations"))
        by_season: dict[int, list[Episode]] = defaultdict(list)
        for episode in episodes:
            by_season[episode.season.number].append(episode)
        payload = serialize_series_detail(
            series,
            context,
            by_season,
            list(series.seasons.all()),
        )
        return Response(payload)


class EpisodeDetailView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["catalog"],
        summary="Episode detail",
        description=(
            "Localized episode detail. The episode is eligible only when its series is "
            "eligible and the episode is published within its optional window. "
            "Ineligible ids return 404, never 403. Monetization lock state is omitted."
        ),
        parameters=[PUBLIC_ID_PARAMETER, *CATALOG_CONTEXT_PARAMETERS],
        responses={200: CatalogEpisodeDetailSerializer, 400: ERROR_400, 404: ERROR_404},
    )
    def get(self, request: Request, public_id: str) -> Response:
        context = parse_catalog_context(request)
        episode = (
            Episode.objects.select_related("series", "season")
            .prefetch_related("translations", "series__translations")
            .filter(public_id=public_id)
            .first()
        )
        if episode is None or not episode_is_eligible(episode, context):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        return Response(serialize_episode_detail(episode, context))

from __future__ import annotations

from urllib.parse import urlparse

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalog.eligibility import episode_is_eligible
from apps.catalog.models import Episode
from apps.catalog.request_context import parse_catalog_context
from apps.catalog.views import (
    CATALOG_CONTEXT_PARAMETERS,
    ERROR_400,
    ERROR_404,
    CatalogAnonymousView,
)
from apps.playback.exceptions import (
    PlaybackUnavailable,
    VideoAssetNotFoundError,
    VideoProviderError,
)
from apps.playback.ingest import ready_asset_for_episode
from apps.playback.providers.factory import get_video_provider
from apps.playback.serializers import PlaybackAuthorizeResponseSerializer

_NOT_FOUND_MESSAGE = "Resource not found."

ERROR_503 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description=(
        "Playback provider is unset or disabled. Fail-closed: no URL is minted. "
        "HTTP 503, never an unsigned playlist."
    ),
)

EPISODE_ID_PARAMETER = OpenApiParameter(
    name="episode_id",
    location=OpenApiParameter.PATH,
    required=True,
    description=(
        "Opaque episode public identifier. Sequential database integers are never "
        "used as public IDs."
    ),
    type={"$ref": "#/components/schemas/PublicId"},
)


class PlaybackAuthorizeView(CatalogAnonymousView):
    @extend_schema(
        auth=[],
        tags=["playback"],
        summary="Authorize episode playback",
        description=(
            "Anonymous free playback. Requires the same catalog context headers as "
            "catalog reads. Unknown, ineligible, unpublished, or episodes without a "
            "ready MediaAsset return 404 ErrorEnvelope, never 403. An unset or "
            "disabled VideoProvider returns 503 ErrorEnvelope and never mints unsigned "
            "access. Success looks up the episode's ready MediaAsset and returns an "
            "opaque HTTPS HLS URL that is not served by Django."
        ),
        parameters=[EPISODE_ID_PARAMETER, *CATALOG_CONTEXT_PARAMETERS],
        request=None,
        responses={
            200: PlaybackAuthorizeResponseSerializer,
            400: ERROR_400,
            404: ERROR_404,
            503: ERROR_503,
        },
    )
    def post(self, request: Request, episode_id: str) -> Response:
        context = parse_catalog_context(request)
        episode = (
            Episode.objects.select_related("series", "season").filter(public_id=episode_id).first()
        )
        if episode is None or not episode_is_eligible(episode, context):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        asset = ready_asset_for_episode(episode)
        if asset is None:
            raise NotFound(detail=_NOT_FOUND_MESSAGE)

        provider = get_video_provider()
        if provider is None:
            raise PlaybackUnavailable()

        try:
            access = provider.issue_playback_access(asset.provider_asset_id)
        except VideoAssetNotFoundError:
            raise NotFound(detail=_NOT_FOUND_MESSAGE) from None
        except VideoProviderError:
            raise PlaybackUnavailable() from None

        playback_url = access.playback_url
        parsed = urlparse(playback_url)
        if parsed.scheme != "https" or not parsed.path.endswith(".m3u8"):
            raise PlaybackUnavailable()
        request_host = request.get_host().split(":")[0].casefold()
        playback_host = (parsed.hostname or "").casefold()
        if not playback_host or playback_host == request_host:
            raise PlaybackUnavailable()

        payload = {
            "playback_url": playback_url,
            "expires_at": access.expires_at,
        }
        return Response(payload)

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.authentication import OptionalFirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.views import ERROR_401
from apps.catalog.models import Episode
from apps.catalog.request_context import parse_catalog_context
from apps.catalog.views import (
    CATALOG_CONTEXT_PARAMETERS,
    ERROR_400,
    ERROR_404,
    CatalogAnonymousView,
)
from apps.entitlements.policy import (
    Grant,
    GrantSource,
    Ineligible,
    Lock,
    evaluate_authorize_access,
)
from apps.playback.exceptions import (
    PlaybackUnavailable,
    VideoAssetNotFoundError,
    VideoProviderError,
)
from apps.playback.ingest import ready_asset_for_episode
from apps.playback.providers.factory import get_video_provider
from apps.playback.serializers import (
    PLAYBACK_AUTHORIZE_RESPONSE,
    PlaybackAuthorizeGrantedSerializer,
    PlaybackAuthorizeLockedSerializer,
)

_NOT_FOUND_MESSAGE = "Resource not found."
_OPTIONAL_FIREBASE_AUTH: list[Any] = [{}, {"FirebaseIdToken": []}]

ERROR_503 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description=(
        "Playback provider is unset or disabled. Fail-closed: no URL is minted. "
        "HTTP 503, never an unsigned playlist. Returned only on the grant mint path."
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
    authentication_classes = [OptionalFirebaseIdTokenAuthentication]

    @extend_schema(
        auth=_OPTIONAL_FIREBASE_AUTH,
        tags=["playback"],
        summary="Authorize episode playback",
        description=(
            "Authorize playback for a catalog-eligible episode. Optional Firebase ID "
            "token: a missing Authorization header is anonymous; a present invalid, "
            "expired, or revoked token is 401 ErrorEnvelope. Catalog-ineligible, "
            "unpublished, takedown, wrong-territory, or missing-ready-asset ids "
            "return 404 ErrorEnvelope, never 403. Catalog-eligible lock returns "
            "HTTP 200 decision=locked with lock_reasons and no playback_url. Grant "
            "looks up the episode's ready MediaAsset and returns an opaque HTTPS HLS "
            "URL that is not served by Django. An unset or disabled VideoProvider "
            "returns 503 ErrorEnvelope on the grant path only and never mints unsigned "
            "access. Client-supplied user identifiers are ignored."
        ),
        parameters=[EPISODE_ID_PARAMETER, *CATALOG_CONTEXT_PARAMETERS],
        request=None,
        responses={
            200: PLAYBACK_AUTHORIZE_RESPONSE,
            400: ERROR_400,
            401: ERROR_401,
            404: ERROR_404,
            503: ERROR_503,
        },
    )
    def post(self, request: Request, episode_id: str) -> Response:
        context = parse_catalog_context(request)
        episode = (
            Episode.objects.select_related("series", "season").filter(public_id=episode_id).first()
        )
        if episode is None:
            raise NotFound(detail=_NOT_FOUND_MESSAGE)

        profile = request.user if isinstance(request.user, UserProfile) else None
        decision = evaluate_authorize_access(episode, context, profile)
        if isinstance(decision, Ineligible):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        if isinstance(decision, Lock):
            payload = {
                "decision": "locked",
                "lock_reasons": [reason.value for reason in decision.lock_reasons],
            }
            return Response(PlaybackAuthorizeLockedSerializer(payload).data)
        if not isinstance(decision, Grant):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        return _mint_granted_response(request, episode, decision.source)


def _mint_granted_response(
    request: Request, episode: Episode, access_method: GrantSource
) -> Response:
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
        "decision": "granted",
        "access_method": access_method.value,
        "playback_url": playback_url,
        "expires_at": access.expires_at,
    }
    return Response(PlaybackAuthorizeGrantedSerializer(payload).data)

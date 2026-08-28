from __future__ import annotations

from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
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
    Ineligible,
    OfferMethod,
    OffersGranted,
    OffersLocked,
    evaluate_episode_offers,
)
from apps.entitlements.serializers import (
    EPISODE_OFFERS_RESPONSE,
    EpisodeOffersGrantedSerializer,
    EpisodeOffersLockedSerializer,
)

_NOT_FOUND_MESSAGE = "Resource not found."
_OPTIONAL_FIREBASE_AUTH: list[Any] = [{}, {"FirebaseIdToken": []}]

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


def _method_payload(method: OfferMethod) -> dict[str, str]:
    return {
        "type": method.type.value,
        "title": method.title,
        "description": method.description,
    }


class EpisodeOffersView(CatalogAnonymousView):
    authentication_classes = [OptionalFirebaseIdTokenAuthentication]

    @extend_schema(
        auth=_OPTIONAL_FIREBASE_AUTH,
        tags=["offers"],
        summary="List episode access offers",
        description=(
            "Return currently available access methods for a catalog-eligible episode. "
            "Optional Firebase ID token: a missing Authorization header is anonymous; "
            "a present invalid, expired, or revoked token is 401 ErrorEnvelope. "
            "Catalog-ineligible, unpublished, takedown, wrong-territory, or unknown "
            "ids return 404 ErrorEnvelope, never 403. Catalog-eligible lock returns "
            "HTTP 200 decision=locked with lock_reasons and methods. Grant returns "
            "HTTP 200 decision=granted with methods. This response never includes a "
            "playback URL and never calls the video provider. MVP method types are "
            "entitlement, free, and rewarded_ad. Client-supplied free-window or "
            "user identifiers are ignored."
        ),
        parameters=[EPISODE_ID_PARAMETER, *CATALOG_CONTEXT_PARAMETERS],
        responses={
            200: EPISODE_OFFERS_RESPONSE,
            400: ERROR_400,
            401: ERROR_401,
            404: ERROR_404,
        },
    )
    def get(self, request: Request, episode_id: str) -> Response:
        context = parse_catalog_context(request)
        episode = (
            Episode.objects.select_related("series", "season").filter(public_id=episode_id).first()
        )
        if episode is None:
            raise NotFound(detail=_NOT_FOUND_MESSAGE)

        profile = request.user if isinstance(request.user, UserProfile) else None
        decision = evaluate_episode_offers(episode, context, profile)
        if isinstance(decision, Ineligible):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        if isinstance(decision, OffersGranted):
            payload = {
                "decision": "granted",
                "episode_id": episode.public_id,
                "methods": [_method_payload(method) for method in decision.methods],
            }
            return Response(EpisodeOffersGrantedSerializer(payload).data)
        if not isinstance(decision, OffersLocked):
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        payload = {
            "decision": "locked",
            "episode_id": episode.public_id,
            "lock_reasons": [reason.value for reason in decision.lock_reasons],
            "methods": [_method_payload(method) for method in decision.methods],
        }
        return Response(EpisodeOffersLockedSerializer(payload).data)

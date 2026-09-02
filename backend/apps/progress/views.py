from __future__ import annotations

import uuid
from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.authentication import OptionalFirebaseIdTokenAuthentication
from apps.accounts.models import UserProfile
from apps.accounts.views import ERROR_401
from apps.catalog.models import Episode
from apps.catalog.views import ERROR_404, CatalogAnonymousView
from apps.entitlements.policy import Grant, Ineligible, Lock, evaluate_authorize_access
from apps.playback.views import EPISODE_ID_PARAMETER
from apps.progress.exceptions import PlaybackLocked, ProgressDeviceIdError
from apps.progress.models import WatchProgress, upsert_watch_progress
from apps.progress.serializers import WatchProgressSerializer, WatchProgressWriteSerializer

_NOT_FOUND_MESSAGE = "Resource not found."
_OPTIONAL_FIREBASE_AUTH: list[Any] = [{}, {"FirebaseIdToken": []}]
_DEVICE_ID_FIELD = "X-Device-Id"

ERROR_403 = OpenApiResponse(
    response={"$ref": "#/components/schemas/ErrorEnvelope"},
    description=(
        "Catalog-eligible lock. Progress is not written. No playback URL is minted. "
        "HTTP 403, never a signed playlist."
    ),
)

DEVICE_ID_PARAMETER = OpenApiParameter(
    name=_DEVICE_ID_FIELD,
    type=OpenApiTypes.STR,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "Anonymous device UUID (36-character hyphenated form). Required when no "
        "Authorization header is present. Ignored when a verified profile is present. "
        "Never a user id, profile public id, or Firebase UID."
    ),
)

_SCHEMA_DESCRIPTION = (
    "Read or upsert watch progress for a catalog-eligible granted episode. Optional "
    "Firebase ID token: a missing Authorization header is anonymous; a present "
    "invalid, expired, or revoked token is 401 ErrorEnvelope. Anonymous subjects "
    "are identified only by X-Device-Id (a client-generated UUID). Authenticated "
    "requests use the verified profile and ignore X-Device-Id. Catalog-ineligible, "
    "unpublished, takedown, or unknown ids return 404 ErrorEnvelope, never 403. "
    "Catalog-eligible lock returns HTTP 403 playback_locked and does not write. "
    "Grant upserts progress and never calls the video provider. Django never "
    "serves video bytes. Client-supplied user identifiers are ignored."
)


class WatchProgressView(CatalogAnonymousView):
    authentication_classes = [OptionalFirebaseIdTokenAuthentication]

    @extend_schema(
        auth=_OPTIONAL_FIREBASE_AUTH,
        tags=["progress"],
        summary="Get watch progress",
        description=_SCHEMA_DESCRIPTION,
        parameters=[EPISODE_ID_PARAMETER, DEVICE_ID_PARAMETER],
        responses={
            200: WatchProgressSerializer,
            401: ERROR_401,
            403: ERROR_403,
            404: ERROR_404,
        },
    )
    def get(self, request: Request, episode_id: str) -> Response:
        episode, profile, device_id = _authorized_subject(request, episode_id)
        row = _lookup_progress(episode, profile, device_id)
        if row is None:
            raise NotFound(detail=_NOT_FOUND_MESSAGE)
        return Response(_serialize_progress(row, episode))

    @extend_schema(
        auth=_OPTIONAL_FIREBASE_AUTH,
        tags=["progress"],
        summary="Upsert watch progress",
        description=_SCHEMA_DESCRIPTION,
        parameters=[EPISODE_ID_PARAMETER, DEVICE_ID_PARAMETER],
        request=WatchProgressWriteSerializer,
        responses={
            200: WatchProgressSerializer,
            401: ERROR_401,
            403: ERROR_403,
            404: ERROR_404,
        },
    )
    def put(self, request: Request, episode_id: str) -> Response:
        episode, profile, device_id = _authorized_subject(request, episode_id)
        serializer = WatchProgressWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        row = upsert_watch_progress(
            episode=episode,
            user_profile=profile,
            device_id=device_id,
            position_seconds=int(payload["position_seconds"]),
            completed=bool(payload.get("completed", False)),
        )
        return Response(_serialize_progress(row, episode))


def _authorized_subject(
    request: Request, episode_id: str
) -> tuple[Episode, UserProfile | None, str | None]:
    episode = (
        Episode.objects.select_related("series", "season").filter(public_id=episode_id).first()
    )
    if episode is None:
        raise NotFound(detail=_NOT_FOUND_MESSAGE)

    profile = request.user if isinstance(request.user, UserProfile) else None
    decision = evaluate_authorize_access(episode, profile)
    if isinstance(decision, Ineligible):
        raise NotFound(detail=_NOT_FOUND_MESSAGE)
    if isinstance(decision, Lock):
        raise PlaybackLocked()
    if not isinstance(decision, Grant):
        raise NotFound(detail=_NOT_FOUND_MESSAGE)

    device_id: str | None = None
    if profile is None:
        device_id = _require_device_id(request)
    return episode, profile, device_id


def _require_device_id(request: Request) -> str:
    raw = request.META.get("HTTP_X_DEVICE_ID")
    if raw is None or not isinstance(raw, str) or not raw.strip():
        raise ProgressDeviceIdError(
            [
                {
                    "field": _DEVICE_ID_FIELD,
                    "code": "required",
                    "message": "X-Device-Id is required for anonymous progress.",
                }
            ]
        )
    value = raw.strip()
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        raise ProgressDeviceIdError(
            [
                {
                    "field": _DEVICE_ID_FIELD,
                    "code": "invalid",
                    "message": "X-Device-Id must be a UUID.",
                }
            ]
        ) from None
    canonical = str(parsed)
    if len(canonical) != 36:
        raise ProgressDeviceIdError(
            [
                {
                    "field": _DEVICE_ID_FIELD,
                    "code": "invalid",
                    "message": "X-Device-Id must be a UUID.",
                }
            ]
        )
    return canonical


def _lookup_progress(
    episode: Episode, profile: UserProfile | None, device_id: str | None
) -> WatchProgress | None:
    if profile is not None:
        return WatchProgress.objects.filter(user_profile=profile, episode=episode).first()
    return WatchProgress.objects.filter(device_id=device_id, episode=episode).first()


def _serialize_progress(row: WatchProgress, episode: Episode) -> dict[str, object]:
    payload = {
        "episode_id": episode.public_id,
        "position_seconds": row.position_seconds,
        "completed": row.completed,
        "updated_at": row.updated_at,
    }
    return WatchProgressSerializer(payload).data

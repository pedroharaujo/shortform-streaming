from __future__ import annotations

import base64
import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from apps.playback.exceptions import VideoAssetNotFoundError, VideoProviderError
from apps.playback.providers.tokens import (
    bunny_unsigned_playlist_url,
    referrer_allowed,
    sign_bunny_directory_hls_url,
)
from apps.playback.providers.types import PlaybackAccess, VideoAssetMetadata

BUNNY_VIDEO_API = "https://video.bunnycdn.com"
FINISHED_STATUS = 4
ERROR_STATUSES = frozenset({5, 6})


@dataclass(frozen=True, slots=True)
class BunnyHttpResponse:
    status_code: int
    body: bytes


HttpTransport = Callable[[str, str, Mapping[str, str], bytes | None], BunnyHttpResponse]


def _stdlib_transport(
    method: str,
    url: str,
    headers: Mapping[str, str],
    body: bytes | None,
) -> BunnyHttpResponse:
    request = Request(url, data=body, method=method)
    for key, value in headers.items():
        request.add_header(key, value)
    try:
        with urlopen(request, timeout=30) as response:
            return BunnyHttpResponse(status_code=int(response.status), body=response.read())
    except HTTPError as error:
        payload = error.read() if error.fp is not None else b""
        return BunnyHttpResponse(status_code=int(error.code), body=payload)
    except URLError as error:
        raise VideoProviderError("Bunny Stream request failed") from error


class BunnyStreamVideoProvider:
    """Bunny Stream HTTP adapter. Library ids and signing keys never leave Django."""

    def __init__(
        self,
        *,
        library_id: str,
        api_key: str,
        cdn_hostname: str,
        token_key: str,
        ttl_seconds: int = 600,
        transport: HttpTransport | None = None,
    ) -> None:
        self._library_id = library_id
        self._api_key = api_key
        self._cdn_hostname = cdn_hostname.removeprefix("https://").removeprefix("http://")
        self._cdn_hostname = self._cdn_hostname.split("/", 1)[0]
        self._token_key = token_key
        self._ttl_seconds = ttl_seconds
        self._transport = transport or _stdlib_transport

    @classmethod
    def from_django_settings(
        cls, transport: HttpTransport | None = None
    ) -> BunnyStreamVideoProvider:
        library_id = str(getattr(settings, "BUNNY_STREAM_LIBRARY_ID", "")).strip()
        stream_access = str(getattr(settings, "BUNNY_STREAM_API_KEY", "")).strip()
        cdn_hostname = str(getattr(settings, "BUNNY_STREAM_CDN_HOSTNAME", "")).strip()
        cdn_hmac = str(getattr(settings, "BUNNY_STREAM_TOKEN_KEY", "")).strip()
        if not library_id or not stream_access or not cdn_hostname or not cdn_hmac:
            raise VideoProviderError("Bunny Stream is not configured")
        ttl = int(getattr(settings, "PLAYBACK_TOKEN_TTL_SECONDS", 600))
        return cls(
            library_id=library_id,
            api_key=stream_access,
            cdn_hostname=cdn_hostname,
            token_key=cdn_hmac,
            ttl_seconds=ttl,
            transport=transport,
        )

    def submit_master(
        self,
        *,
        title: str,
        video_path: Path,
        captions_path: Path | None,
        captions_language: str = "en",
    ) -> str:
        created = self._json(
            "POST",
            f"{BUNNY_VIDEO_API}/library/{self._library_id}/videos",
            body={"title": title},
        )
        asset_id = str(created.get("guid") or "")
        if not asset_id:
            raise VideoProviderError("Bunny Stream did not return a video id")
        video_bytes = video_path.read_bytes()
        self._request(
            "PUT",
            f"{BUNNY_VIDEO_API}/library/{self._library_id}/videos/{asset_id}",
            body=video_bytes,
            content_type="application/octet-stream",
        )
        if captions_path is not None:
            encoded = base64.b64encode(captions_path.read_bytes()).decode("ascii")
            self._json(
                "POST",
                (
                    f"{BUNNY_VIDEO_API}/library/{self._library_id}/videos/"
                    f"{asset_id}/captions/{captions_language}"
                ),
                body={
                    "srclang": captions_language,
                    "label": captions_language,
                    "captionsFile": encoded,
                },
            )
        return asset_id

    def get_asset(self, asset_id: str) -> VideoAssetMetadata:
        payload = self._json(
            "GET",
            f"{BUNNY_VIDEO_API}/library/{self._library_id}/videos/{asset_id}",
        )
        status_code = payload.get("status")
        if isinstance(status_code, int) and status_code in ERROR_STATUSES:
            return self._metadata_from_payload(asset_id, payload, status="failed")
        if status_code == FINISHED_STATUS:
            return self._metadata_from_payload(asset_id, payload, status="ready")
        if status_code in {0, 1, 2, 3}:
            return self._metadata_from_payload(asset_id, payload, status="processing")
        return self._metadata_from_payload(asset_id, payload, status="processing")

    def issue_playback_access(self, asset_id: str) -> PlaybackAccess:
        asset = self.get_asset(asset_id)
        if asset.status != "ready":
            raise VideoAssetNotFoundError(asset_id)
        expires_at = timezone.now() + timedelta(seconds=self._ttl_seconds)
        return PlaybackAccess(
            playback_url=sign_bunny_directory_hls_url(
                cdn_hostname=self._cdn_hostname,
                video_id=asset_id,
                security_key=self._token_key,
                expires_at=expires_at,
            ),
            expires_at=expires_at,
        )

    def takedown(self, asset_id: str) -> None:
        self._request(
            "DELETE",
            f"{BUNNY_VIDEO_API}/library/{self._library_id}/videos/{asset_id}",
        )

    def unsigned_playlist_url(self, asset_id: str) -> str:
        return bunny_unsigned_playlist_url(cdn_hostname=self._cdn_hostname, video_id=asset_id)

    def expired_playback_url(self, asset_id: str, *, now: datetime | None = None) -> str:
        instant = now if now is not None else datetime.now(tz=UTC)
        return sign_bunny_directory_hls_url(
            cdn_hostname=self._cdn_hostname,
            video_id=asset_id,
            security_key=self._token_key,
            expires_at=instant - timedelta(seconds=30),
        )

    def referrer_is_allowed(self, referrer: str | None, allowlist: tuple[str, ...]) -> bool:
        return any(referrer_allowed(referrer, host) for host in allowlist)

    def _auth_headers(self, content_type: str | None) -> dict[str, str]:
        headers = {"AccessKey": self._api_key, "Accept": "application/json"}
        if content_type is not None:
            headers["Content-Type"] = content_type
        return headers

    def _request(
        self,
        method: str,
        url: str,
        *,
        body: bytes | dict[str, Any] | None = None,
        content_type: str | None = None,
    ) -> BunnyHttpResponse:
        payload: bytes | None
        header_type = content_type
        if isinstance(body, dict):
            payload = json.dumps(body).encode("utf-8")
            header_type = header_type or "application/json"
        else:
            payload = body
        response = self._transport(method, url, self._auth_headers(header_type), payload)
        if response.status_code == 404:
            raise VideoAssetNotFoundError(url.rsplit("/", 1)[-1])
        if response.status_code >= 400:
            raise VideoProviderError("Bunny Stream request failed")
        return response

    def _json(
        self,
        method: str,
        url: str,
        *,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        response = self._request(method, url, body=body, content_type="application/json")
        if not response.body:
            return {}
        parsed = json.loads(response.body.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise VideoProviderError("Bunny Stream returned an unexpected payload")
        return parsed

    def _metadata_from_payload(
        self, asset_id: str, payload: dict[str, Any], *, status: str
    ) -> VideoAssetMetadata:
        resolutions = payload.get("availableResolutions") or ""
        renditions = tuple(item.strip() for item in str(resolutions).split(",") if item.strip())
        captions = payload.get("captions") or []
        length = payload.get("length")
        duration: float | None
        if isinstance(length, (int, float)):
            duration = float(length)
        else:
            duration = None
        thumbnail_count = payload.get("thumbnailCount")
        width = payload.get("width")
        height = payload.get("height")
        has_audio = True
        if payload.get("hasAudio") is False:
            has_audio = False
        return VideoAssetMetadata(
            asset_id=asset_id,
            status=status,
            duration_seconds=duration,
            renditions=renditions,
            thumbnail_count=(int(thumbnail_count) if isinstance(thumbnail_count, int) else 0),
            has_captions=isinstance(captions, list) and len(captions) > 0,
            width=int(width) if isinstance(width, int) else None,
            height=int(height) if isinstance(height, int) else None,
            has_audio=has_audio,
        )

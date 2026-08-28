from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone

STAFF_MASTER_KEY_PREFIX = "staff-masters"
_cached_store: ObjectStore | None = None
_store_resolved = False


class ObjectNotFoundError(LookupError):
    """The private staff-master object is missing."""


class ObjectStore(Protocol):
    """Private staff landing zone. Not a playback origin."""

    def mint_put_url(
        self,
        object_key: str,
        *,
        ttl_seconds: int | None = None,
        now: datetime | None = None,
    ) -> tuple[str, datetime]:
        """Return a short-lived HTTPS PUT URL and its expiry. Do not persist the URL."""

    def get_bytes(self, object_key: str) -> bytes:
        """Read the private object for checksum verification. Never make it public."""


def staff_master_object_key(asset_pk: int) -> str:
    if isinstance(asset_pk, bool) or asset_pk < 1:
        raise ValueError("Staff master object key requires a positive integer pk.")
    return f"{STAFF_MASTER_KEY_PREFIX}/{asset_pk}"


def staff_put_signature(*, hmac_key: str, object_key: str, expires_unix: int) -> str:
    message = f"PUT\n{object_key}\n{expires_unix}".encode()
    return hmac.new(hmac_key.encode(), message, hashlib.sha256).hexdigest()


def verify_staff_put_signature(
    *,
    hmac_key: str,
    object_key: str,
    expires_unix: int,
    signature: str,
    now: datetime | None = None,
) -> bool:
    current = int((now or timezone.now()).astimezone(UTC).timestamp())
    if expires_unix <= current:
        return False
    expected = staff_put_signature(
        hmac_key=hmac_key, object_key=object_key, expires_unix=expires_unix
    )
    if not signature or len(signature) != len(expected):
        return False
    return hmac.compare_digest(signature, expected)


def _ttl_seconds(ttl_seconds: int | None) -> int:
    if ttl_seconds is not None:
        return ttl_seconds
    return int(getattr(settings, "STAFF_UPLOAD_URL_TTL_SECONDS", 600) or 600)


def _staff_put_hmac_key() -> str:
    return str(getattr(settings, "SECRET_KEY", "") or "")


def _fake_upload_host() -> str:
    for candidate in getattr(settings, "ALLOWED_HOSTS", []):
        host = str(candidate).strip()
        if host and host not in {"*", "[::1]"}:
            return host
    return "localhost"


class FakeObjectStore:
    """In-process private objects for local/CI. HMAC is not the playback playlist token."""

    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}

    def reset(self) -> None:
        self._objects.clear()

    def mint_put_url(
        self,
        object_key: str,
        *,
        ttl_seconds: int | None = None,
        now: datetime | None = None,
    ) -> tuple[str, datetime]:
        pk = _pk_from_object_key(object_key)
        now_dt = now or timezone.now()
        expires_at = now_dt + timedelta(seconds=_ttl_seconds(ttl_seconds))
        expires_unix = int(expires_at.astimezone(UTC).timestamp())
        signature = staff_put_signature(
            hmac_key=_staff_put_hmac_key(),
            object_key=object_key,
            expires_unix=expires_unix,
        )
        query = urlencode({"exp": expires_unix, "sig": signature})
        url = f"https://{_fake_upload_host()}/internal/staff-masters/{pk}?{query}"
        return url, expires_at

    def put_bytes(self, object_key: str, data: bytes) -> None:
        self._objects[object_key] = data

    def get_bytes(self, object_key: str) -> bytes:
        try:
            return self._objects[object_key]
        except KeyError as error:
            raise ObjectNotFoundError(object_key) from error


def _pk_from_object_key(object_key: str) -> int:
    prefix = f"{STAFF_MASTER_KEY_PREFIX}/"
    if not object_key.startswith(prefix):
        raise ValueError("Object key must use the staff-masters prefix.")
    raw_pk = object_key[len(prefix) :]
    if not raw_pk.isdigit() or raw_pk.startswith("0"):
        raise ValueError("Object key must end with a positive integer pk.")
    return int(raw_pk)


class GCSObjectStore:
    """Private GCS adapter. Lazy client. Never public ACL. Not a playback origin."""

    def __init__(self, bucket_name: str) -> None:
        if not bucket_name.strip():
            raise ValueError("STAFF_UPLOAD_GCS_BUCKET is required for gcs.")
        self._bucket_name = bucket_name.strip()
        self._client: Any = None

    def _bucket(self) -> Any:
        from google.cloud import storage

        if self._client is None:
            self._client = storage.Client()
        return self._client.bucket(self._bucket_name)

    def _blob(self, object_key: str) -> Any:
        _pk_from_object_key(object_key)
        return self._bucket().blob(object_key)

    def mint_put_url(
        self,
        object_key: str,
        *,
        ttl_seconds: int | None = None,
        now: datetime | None = None,
    ) -> tuple[str, datetime]:
        del now
        ttl = _ttl_seconds(ttl_seconds)
        expires_at = timezone.now() + timedelta(seconds=ttl)
        blob = self._blob(object_key)
        url = blob.generate_signed_url(
            version="v4",
            method="PUT",
            expiration=timedelta(seconds=max(ttl, 1)),
        )
        return str(url), expires_at

    def get_bytes(self, object_key: str) -> bytes:
        blob = self._blob(object_key)
        if not blob.exists():
            raise ObjectNotFoundError(object_key)
        return bytes(blob.download_as_bytes())


def reset_object_store_cache() -> None:
    global _cached_store, _store_resolved
    current = _cached_store
    if isinstance(current, FakeObjectStore):
        current.reset()
    _cached_store = None
    _store_resolved = False


def get_object_store() -> ObjectStore | None:
    """Return the configured private store, or None when minting is disabled."""
    global _cached_store, _store_resolved
    if _store_resolved:
        return _cached_store
    name = str(getattr(settings, "STAFF_UPLOAD_STORE", "")).strip().lower()
    store: ObjectStore | None
    if name == "fake":
        store = FakeObjectStore()
    elif name == "gcs":
        bucket = str(getattr(settings, "STAFF_UPLOAD_GCS_BUCKET", "")).strip()
        store = GCSObjectStore(bucket_name=bucket) if bucket else None
    else:
        store = None
    _cached_store = store
    _store_resolved = True
    return store

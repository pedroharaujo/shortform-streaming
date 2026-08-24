from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import UTC, datetime
from urllib.parse import parse_qs, quote, urlparse

FAKE_CDN_HOST = "video.example.test"


def fake_signature(*, hmac_key: str, asset_id: str, expires_unix: int, host: str) -> str:
    message = f"{asset_id}\n{expires_unix}\n{host}".encode()
    return hmac.new(hmac_key.encode(), message, hashlib.sha256).hexdigest()


def fake_playlist_url(
    *,
    hmac_key: str,
    asset_id: str,
    expires_at: datetime,
    host: str = FAKE_CDN_HOST,
) -> str:
    expires_unix = int(expires_at.astimezone(UTC).timestamp())
    signature = fake_signature(
        hmac_key=hmac_key, asset_id=asset_id, expires_unix=expires_unix, host=host
    )
    return (
        f"https://{host}/hls/{quote(asset_id, safe='')}/playlist.m3u8"
        f"?sig={signature}&exp={expires_unix}&host={quote(host, safe='')}"
    )


def fake_unsigned_playlist_url(asset_id: str, host: str = FAKE_CDN_HOST) -> str:
    return f"https://{host}/hls/{quote(asset_id, safe='')}/playlist.m3u8"


def referrer_host(referrer: str | None) -> str | None:
    if referrer is None or not referrer.strip():
        return None
    parsed = urlparse(referrer)
    hostname = parsed.hostname
    return hostname.casefold() if hostname else None


def host_allowed(request_host: str | None, allowed_host: str) -> bool:
    if request_host is None or not request_host.strip():
        return False
    return request_host.strip().casefold().split(":", 1)[0] == allowed_host.casefold()


def referrer_allowed(referrer: str | None, allowed_host: str) -> bool:
    hostname = referrer_host(referrer)
    if hostname is None:
        return False
    return hostname == allowed_host.casefold()


def verify_fake_playback_url(
    url: str,
    *,
    hmac_key: str,
    now: datetime,
    request_host: str | None,
    referrer: str | None,
) -> bool:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    signature_values = query.get("sig", [])
    exp_values = query.get("exp", [])
    host_values = query.get("host", [])
    if not signature_values or not exp_values or not host_values:
        return False
    try:
        expires_unix = int(exp_values[0])
    except ValueError:
        return False
    if expires_unix <= int(now.astimezone(UTC).timestamp()):
        return False
    allowed_host = host_values[0]
    if not host_allowed(request_host, allowed_host):
        return False
    if not referrer_allowed(referrer, allowed_host):
        return False
    path_parts = [part for part in parsed.path.split("/") if part]
    if len(path_parts) < 3 or path_parts[0] != "hls" or path_parts[-1] != "playlist.m3u8":
        return False
    asset_id = path_parts[1]
    expected = fake_signature(
        hmac_key=hmac_key, asset_id=asset_id, expires_unix=expires_unix, host=allowed_host
    )
    return hmac.compare_digest(signature_values[0], expected)


def sign_bunny_directory_hls_url(
    *,
    cdn_hostname: str,
    video_id: str,
    security_key: str,
    expires_at: datetime,
) -> str:
    """Path-based Bunny CDN token (SHA256 + expiry) covering HLS segments.

    Directory tokens are required so relative ``.ts`` requests inherit access.
    See https://docs.bunny.net/cdn/security/token-authentication and Stream
    security notes that HLS must use path-style tokens.
    """
    expires = int(expires_at.astimezone(UTC).timestamp())
    token_path = f"/{video_id}/"
    parameters = {"token_path": token_path}
    parameter_data = "".join(f"{key}={value}" for key, value in sorted(parameters.items()))
    hashable = f"{security_key}{token_path}{expires}{parameter_data}"
    digest = hashlib.sha256(hashable.encode("utf-8")).digest()
    encoded = (
        base64.b64encode(digest).decode("ascii").replace("+", "-").replace("/", "_").rstrip("=")
    )
    encoded_path = quote(token_path, safe="")
    return (
        f"https://{cdn_hostname}/bcdn_token={encoded}"
        f"&token_path={encoded_path}&expires={expires}"
        f"/{video_id}/playlist.m3u8"
    )


def bunny_unsigned_playlist_url(*, cdn_hostname: str, video_id: str) -> str:
    return f"https://{cdn_hostname}/{video_id}/playlist.m3u8"


def bunny_url_has_signature(url: str) -> bool:
    parsed = urlparse(url)
    combined = f"{parsed.path}?{parsed.query}"
    signature_marker = "bcdn_token" + "="
    return signature_marker in combined and "expires=" in combined


def bunny_url_expires_unix(url: str) -> int | None:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if "expires" in query:
        try:
            return int(query["expires"][0])
        except ValueError:
            return None
    for part in parsed.path.split("/"):
        if "expires=" not in part:
            continue
        params = parse_qs(part)
        if "expires" not in params:
            continue
        try:
            return int(params["expires"][0])
        except ValueError:
            return None
    return None

"""AdMob SSV verification. No client or configurable source supplies trust keys."""

from __future__ import annotations

import base64
import binascii
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from time import monotonic
from typing import Any
from urllib.parse import parse_qsl
from urllib.request import HTTPRedirectHandler, build_opener

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from rest_framework.exceptions import APIException

KEY_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json"
_cache_lock = Lock()
_keys: dict[str, ec.EllipticCurvePublicKey] = {}
_fetched_at = 0.0
_FIELDS = {
    "ad_network",
    "ad_unit",
    "custom_data",
    "reward_amount",
    "reward_item",
    "timestamp",
    "transaction_id",
    "user_id",
    "signature",
    "key_id",
}


class InvalidCallback(APIException):
    status_code = 400
    default_code = "invalid_reward_callback"
    default_detail = "The reward callback is invalid."
    envelope_message = default_detail


class VerificationUnavailable(APIException):
    status_code = 503
    default_code = "reward_verification_unavailable"
    default_detail = "Reward verification is temporarily unavailable."
    envelope_message = default_detail


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        return None


def clear_key_cache() -> None:
    global _fetched_at
    with _cache_lock:
        _keys.clear()
        _fetched_at = 0.0


def fetch_key_document() -> object:
    try:
        with build_opener(_NoRedirect()).open(KEY_URL, timeout=5) as response:
            raw = response.read(65_537)
            if response.status != 200 or len(raw) > 65_536:
                raise VerificationUnavailable()
            return json.loads(raw)
    except (OSError, ValueError):
        raise VerificationUnavailable() from None


def _public_key(key_id: str) -> ec.EllipticCurvePublicKey:
    global _fetched_at
    with _cache_lock:
        age = monotonic() - _fetched_at
        # Refresh on expiry and unknown key, but no per-request unknown-key I/O.
        if not _keys or age >= 23 * 3600 or (key_id not in _keys and age >= 60):
            document = fetch_key_document()
            try:
                if not isinstance(document, dict):
                    raise ValueError
                rows = document["keys"]
                if not isinstance(rows, list) or not 1 <= len(rows) <= 20:
                    raise ValueError
                loaded: dict[str, ec.EllipticCurvePublicKey] = {}
                for row in rows:
                    key = serialization.load_pem_public_key(row["pem"].encode("ascii"))
                    identifier = str(row["keyId"])
                    if not re.fullmatch(r"[0-9]{1,20}", identifier) or identifier in loaded:
                        raise ValueError
                    if not isinstance(key, ec.EllipticCurvePublicKey) or not isinstance(
                        key.curve, ec.SECP256R1
                    ):
                        raise ValueError
                    loaded[identifier] = key
            except (KeyError, TypeError, ValueError, AttributeError):
                raise VerificationUnavailable() from None
            _keys.clear()
            _keys.update(loaded)
            _fetched_at = monotonic()
        cached_key = _keys.get(key_id)
        if cached_key is None:
            raise InvalidCallback()
        return cached_key


@dataclass(frozen=True)
class VerifiedReward:
    custom_data: str
    user_id: str
    ad_unit: str
    transaction_id: str
    timestamp: datetime


def verify_callback(raw_query: str) -> VerifiedReward:
    if not raw_query or len(raw_query) > 4096 or not raw_query.isascii():
        raise InvalidCallback()
    if re.search(r"%(?![0-9A-Fa-f]{2})|[\s\x00-\x1f\x7f]", raw_query):
        raise InvalidCallback()
    try:
        pairs = parse_qsl(
            raw_query,
            keep_blank_values=True,
            strict_parsing=True,
            encoding="utf-8",
            errors="strict",
            max_num_fields=12,
        )
    except (ValueError, UnicodeError):
        raise InvalidCallback() from None
    fields = dict(pairs)
    if len(fields) != len(pairs) or set(fields) != _FIELDS:
        raise InvalidCallback()
    parts = raw_query.rsplit("&", 2)
    if (
        len(parts) != 3
        or not parts[1].startswith("signature=")
        or not parts[2].startswith("key_id=")
    ):
        raise InvalidCallback()
    if [key for key, _ in pairs[-2:]] != ["signature", "key_id"]:
        raise InvalidCallback()
    signature = fields["signature"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{80,110}={0,2}", signature):
        raise InvalidCallback()
    if not re.fullmatch(r"[0-9]{1,20}", fields["key_id"]):
        raise InvalidCallback()
    try:
        signature_bytes = base64.b64decode(
            signature + "=" * (-len(signature) % 4), altchars=b"-_", validate=True
        )
        _public_key(fields["key_id"]).verify(
            signature_bytes, parts[0].encode("ascii"), ec.ECDSA(hashes.SHA256())
        )
    except (InvalidSignature, ValueError, binascii.Error):
        raise InvalidCallback() from None
    # Both bindings are server-generated token_urlsafe(32) values. Validate
    # decoded data before PostgreSQL lookup or constant-time string comparison.
    if any(
        not re.fullmatch(r"[A-Za-z0-9_-]{43}", fields[name]) for name in ("custom_data", "user_id")
    ):
        raise InvalidCallback()
    if fields["ad_network"] != "5450213213286189855":
        raise InvalidCallback()
    if not re.fullmatch(r"[1-9][0-9]{0,8}", fields["reward_amount"]):
        raise InvalidCallback()
    if not fields["reward_item"] or len(fields["reward_item"]) > 128:
        raise InvalidCallback()
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", fields["transaction_id"]):
        raise InvalidCallback()
    if not re.fullmatch(r"[0-9]{1,15}", fields["timestamp"]):
        raise InvalidCallback()
    try:
        timestamp = datetime.fromtimestamp(int(fields["timestamp"]) / 1000, tz=UTC)
    except (ValueError, OverflowError, OSError):
        raise InvalidCallback() from None
    return VerifiedReward(
        fields["custom_data"],
        fields["user_id"],
        fields["ad_unit"],
        fields["transaction_id"],
        timestamp,
    )

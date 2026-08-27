from __future__ import annotations

import re

_SENSITIVE_QUERY = re.compile(r"(?i)\b(token|sig|expires|bcdn_token|token_path|accesskey)=([^&]*)")
_SECRET_ASSIGNMENT = re.compile(
    r"(?i)\b(api[_-]?key|accesskey|token|bearer|secret|authorization)[=:\s]+[^\s&]+"
)
_ABSOLUTE_URL = re.compile(r"https?://\S+")


def redact_playback_url(url: str) -> str:
    """Strip signing material so logs and command output never leak access."""
    return _SENSITIVE_QUERY.sub(r"\1=redacted", url)


def sanitize_diagnostic(message: str, *, limit: int = 200) -> str:
    """Staff-safe diagnostic: no keys, raw payloads, or usable signed URLs."""
    redacted = redact_playback_url(message)
    redacted = _SECRET_ASSIGNMENT.sub(r"\1=redacted", redacted)
    redacted = _ABSOLUTE_URL.sub("[redacted-url]", redacted)
    redacted = re.sub(r"\s+", " ", redacted).strip()
    if len(redacted) > limit:
        return redacted[: limit - 3] + "..."
    return redacted

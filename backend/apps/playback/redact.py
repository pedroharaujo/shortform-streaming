from __future__ import annotations

import re

_SENSITIVE_QUERY = re.compile(r"(?i)\b(token|sig|expires|bcdn_token|token_path|accesskey)=([^&]*)")


def redact_playback_url(url: str) -> str:
    """Strip signing material so logs and command output never leak access."""
    return _SENSITIVE_QUERY.sub(r"\1=redacted", url)

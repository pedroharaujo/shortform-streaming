from __future__ import annotations

import json
import logging
import re


class RedactQueryString(logging.Filter):
    """Django development access logs must not record SSV custom data/signatures."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "django.server":
            record.msg = re.sub(r"\?\S*(?= HTTP/)", "", record.getMessage())
            record.args = ()
        return True


class PrivacySafeJsonFormatter(logging.Formatter):
    """Format only the reviewed request-completion allowlist as one JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "duration_ms": float(getattr(record, "duration_ms", 0.0)),
            "event": str(getattr(record, "event_name", "request_completed")),
            "http_method": str(getattr(record, "http_method", "OTHER")),
            "http_route": str(getattr(record, "http_route", "other")),
            "http_status": int(getattr(record, "http_status", 0)),
            "request_id": str(getattr(record, "request_id", "")),
            "severity": record.levelname,
        }
        return json.dumps(payload, ensure_ascii=True, separators=(",", ":"), sort_keys=True)

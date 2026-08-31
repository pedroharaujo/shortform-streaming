from __future__ import annotations

import logging
import re


class RedactQueryString(logging.Filter):
    """Django development access logs must not record SSV custom data/signatures."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "django.server":
            record.msg = re.sub(r"\?\S*(?= HTTP/)", "", record.getMessage())
            record.args = ()
        return True

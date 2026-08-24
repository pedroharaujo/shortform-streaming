from __future__ import annotations

import uuid

SERIES_PUBLIC_ID_PREFIX = "ser"
EPISODE_PUBLIC_ID_PREFIX = "ep"


def generate_public_id(prefix: str) -> str:
    """Return an opaque prefixed identifier. Never use a sequential database pk."""
    return f"{prefix}_{uuid.uuid4().hex}"

from __future__ import annotations

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "replace-with-provider-value")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://shortform@127.0.0.1:5432/shortform",
)

from .base import *  # noqa: E402,F403

DEBUG = True
local_allowed_hosts = os.environ.get("DJANGO_ALLOWED_HOSTS", "")
ALLOWED_HOSTS = (
    [host.strip() for host in local_allowed_hosts.split(",") if host.strip()]
    if local_allowed_hosts.strip()
    else ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"]
)

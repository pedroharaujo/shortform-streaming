from __future__ import annotations

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "replace-with-provider-value")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://shortform@127.0.0.1:5432/shortform",
)

from .base import *  # noqa: E402,F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

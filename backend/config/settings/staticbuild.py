from __future__ import annotations

import os

# Placeholders so collectstatic can import shared settings without production
# secrets, SSL fail-fast, or Firebase/Bunny checks. Never used at runtime.
os.environ.setdefault("DJANGO_SECRET_KEY", "replace-with-provider-value")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://shortform@127.0.0.1:5432/shortform",
)

from .base import *  # noqa: E402,F403

DEBUG = False

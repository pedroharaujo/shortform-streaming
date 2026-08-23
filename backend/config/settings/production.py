from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

REQUIRED_ENVIRONMENT = ("DJANGO_SECRET_KEY", "DJANGO_ALLOWED_HOSTS", "DATABASE_URL")
missing = [name for name in REQUIRED_ENVIRONMENT if not os.environ.get(name, "").strip()]
if missing:
    raise ImproperlyConfigured(
        "Missing required production environment variables: " + ", ".join(missing)
    )

from .base import *  # noqa: E402,F403

ALLOWED_HOSTS = [
    host.strip() for host in os.environ["DJANGO_ALLOWED_HOSTS"].split(",") if host.strip()
]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must contain at least one host")

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

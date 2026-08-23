from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parents[2]

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "apps.health",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES: list[dict[str, object]] = []
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

database_url = os.environ.get("DATABASE_URL", "").strip()
try:
    database_scheme = urlsplit(database_url).scheme.casefold()
except ValueError:
    raise ImproperlyConfigured("DATABASE_URL must be a valid PostgreSQL URL") from None
if database_scheme not in {"postgres", "postgresql"}:
    raise ImproperlyConfigured("DATABASE_URL must use the PostgreSQL postgres:// scheme")

try:
    database_config = dj_database_url.parse(database_url, conn_max_age=0, conn_health_checks=True)
except (KeyError, ValueError):
    raise ImproperlyConfigured("DATABASE_URL must be a valid PostgreSQL URL") from None
DATABASES = {"default": database_config}
if DATABASES["default"].get("ENGINE") != "django.db.backends.postgresql":
    raise ImproperlyConfigured("DATABASE_URL must configure the PostgreSQL backend")

connect_timeout_value = os.environ.get("DATABASE_CONNECT_TIMEOUT", "2")
try:
    database_connect_timeout = int(connect_timeout_value)
except ValueError:
    raise ImproperlyConfigured("DATABASE_CONNECT_TIMEOUT must be an integer") from None
if not 1 <= database_connect_timeout <= 10:
    raise ImproperlyConfigured("DATABASE_CONNECT_TIMEOUT must be between 1 and 10 seconds")

DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"]["connect_timeout"] = database_connect_timeout

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from config import spectacular as spectacular_config

BASE_DIR = Path(__file__).resolve().parents[2]
SPECTACULAR_SETTINGS = spectacular_config.SPECTACULAR_SETTINGS

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "drf_spectacular",
    "apps.health",
    "apps.catalog",
    "apps.playback",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES: list[dict[str, object]] = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

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
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.exception_handler",
}

# Playback (P2-T05). Empty VIDEO_PROVIDER disables authorize (fail-closed, no URL).
# Local settings default to "fake". Production rejects "fake".
VIDEO_PROVIDER = os.environ.get("VIDEO_PROVIDER", "").strip().lower()
BUNNY_STREAM_LIBRARY_ID = os.environ.get("BUNNY_STREAM_LIBRARY_ID", "").strip()
BUNNY_STREAM_API_KEY = os.environ.get("BUNNY_STREAM_API_KEY", "").strip()
BUNNY_STREAM_CDN_HOSTNAME = os.environ.get("BUNNY_STREAM_CDN_HOSTNAME", "").strip()
BUNNY_STREAM_TOKEN_KEY = os.environ.get("BUNNY_STREAM_TOKEN_KEY", "").strip()
PLAYBACK_TOKEN_TTL_SECONDS = 600
FAKE_PLAYBACK_CDN_HOST = "video.example.test"


def _parse_playback_spike_assets(raw: str) -> dict[str, str]:
    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ImproperlyConfigured("PLAYBACK_SPIKE_ASSETS must be a JSON object") from error
    if not isinstance(parsed, dict):
        raise ImproperlyConfigured("PLAYBACK_SPIKE_ASSETS must be a JSON object")
    assets: dict[str, str] = {}
    for episode_id, asset_id in parsed.items():
        if not isinstance(episode_id, str) or not isinstance(asset_id, str):
            raise ImproperlyConfigured("PLAYBACK_SPIKE_ASSETS keys and values must be strings")
        if episode_id.strip() and asset_id.strip():
            assets[episode_id.strip()] = asset_id.strip()
    return assets


PLAYBACK_SPIKE_ASSETS = _parse_playback_spike_assets(os.environ.get("PLAYBACK_SPIKE_ASSETS", ""))

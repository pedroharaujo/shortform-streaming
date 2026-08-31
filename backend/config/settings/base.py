from __future__ import annotations

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
    "apps.accounts",
    "apps.playback",
    "apps.entitlements",
    "apps.progress",
    "apps.advertising",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
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
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

database_url = os.environ.get("DATABASE_URL", "").strip()
try:
    database_scheme = urlsplit(database_url).scheme.casefold()
except ValueError:
    raise ImproperlyConfigured("DATABASE_URL must be a valid PostgreSQL URL") from None
if database_scheme not in {"postgres", "postgresql"}:
    raise ImproperlyConfigured("DATABASE_URL must use the PostgreSQL postgres:// scheme")

conn_max_age_value = os.environ.get("CONN_MAX_AGE", "0")
try:
    database_conn_max_age = int(conn_max_age_value)
except ValueError:
    raise ImproperlyConfigured("CONN_MAX_AGE must be an integer") from None
if not 0 <= database_conn_max_age <= 3600:
    raise ImproperlyConfigured("CONN_MAX_AGE must be between 0 and 3600 seconds")

try:
    database_config = dj_database_url.parse(
        database_url, conn_max_age=database_conn_max_age, conn_health_checks=True
    )
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

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"redact_query": {"()": "config.logging.RedactQueryString"}},
    "loggers": {"django.server": {"filters": ["redact_query"]}},
}

# Identity: local/CI default is mock verification. Production settings force
# firebase-admin and fail closed when a token cannot be verified.
FIREBASE_AUTH_MODE = os.environ.get("FIREBASE_AUTH_MODE", "").strip().lower()
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "").strip()

# Playback (P2-T05). Empty VIDEO_PROVIDER disables authorize (fail-closed, no URL).
# Local settings default to "fake". Production rejects "fake".
VIDEO_PROVIDER = os.environ.get("VIDEO_PROVIDER", "").strip().lower()
BUNNY_STREAM_LIBRARY_ID = os.environ.get("BUNNY_STREAM_LIBRARY_ID", "").strip()
BUNNY_STREAM_API_KEY = os.environ.get("BUNNY_STREAM_API_KEY", "").strip()
BUNNY_STREAM_CDN_HOSTNAME = os.environ.get("BUNNY_STREAM_CDN_HOSTNAME", "").strip()
BUNNY_STREAM_TOKEN_KEY = os.environ.get("BUNNY_STREAM_TOKEN_KEY", "").strip()
PLAYBACK_TOKEN_TTL_SECONDS = 600
FAKE_PLAYBACK_CDN_HOST = "video.example.test"

# P3-T07 is an explicit local test integration; no live-ad mode is implemented.
REWARDED_ADS_MODE = os.environ.get("REWARDED_ADS_MODE", "disabled").strip().lower()
if REWARDED_ADS_MODE not in {"disabled", "test"}:
    raise ImproperlyConfigured("REWARDED_ADS_MODE must be disabled or test.")

# Staff signed PUT landing zone (P2-T06-F1). Empty disables minting.
# Local settings default to "fake". Production rejects "fake".
STAFF_UPLOAD_STORE = os.environ.get("STAFF_UPLOAD_STORE", "").strip().lower()
STAFF_UPLOAD_GCS_BUCKET = os.environ.get("STAFF_UPLOAD_GCS_BUCKET", "").strip()
_raw_staff_upload_ttl = os.environ.get("STAFF_UPLOAD_URL_TTL_SECONDS", "600").strip() or "600"
try:
    STAFF_UPLOAD_URL_TTL_SECONDS = int(_raw_staff_upload_ttl)
except ValueError:
    STAFF_UPLOAD_URL_TTL_SECONDS = 600

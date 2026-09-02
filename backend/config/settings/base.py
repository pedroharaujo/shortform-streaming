from __future__ import annotations

import os
import re
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
    "config.observability.RequestCorrelationMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "config.request_boundaries.APIRequestBoundaryMiddleware",
    "config.app_check.FirebaseAppCheckMiddleware",
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
    "DEFAULT_PARSER_CLASSES": ["config.request_boundaries.BoundedJSONParser"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.exception_handler",
}

# Consumer API bodies are tiny JSON commands and never accept or serve video bytes.
# Staff-only Admin ingestion is a separate, bounded workflow.
API_MAX_REQUEST_BODY_BYTES = 64 * 1024

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"redact_query": {"()": "config.logging.RedactQueryString"}},
    "formatters": {
        "privacy_safe_json": {"()": "config.logging.PrivacySafeJsonFormatter"},
    },
    "handlers": {
        "privacy_safe_console": {
            "class": "logging.StreamHandler",
            "formatter": "privacy_safe_json",
        },
    },
    "loggers": {
        "django.server": {"filters": ["redact_query"]},
        "shortform.request": {
            "handlers": ["privacy_safe_console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# Identity: local/CI default is mock verification. Production settings force
# firebase-admin and fail closed when a token cannot be verified.
FIREBASE_AUTH_MODE = os.environ.get("FIREBASE_AUTH_MODE", "").strip().lower()
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
FIREBASE_APP_CHECK_MODE = os.environ.get("FIREBASE_APP_CHECK_MODE", "disabled").strip().lower()
if FIREBASE_APP_CHECK_MODE not in {"disabled", "enforce"}:
    raise ImproperlyConfigured("FIREBASE_APP_CHECK_MODE must be disabled or enforce.")
FIREBASE_APP_CHECK_VERIFIER = os.environ.get("FIREBASE_APP_CHECK_VERIFIER", "mock").strip().lower()
if FIREBASE_APP_CHECK_VERIFIER not in {"mock", "admin"}:
    raise ImproperlyConfigured("FIREBASE_APP_CHECK_VERIFIER must be mock or admin.")
FIREBASE_APP_CHECK_APP_ID = os.environ.get("FIREBASE_APP_CHECK_APP_ID", "").strip()
if FIREBASE_APP_CHECK_APP_ID and (
    len(FIREBASE_APP_CHECK_APP_ID) > 256
    or not FIREBASE_APP_CHECK_APP_ID.isascii()
    or not FIREBASE_APP_CHECK_APP_ID.isprintable()
    or any(character.isspace() for character in FIREBASE_APP_CHECK_APP_ID)
):
    raise ImproperlyConfigured("FIREBASE_APP_CHECK_APP_ID must be a valid public app identifier.")
if FIREBASE_APP_CHECK_MODE == "enforce" and not FIREBASE_APP_CHECK_APP_ID:
    raise ImproperlyConfigured(
        "FIREBASE_APP_CHECK_APP_ID is required when App Check enforcement is enabled."
    )

# Playback (P2-T05). Empty VIDEO_PROVIDER disables authorize (fail-closed, no URL).
# Local settings default to "fake". Production rejects "fake".
VIDEO_PROVIDER = os.environ.get("VIDEO_PROVIDER", "").strip().lower()
BUNNY_STREAM_LIBRARY_ID = os.environ.get("BUNNY_STREAM_LIBRARY_ID", "").strip()
BUNNY_STREAM_API_KEY = os.environ.get("BUNNY_STREAM_API_KEY", "").strip()
BUNNY_STREAM_CDN_HOSTNAME = os.environ.get("BUNNY_STREAM_CDN_HOSTNAME", "").strip()
BUNNY_STREAM_TOKEN_KEY = os.environ.get("BUNNY_STREAM_TOKEN_KEY", "").strip()
PLAYBACK_TOKEN_TTL_SECONDS = 600
FAKE_PLAYBACK_CDN_HOST = "video.example.test"

# Private landing zone for Admin-managed master uploads. The signed URL is
# short-lived and never persisted. Empty disables ingestion.
STAFF_UPLOAD_STORE = os.environ.get("STAFF_UPLOAD_STORE", "").strip().lower()
STAFF_UPLOAD_GCS_BUCKET = os.environ.get("STAFF_UPLOAD_GCS_BUCKET", "").strip()
_raw_staff_upload_ttl = os.environ.get("STAFF_UPLOAD_URL_TTL_SECONDS", "600").strip()
try:
    STAFF_UPLOAD_URL_TTL_SECONDS = int(_raw_staff_upload_ttl or "600")
except ValueError:
    STAFF_UPLOAD_URL_TTL_SECONDS = 600

# Rewarded ads are fail-closed. Test and production use the same server-side
# verification path; production activation is an explicit release setting.
REWARDED_ADS_MODE = os.environ.get("REWARDED_ADS_MODE", "disabled").strip().lower()
if REWARDED_ADS_MODE not in {"disabled", "test", "production"}:
    raise ImproperlyConfigured("REWARDED_ADS_MODE must be disabled, test, or production.")
REWARDED_ADS_DEMO_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
REWARDED_ADS_UNIT_ID = os.environ.get("REWARDED_ADS_UNIT_ID", "").strip()
if REWARDED_ADS_MODE == "test" and not REWARDED_ADS_UNIT_ID:
    REWARDED_ADS_UNIT_ID = REWARDED_ADS_DEMO_UNIT_ID
if (
    REWARDED_ADS_MODE != "disabled"
    and re.fullmatch(r"ca-app-pub-[0-9]{16}/[0-9]{10}", REWARDED_ADS_UNIT_ID) is None
):
    raise ImproperlyConfigured(
        "REWARDED_ADS_UNIT_ID must be a valid AdMob ad unit ID when rewarded ads are enabled."
    )

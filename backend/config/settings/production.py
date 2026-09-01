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

if os.environ.get("REWARDED_ADS_MODE", "disabled").strip().lower() != "disabled":
    raise ImproperlyConfigured("Production rewarded ads are disabled pending release approval.")
if "REWARDED_ADS_TEST_UNIT_ID" in os.environ:
    raise ImproperlyConfigured("REWARDED_ADS_TEST_UNIT_ID is not allowed in production.")

ALLOWED_HOSTS = [
    host.strip() for host in os.environ["DJANGO_ALLOWED_HOSTS"].split(",") if host.strip()
]
FIREBASE_AUTH_MODE = os.environ.get("FIREBASE_AUTH_MODE", "admin").strip().lower() or "admin"
if FIREBASE_AUTH_MODE != "admin":
    raise ImproperlyConfigured(
        "Production Firebase verification must use firebase-admin (FIREBASE_AUTH_MODE=admin)."
    )
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
if not FIREBASE_PROJECT_ID:
    raise ImproperlyConfigured("FIREBASE_PROJECT_ID is required in production")
if os.environ.get("FIREBASE_AUTH_EMULATOR_HOST", "").strip():
    raise ImproperlyConfigured("FIREBASE_AUTH_EMULATOR_HOST is not allowed in production.")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must contain at least one host")

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_NAME = "__Secure-shortform_admin_session"
SESSION_COOKIE_PATH = "/admin/"
SESSION_COOKIE_AGE = 60 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_USE_SESSIONS = True
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

_video_provider = os.environ.get("VIDEO_PROVIDER", "").strip().lower()
if _video_provider == "fake":
    raise ImproperlyConfigured("VIDEO_PROVIDER=fake is not allowed in production")
if _video_provider == "bunny":
    missing_bunny = [
        name
        for name in (
            "BUNNY_STREAM_LIBRARY_ID",
            "BUNNY_STREAM_API_KEY",
            "BUNNY_STREAM_CDN_HOSTNAME",
            "BUNNY_STREAM_TOKEN_KEY",
        )
        if not os.environ.get(name, "").strip()
    ]
    if missing_bunny:
        raise ImproperlyConfigured(
            "Missing required Bunny Stream production environment variables: "
            + ", ".join(missing_bunny)
        )
elif _video_provider:
    raise ImproperlyConfigured("VIDEO_PROVIDER must be empty (disabled) or bunny in production")

_staff_upload_store = os.environ.get("STAFF_UPLOAD_STORE", "").strip().lower()
if _staff_upload_store == "fake":
    raise ImproperlyConfigured("STAFF_UPLOAD_STORE=fake is not allowed in production")
if _staff_upload_store == "gcs":
    if not os.environ.get("STAFF_UPLOAD_GCS_BUCKET", "").strip():
        raise ImproperlyConfigured(
            "STAFF_UPLOAD_GCS_BUCKET is required when STAFF_UPLOAD_STORE=gcs"
        )
elif _staff_upload_store:
    raise ImproperlyConfigured("STAFF_UPLOAD_STORE must be empty (disabled) or gcs in production")

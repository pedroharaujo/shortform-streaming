from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

os.environ.setdefault("DJANGO_SECRET_KEY", "replace-with-provider-value")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://shortform@127.0.0.1:5432/shortform",
)
os.environ.setdefault("VIDEO_PROVIDER", "fake")
os.environ.setdefault("STAFF_UPLOAD_STORE", "fake")

from .base import *  # noqa: E402,F403

DEBUG = True
if REWARDED_ADS_MODE == "production":  # noqa: F405
    raise ImproperlyConfigured("Local settings cannot enable production rewarded ads.")

FIREBASE_AUTH_MODE = os.environ.get("FIREBASE_AUTH_MODE", "mock").strip().lower() or "mock"
if FIREBASE_AUTH_MODE not in {"mock", "admin"}:
    raise ImproperlyConfigured("FIREBASE_AUTH_MODE must be 'mock' or 'admin'")
FIREBASE_PROJECT_ID = (
    os.environ.get("FIREBASE_PROJECT_ID", "demo-shortform-local").strip() or "demo-shortform-local"
)
local_allowed_hosts = os.environ.get("DJANGO_ALLOWED_HOSTS", "")
ALLOWED_HOSTS = (
    [host.strip() for host in local_allowed_hosts.split(",") if host.strip()]
    if local_allowed_hosts.strip()
    else ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"]
)

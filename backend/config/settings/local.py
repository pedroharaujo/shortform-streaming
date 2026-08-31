from __future__ import annotations

import os
import re

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
_rewarded_test_unit = os.environ.get("REWARDED_ADS_TEST_UNIT_ID")
if _rewarded_test_unit is not None:
    if REWARDED_ADS_MODE != "test":  # noqa: F405
        raise ImproperlyConfigured(
            "REWARDED_ADS_TEST_UNIT_ID requires local rewarded ads test mode."
        )
    if re.fullmatch(r"ca-app-pub-[0-9]{16}/[0-9]{10}", _rewarded_test_unit) is None:
        raise ImproperlyConfigured("REWARDED_ADS_TEST_UNIT_ID must be a valid AdMob ad unit ID.")
    REWARDED_ADS_TEST_UNIT_ID = _rewarded_test_unit

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

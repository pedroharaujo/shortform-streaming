"""Secure consumer-only Android tester service (P5-T05-F4 / #121)."""

from django.core.exceptions import ImproperlyConfigured

from .secure import *  # noqa: F403

if COIN_PURCHASE_MODE not in {"disabled", "revenuecat_sandbox"}:  # noqa: F405
    raise ImproperlyConfigured("Hosted coin purchases require RevenueCat sandbox mode.")
if COIN_SPENDING_MODE not in {"disabled", "revenuecat_sandbox"}:  # noqa: F405
    raise ImproperlyConfigured("Hosted coin spending requires RevenueCat sandbox mode.")
if REWARDED_ADS_MODE != "disabled":  # noqa: F405
    raise ImproperlyConfigured("Rewarded ads must remain disabled in hosted sandbox settings.")

# This marker is owned by the settings module; no environment toggle can enable it.
HOSTED_SANDBOX = True
ROOT_URLCONF = "config.consumer_urls"

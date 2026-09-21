from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

from .secure import *  # noqa: F403

if COIN_PURCHASE_MODE != "disabled":  # noqa: F405
    raise ImproperlyConfigured("Coin purchases cannot be enabled in production settings yet.")

if COIN_SPENDING_MODE != "disabled":  # noqa: F405
    raise ImproperlyConfigured("Coin spending cannot be enabled in production settings yet.")

if "REWARDED_ADS_TEST_UNIT_ID" in os.environ:
    raise ImproperlyConfigured("REWARDED_ADS_TEST_UNIT_ID is obsolete; use REWARDED_ADS_UNIT_ID.")
if REWARDED_ADS_MODE == "test":  # noqa: F405
    raise ImproperlyConfigured("REWARDED_ADS_MODE=test is not allowed in production settings.")
if REWARDED_ADS_MODE == "production" and (  # noqa: F405
    not REWARDED_ADS_UNIT_ID  # noqa: F405
    or REWARDED_ADS_UNIT_ID == REWARDED_ADS_DEMO_UNIT_ID  # noqa: F405
):
    raise ImproperlyConfigured(
        "Production rewarded ads require a publisher-owned REWARDED_ADS_UNIT_ID."
    )

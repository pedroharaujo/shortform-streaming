from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings

from apps.catalog.iso_codes import ISO_COUNTRIES, ISO_LANGUAGES

# The same membership patterns are used by Python validation and SQL admission.
TERRITORY = "(?:" + "|".join(sorted(ISO_COUNTRIES)) + ")"
LANGUAGE = "(?:" + "|".join(sorted(ISO_LANGUAGES)) + ")"
PLATFORM = r"(?:android|ios)"
STOREFRONT = r"(?:google_play|app_store)"


def valid_scope(value: object, pattern: str, *, empty: bool = False) -> bool:
    return (
        isinstance(value, list)
        and (empty or bool(value))
        and all(isinstance(code, str) and re.fullmatch(pattern, code) for code in value)
    )


PLATFORM_STOREFRONTS = {"android": "google_play", "ios": "app_store"}


@dataclass(frozen=True)
class LaunchContext:
    country: str
    platform: str
    storefront: str
    language: str
    audience_segment: str | None = None


def resolve_launch_context() -> LaunchContext | None:
    """Resolve trusted deployment configuration; never consume request or profile inputs."""
    value = getattr(settings, "CATALOG_LAUNCH_CONTEXT", None)
    if not isinstance(value, dict) or value.get("enabled") is not True:
        return None
    country, platform, storefront, language = (
        value.get(key) for key in ("country", "platform", "storefront", "language")
    )
    if not all(isinstance(item, str) for item in (country, platform, storefront, language)):
        return None
    if not isinstance(country, str) or country not in ISO_COUNTRIES:
        return None
    if not isinstance(language, str) or language not in ISO_LANGUAGES:
        return None
    if not isinstance(platform, str) or PLATFORM_STOREFRONTS.get(platform) != storefront:
        return None
    if not isinstance(storefront, str):
        return None
    segment = value.get("audience_segment")
    if segment is not None and (
        not isinstance(segment, str) or re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", segment) is None
    ):
        return None
    return LaunchContext(country, platform, storefront, language, segment)

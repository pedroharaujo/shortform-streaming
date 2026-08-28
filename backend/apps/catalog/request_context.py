from __future__ import annotations

from rest_framework.exceptions import APIException
from rest_framework.request import Request

from apps.catalog.eligibility import CatalogRequestContext
from apps.catalog.models import ALLOWED_PLATFORMS, ISO_639_1, ISO_3166_1_ALPHA_2
from config.error_envelope import FieldError

TERRITORY_HEADER = "X-Territory"
PLATFORM_HEADER = "X-Platform"
LANGUAGE_HEADER = "X-Language"

_CONTEXT_MESSAGE = (
    "X-Territory, X-Platform, and X-Language are required explicit catalog context "
    "and are never inferred from Accept-Language or UI language."
)


class CatalogContextError(APIException):
    status_code = 400
    default_code = "invalid_request_context"
    default_detail = _CONTEXT_MESSAGE
    envelope_code = "invalid_request_context"
    envelope_message = _CONTEXT_MESSAGE

    def __init__(self, field_errors: list[FieldError]) -> None:
        self.field_errors = field_errors
        super().__init__(detail=_CONTEXT_MESSAGE)


def parse_catalog_context(request: Request) -> CatalogRequestContext:
    """Parse required catalog headers. Missing or malformed values are HTTP 400.

    Well-formed unknown territories (for example US) are accepted here; eligibility
    then returns no titles. Values are never defaulted from Accept-Language.
    """
    errors: list[FieldError] = []
    territory = _header(request, "HTTP_X_TERRITORY")
    platform = _header(request, "HTTP_X_PLATFORM")
    language = _header(request, "HTTP_X_LANGUAGE")

    if territory is None:
        errors.append(_missing(TERRITORY_HEADER))
        territory_value = ""
    elif not ISO_3166_1_ALPHA_2.fullmatch(territory):
        errors.append(
            {
                "field": TERRITORY_HEADER,
                "code": "invalid",
                "message": "X-Territory must be ISO 3166-1 alpha-2 (for example FR).",
            }
        )
        territory_value = ""
    else:
        territory_value = territory.upper()

    if platform is None:
        errors.append(_missing(PLATFORM_HEADER))
        platform_value = ""
    else:
        platform_value = platform.strip().lower()
        if platform_value not in ALLOWED_PLATFORMS:
            errors.append(
                {
                    "field": PLATFORM_HEADER,
                    "code": "invalid",
                    "message": "X-Platform must be ios or android.",
                }
            )
            platform_value = ""

    if language is None:
        errors.append(_missing(LANGUAGE_HEADER))
        language_value = ""
    elif not ISO_639_1.fullmatch(language):
        errors.append(
            {
                "field": LANGUAGE_HEADER,
                "code": "invalid",
                "message": "X-Language must be ISO 639-1 (for example en).",
            }
        )
        language_value = ""
    else:
        language_value = language.lower()

    if errors:
        raise CatalogContextError(errors)
    return CatalogRequestContext(
        territory=territory_value,
        platform=platform_value,
        language=language_value,
    )


def _header(request: Request, meta_key: str) -> str | None:
    raw = request.META.get(meta_key)
    if raw is None:
        return None
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    return value if value else None


def _missing(name: str) -> FieldError:
    return {
        "field": name,
        "code": "required",
        "message": f"{name} is required and is never inferred from Accept-Language.",
    }

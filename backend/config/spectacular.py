from __future__ import annotations

from typing import Any

SHARED_COMPONENT_SCHEMAS: dict[str, dict[str, object]] = {
    "ErrorEnvelope": {
        "type": "object",
        "description": (
            "Stable API error envelope. `message` is a safe, user-displayable string. "
            "`request_id` is the correlation identifier for the request."
        ),
        "required": ["code", "message", "request_id"],
        "properties": {
            "code": {
                "type": "string",
                "description": "Stable machine-readable error code.",
                "minLength": 1,
            },
            "message": {
                "type": "string",
                "description": "Safe, user-displayable error message. Never includes secrets.",
            },
            "request_id": {
                "type": "string",
                "description": "Correlation / request identifier for support and tracing.",
                "minLength": 1,
            },
            "field_errors": {
                "type": "array",
                "description": "Optional per-field validation errors.",
                "items": {"$ref": "#/components/schemas/FieldError"},
            },
        },
    },
    "FieldError": {
        "type": "object",
        "description": "A single field-level validation error.",
        "required": ["field", "code", "message"],
        "properties": {
            "field": {
                "type": "string",
                "description": "Field name, or empty for non-field errors.",
            },
            "code": {
                "type": "string",
                "description": "Machine-readable field error code.",
                "minLength": 1,
            },
            "message": {
                "type": "string",
                "description": "Safe, user-displayable field message.",
            },
        },
    },
    "CursorPage": {
        "type": "object",
        "description": (
            "Cursor-paginated list envelope. `cursor` and `next` are opaque strings, "
            "never numeric offsets. Concrete list operations replace `results` item types."
        ),
        "required": ["cursor", "next", "results"],
        "properties": {
            "cursor": {
                "type": "string",
                "nullable": True,
                "description": "Opaque cursor for the current page.",
            },
            "next": {
                "type": "string",
                "nullable": True,
                "description": "Opaque cursor for the next page, or null when none remains.",
            },
            "results": {
                "type": "array",
                "description": "Page of resources. Item schemas are specified per list operation.",
                "items": {"type": "object", "additionalProperties": True},
            },
        },
    },
    "PublicId": {
        "type": "string",
        "minLength": 1,
        "description": (
            "Opaque public identifier. Sequential database integers are never used as public IDs."
        ),
        "example": "ser_1a2b3c4d5e6f",
    },
}

BEARER_SCHEME: dict[str, object] = {
    "type": "http",
    "scheme": "bearer",
    "bearerFormat": "JWT",
    "description": (
        "Firebase Authentication ID token presented as an HTTP Bearer credential. "
        "Django verifies the token and maps the UID to one local profile. "
        "Health probes and anonymous catalog reads do not use this scheme. "
        "POST /v1/playback/{episode_id}/authorize and GET/PUT /v1/progress/{episode_id} "
        "and GET /v1/offers/{episode_id} "
        "accept this scheme optionally: a missing token is anonymous; a present "
        "invalid token is 401. Client-supplied user or profile identifiers are ignored."
    ),
}

HEALTH_PATHS = ("/health/live", "/health/ready")
# Anonymous catalog (P2-T03). Keep these unauthenticated even if a later task
# sets a global Firebase security requirement. Playback authorize is optional
# Firebase (P2-T07) and is not forced empty.
UNAUTHENTICATED_PATH_PREFIXES = (
    "/health/",
    "/v1/catalog/",
    "/v1/series/",
    "/v1/episodes/",
)
OPTIONAL_FIREBASE_PATH_PREFIXES = ("/v1/playback/", "/v1/progress/", "/v1/offers/")


def inject_shared_components(
    result: dict[str, Any],
    generator: object,
    request: object,
    public: bool,
) -> dict[str, Any]:
    del generator, request, public
    components = result.setdefault("components", {})
    schemas = components.setdefault("schemas", {})
    for name, schema in SHARED_COMPONENT_SCHEMAS.items():
        schemas.setdefault(name, schema)

    security_schemes = components.setdefault("securitySchemes", {})
    security_schemes.setdefault("FirebaseIdToken", BEARER_SCHEME)

    paths = result.get("paths", {})
    if isinstance(paths, dict):
        for path, path_item in paths.items():
            if not isinstance(path, str) or not isinstance(path_item, dict):
                continue
            if any(
                path == prefix[:-1] or path.startswith(prefix)
                for prefix in UNAUTHENTICATED_PATH_PREFIXES
            ):
                for operation in path_item.values():
                    if isinstance(operation, dict) and "responses" in operation:
                        operation["security"] = []
            elif any(
                path == prefix[:-1] or path.startswith(prefix)
                for prefix in OPTIONAL_FIREBASE_PATH_PREFIXES
            ):
                for operation in path_item.values():
                    if isinstance(operation, dict) and "responses" in operation:
                        operation["security"] = [{}, {"FirebaseIdToken": []}]
    return result


SPECTACULAR_SETTINGS: dict[str, object] = {
    "TITLE": "Shortform Streaming API",
    "DESCRIPTION": (
        "HTTP API for the Shortform Streaming MVP. This document is generated from Django; "
        "do not edit docs/api/openapi.yaml by hand. Shared conventions (error envelope, "
        "cursor pagination, opaque public IDs, and Firebase ID-token bearer auth) are "
        "documented as components. Health probes and anonymous catalog reads are "
        "unauthenticated. POST /v1/playback/{episode_id}/authorize accepts an optional "
        "Firebase ID token: a missing token is anonymous, and a present invalid token "
        "is 401 ErrorEnvelope. Catalog-eligible locked episodes return HTTP 200 with "
        "decision locked and lock_reasons, never a playback URL. GET "
        "/v1/offers/{episode_id} accepts the same optional Firebase ID token and "
        "catalog headers; ineligible ids are 404; locked catalog-eligible episodes "
        "return HTTP 200 with methods and never a playback URL. GET/PUT "
        "/v1/progress/{episode_id} accepts the same optional Firebase ID token plus "
        "an anonymous X-Device-Id header; lock is HTTP 403 and the response never "
        "includes a playback URL. Catalog, playback, offers, and progress operations require "
        "explicit X-Territory, X-Platform, and X-Language headers; those values are "
        "never inferred from Accept-Language. GET /v1/me requires FirebaseIdToken; "
        "missing or invalid tokens return 401 ErrorEnvelope. firebase_uid is never "
        "returned. Django never serves video bytes."
    ),
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/",
    "SECURITY": [],
    "APPEND_COMPONENTS": {
        "securitySchemes": {"FirebaseIdToken": BEARER_SCHEME},
        "schemas": SHARED_COMPONENT_SCHEMAS,
    },
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "config.spectacular.inject_shared_components",
    ],
    "ENUM_NAME_OVERRIDES": {
        "PlaybackAuthorizeGrantedDecisionEnum": [("granted", "granted")],
        "PlaybackAuthorizeLockedDecisionEnum": [("locked", "locked")],
        "TypeEnum": [
            ("entitlement", "entitlement"),
            ("free", "free"),
            ("rewarded_ad", "rewarded_ad"),
        ],
    },
}

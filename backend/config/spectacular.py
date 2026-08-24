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
        "Health endpoints do not use this scheme. Token verification is implemented "
        "in a later task."
    ),
}

HEALTH_PATHS = ("/health/live", "/health/ready")


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
    for path in HEALTH_PATHS:
        operation = paths.get(path, {}).get("get")
        if isinstance(operation, dict):
            operation["security"] = []
    return result


SPECTACULAR_SETTINGS: dict[str, object] = {
    "TITLE": "Shortform Streaming API",
    "DESCRIPTION": (
        "HTTP API for the Shortform Streaming MVP. This document is generated from Django; "
        "do not edit docs/api/openapi.yaml by hand. Shared conventions (error envelope, "
        "cursor pagination, opaque public IDs, and Firebase ID-token bearer auth) are "
        "documented as components. Health probes are unauthenticated. Firebase token "
        "verification is not implemented in this schema-only task."
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
}

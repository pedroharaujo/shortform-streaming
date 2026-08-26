from __future__ import annotations

from typing import Any

from django.test import Client
from drf_spectacular.generators import SchemaGenerator

from config.spectacular import (
    BEARER_SCHEME,
    HEALTH_PATHS,
    SHARED_COMPONENT_SCHEMAS,
)


def build_schema() -> dict[str, Any]:
    generator_cls: Any = SchemaGenerator
    schema = generator_cls().get_schema(request=None, public=True)
    assert isinstance(schema, dict)
    return schema


def test_schema_includes_shared_conventions() -> None:
    schema = build_schema()
    components = schema["components"]
    schemas = components["schemas"]
    security_schemes = components["securitySchemes"]

    for name, expected in SHARED_COMPONENT_SCHEMAS.items():
        assert name in schemas
        actual = schemas[name]
        for key in ("type", "description"):
            if key in expected:
                assert actual[key] == expected[key]
        properties = expected.get("properties")
        if isinstance(properties, dict):
            for property_name in properties:
                assert property_name in actual["properties"]
        if "required" in expected:
            assert actual["required"] == expected["required"]

    public_id = schemas["PublicId"]
    assert public_id["type"] == "string"
    assert (
        "integer" not in public_id.get("description", "").casefold()
        or "never" in public_id["description"].casefold()
    )

    error = schemas["ErrorEnvelope"]["properties"]
    assert "code" in error
    assert "message" in error
    assert "request_id" in error
    assert "field_errors" in error

    page = schemas["CursorPage"]["properties"]
    assert "cursor" in page
    assert "next" in page
    assert "results" in page

    assert security_schemes["FirebaseIdToken"]["type"] == BEARER_SCHEME["type"]
    assert security_schemes["FirebaseIdToken"]["scheme"] == "bearer"
    assert schema.get("security") in (None, [])


def test_schema_documents_health_status_and_unauthenticated_probes() -> None:
    schema = build_schema()
    health_status = schema["components"]["schemas"]["HealthStatus"]
    status = health_status["properties"]["status"]
    enum_values = status.get("enum")
    if enum_values is None:
        for item in status.get("allOf", []):
            if "enum" in item:
                enum_values = item["enum"]
                break
            ref = item.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
                referenced = schema["components"]["schemas"].get(ref.rsplit("/", 1)[-1], {})
                if "enum" in referenced:
                    enum_values = referenced["enum"]
                    break
    if enum_values is None:
        enum_values = schema["components"]["schemas"].get("StatusEnum", {}).get("enum")
    assert enum_values is not None
    assert set(enum_values) == {"ok", "unavailable"}

    paths = schema["paths"]
    for path in HEALTH_PATHS:
        operation = paths[path]["get"]
        assert operation.get("security") in ([], None) or operation["security"] == []
        assert "200" in operation["responses"]
    assert "503" in paths["/health/ready"]["get"]["responses"]


def test_live_payload_matches_health_status_schema(client: Client) -> None:
    schema = build_schema()
    enum_values = _health_status_enum(schema)
    response = client.get("/health/live")
    payload = response.json()
    assert response.status_code == 200
    assert payload["status"] in enum_values
    assert payload == {"status": "ok"}


def test_ready_unavailable_payload_matches_health_status_schema(client: Client) -> None:
    from unittest.mock import MagicMock, patch

    from django.db import OperationalError

    schema = build_schema()
    enum_values = _health_status_enum(schema)
    database = MagicMock()
    database.cursor.side_effect = OperationalError("synthetic outage")
    mocked_connections = MagicMock()
    mocked_connections.__getitem__.return_value = database

    with patch("apps.health.views.connections", mocked_connections):
        response = client.get("/health/ready")

    payload = response.json()
    assert response.status_code == 503
    assert payload["status"] in enum_values
    assert payload == {"status": "unavailable"}


def _health_status_enum(schema: dict[str, Any]) -> set[str]:
    status = schema["components"]["schemas"]["HealthStatus"]["properties"]["status"]
    enum_values = status.get("enum")
    if enum_values is None:
        for item in status.get("allOf", []):
            if "enum" in item:
                enum_values = item["enum"]
                break
            ref = item.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
                referenced = schema["components"]["schemas"].get(ref.rsplit("/", 1)[-1], {})
                if "enum" in referenced:
                    enum_values = referenced["enum"]
                    break
    if enum_values is None:
        enum_values = schema["components"]["schemas"].get("StatusEnum", {}).get("enum")
    assert enum_values is not None
    return set(enum_values)


def test_schema_documents_catalog_as_unauthenticated_with_error_envelope() -> None:
    schema = build_schema()
    paths = schema["paths"]
    home = paths["/v1/catalog/home"]["get"]
    series = paths["/v1/series/{public_id}"]["get"]
    episode = paths["/v1/episodes/{public_id}"]["get"]

    for operation in (home, series, episode):
        assert operation.get("security") in ([], None) or operation["security"] == []
        assert "400" in operation["responses"]
        error_schema = _response_schema_ref(operation["responses"]["400"])
        assert error_schema.endswith("/ErrorEnvelope")

    assert "404" in series["responses"]
    assert "404" in episode["responses"]
    assert _response_schema_ref(series["responses"]["404"]).endswith("/ErrorEnvelope")
    home_success = _response_schema_ref(home["responses"]["200"])
    assert "CursorPage" not in home_success

    path_item_params = paths["/v1/series/{public_id}"].get("parameters") or []
    operation_params = series.get("parameters") or []
    path_params = [
        parameter
        for parameter in [*path_item_params, *operation_params]
        if parameter.get("in") == "path" or parameter.get("name") == "public_id"
    ]
    assert path_params
    schema_ref = path_params[0].get("schema", {})
    ref = schema_ref.get("$ref", "")
    assert "PublicId" in ref or schema_ref.get("type") == "string"


def test_schema_documents_playback_authorize_as_unauthenticated() -> None:
    schema = build_schema()
    authorize = schema["paths"]["/v1/playback/{episode_id}/authorize"]["post"]
    assert authorize.get("security") in ([], None) or authorize["security"] == []
    for status_code in ("400", "404", "503"):
        assert status_code in authorize["responses"]
        assert _response_schema_ref(authorize["responses"][status_code]).endswith("/ErrorEnvelope")
    success = _response_schema_ref(authorize["responses"]["200"])
    assert "PlaybackAuthorizeResponse" in success


def _response_schema_ref(response: dict[str, Any]) -> str:
    content = response.get("content", {}).get("application/json", {})
    schema = content.get("schema", {})
    ref = schema.get("$ref")
    if isinstance(ref, str):
        return ref
    return str(schema)

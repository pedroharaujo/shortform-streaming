from __future__ import annotations

from typing import Any

from drf_spectacular.generators import SchemaGenerator

from config.spectacular import (
    BEARER_SCHEME,
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


def test_schema_documents_path_security_and_error_envelope() -> None:
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

    me = paths["/v1/me"]["get"]
    security = me.get("security")
    assert security == [{"FirebaseIdToken": []}]
    assert "401" in me["responses"]
    assert _response_schema_ref(me["responses"]["401"]).endswith("/ErrorEnvelope")
    success = schema["components"]["schemas"]["CurrentUserProfile"]["properties"]
    assert "public_id" in success
    assert "created_at" in success
    assert "updated_at" in success
    assert "firebase_uid" not in success
    description = schema["info"]["description"].casefold()
    assert "later task" not in description
    bearer = schema["components"]["securitySchemes"]["FirebaseIdToken"]["description"].casefold()
    assert "later task" not in bearer
    assert "verif" in bearer

    authorize = paths["/v1/playback/{episode_id}/authorize"]["post"]
    assert authorize.get("security") in ([], None) or authorize["security"] == []
    for status_code in ("400", "404", "503"):
        assert status_code in authorize["responses"]
        assert _response_schema_ref(authorize["responses"][status_code]).endswith("/ErrorEnvelope")
    authorize_success = _response_schema_ref(authorize["responses"]["200"])
    assert "PlaybackAuthorizeResponse" in authorize_success


def _response_schema_ref(response: dict[str, Any]) -> str:
    content = response.get("content", {}).get("application/json", {})
    schema = content.get("schema", {})
    ref = schema.get("$ref")
    if isinstance(ref, str):
        return ref
    return str(schema)

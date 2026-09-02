from __future__ import annotations

from typing import Any

from drf_spectacular.generators import SchemaGenerator

from config.spectacular import (
    APP_CHECK_SCHEME,
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
    assert security_schemes["FirebaseAppCheck"] == APP_CHECK_SCHEME
    assert schema.get("security") in (None, [])


def test_schema_documents_path_security_and_error_envelope() -> None:
    schema = build_schema()
    paths = schema["paths"]
    home = paths["/v1/catalog/home"]["get"]
    series = paths["/v1/series/{public_id}"]["get"]
    episode = paths["/v1/episodes/{public_id}"]["get"]

    for operation in (home, series, episode):
        assert operation.get("security") == [{"FirebaseAppCheck": []}]
        assert "401" in operation["responses"]
        assert _response_schema_ref(operation["responses"]["401"]).endswith("/ErrorEnvelope")
        parameter_names = {item.get("name") for item in operation.get("parameters", [])}
        assert not {"X-Territory", "X-Platform", "X-Language"} & parameter_names

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
    assert security == [{"FirebaseAppCheck": [], "FirebaseIdToken": []}]
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
    security = authorize.get("security")
    assert security == [
        {"FirebaseAppCheck": []},
        {"FirebaseAppCheck": [], "FirebaseIdToken": []},
    ]
    for status_code in ("401", "404", "503"):
        assert status_code in authorize["responses"]
        assert _response_schema_ref(authorize["responses"][status_code]).endswith("/ErrorEnvelope")
    authorize_200 = authorize["responses"]["200"]["content"]["application/json"]["schema"]
    resolved_200 = _resolve_schema(authorize_200, schema["components"]["schemas"])
    one_of = resolved_200.get("oneOf") or authorize_200.get("oneOf")
    assert isinstance(one_of, list) and len(one_of) >= 2
    discriminator = resolved_200.get("discriminator") or authorize_200.get("discriminator")
    assert discriminator["propertyName"] == "decision"
    locked = schema["components"]["schemas"]["PlaybackAuthorizeLocked"]
    locked_properties = locked.get("properties", {})
    assert "playback_url" not in locked_properties
    assert "expires_at" not in locked_properties
    assert "lock_reasons" in locked_properties
    granted = schema["components"]["schemas"]["PlaybackAuthorizeGranted"]
    assert "access_method" in granted["properties"]
    assert "playback_url" in granted["properties"]
    assert "expires_at" in granted["properties"]
    assert "lock_reasons" not in granted["properties"]

    reward_intent = schema["components"]["schemas"]["RewardIntent"]
    assert "grant_source" in reward_intent["properties"]

    progress_get = paths["/v1/progress/{episode_id}"]["get"]
    progress_put = paths["/v1/progress/{episode_id}"]["put"]
    for operation in (progress_get, progress_put):
        assert operation.get("security") == [
            {"FirebaseAppCheck": []},
            {"FirebaseAppCheck": [], "FirebaseIdToken": []},
        ]
        for status_code in ("401", "403", "404"):
            assert status_code in operation["responses"]
            assert _response_schema_ref(operation["responses"][status_code]).endswith(
                "/ErrorEnvelope"
            )
    assert _response_schema_ref(progress_put["responses"]["403"]).endswith("/ErrorEnvelope")
    progress_schema = schema["components"]["schemas"]["WatchProgress"]
    progress_properties = progress_schema.get("properties", {})
    assert "playback_url" not in progress_properties
    assert "expires_at" not in progress_properties
    assert "lock_reasons" not in progress_properties
    assert "episode_id" in progress_properties
    assert "position_seconds" in progress_properties
    assert "completed" in progress_properties
    assert "updated_at" in progress_properties

    offers = paths["/v1/offers/{episode_id}"]["get"]
    assert offers.get("security") == [
        {"FirebaseAppCheck": []},
        {"FirebaseAppCheck": [], "FirebaseIdToken": []},
    ]
    for status_code in ("401", "404"):
        assert status_code in offers["responses"]
        assert _response_schema_ref(offers["responses"][status_code]).endswith("/ErrorEnvelope")
    assert "503" not in offers["responses"]
    locked_offers = schema["components"]["schemas"]["EpisodeOffersLocked"]
    locked_offer_properties = locked_offers.get("properties", {})
    assert "playback_url" not in locked_offer_properties
    assert "expires_at" not in locked_offer_properties
    granted_offers = schema["components"]["schemas"]["EpisodeOffersGranted"]
    granted_offer_properties = granted_offers.get("properties", {})
    assert "playback_url" not in granted_offer_properties
    offer_method = schema["components"]["schemas"]["OfferMethod"]
    method_type = _enum_values(offer_method["properties"]["type"], schema["components"]["schemas"])
    assert set(method_type) == {"entitlement", "free", "rewarded_ad"}
    assert "coin" not in method_type
    assert "subscription" not in method_type

    callback = paths["/v1/rewards/admob/ssv"]["get"]
    assert callback.get("security") in (None, [])


def _response_schema_ref(response: dict[str, Any]) -> str:
    content = response.get("content", {}).get("application/json", {})
    schema = content.get("schema", {})
    ref = schema.get("$ref")
    if isinstance(ref, str):
        return ref
    return str(schema)


def _resolve_schema(schema: dict[str, Any], components: dict[str, Any]) -> dict[str, Any]:
    ref = schema.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
        name = ref.rsplit("/", 1)[-1]
        resolved = components.get(name)
        if isinstance(resolved, dict):
            return resolved
    return schema


def _enum_values(schema: dict[str, Any], components: dict[str, Any]) -> list[str]:
    resolved = _resolve_schema(schema, components)
    if "allOf" in resolved:
        values: list[str] = []
        for part in resolved["allOf"]:
            if isinstance(part, dict):
                values.extend(_enum_values(part, components))
        return values
    enum = resolved.get("enum")
    if isinstance(enum, list):
        return [str(item) for item in enum]
    return []

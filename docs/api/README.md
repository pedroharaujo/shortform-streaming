# API contract

The committed OpenAPI document is [`openapi.yaml`](./openapi.yaml). It is generated from Django REST Framework with `drf-spectacular`. Do not edit it by hand.

## Conventions (components)

These shared shapes are published even while only health operations exist:

| Component | Role |
| --- | --- |
| `ErrorEnvelope` / `FieldError` | Error `code`, safe `message`, `request_id` (correlation ID), optional `field_errors` |
| `CursorPage` | Cursor pagination: opaque `cursor`, `next`, and `results` |
| `PublicId` | Opaque public string identifier (never a sequential database integer) |
| `FirebaseIdToken` | HTTP Bearer scheme for a Firebase ID token; **not** applied to health, anonymous catalog, or anonymous playback authorize |
| `HealthStatus` | `{ "status": "ok" \| "unavailable" }` for `/health/live` and `/health/ready` |
| `CurrentUserProfile` | `{ public_id, created_at, updated_at }` from `GET /v1/me`; never includes `firebase_uid` |

Health probes stay unauthenticated. Anonymous catalog reads (`GET /v1/catalog/home`, `GET /v1/series/{public_id}`, `GET /v1/episodes/{public_id}`) and anonymous playback authorize (`POST /v1/playback/{episode_id}/authorize`) are also unauthenticated and require explicit `X-Territory`, `X-Platform`, and `X-Language` headers. Those headers are never inferred from `Accept-Language`. Missing or malformed headers are HTTP 400 `ErrorEnvelope`. Ineligible or unmapped public ids are HTTP 404 `ErrorEnvelope`. An unset or disabled video provider is HTTP 503 `ErrorEnvelope` and never returns an unsigned playlist. Django never serves video bytes. A Bearer credential on health, catalog, or playback authorize must not change those outcomes.

`GET /v1/me` requires `FirebaseIdToken`. Django verifies the ID token and maps the UID to one local profile. Missing, malformed, expired, or revoked tokens are HTTP 401 `ErrorEnvelope` with code `authentication_required`. Client-supplied user or profile identifiers are ignored. Local/CI verification defaults to a mock (`mock.<uid>` tokens); production uses firebase-admin and fails closed if a token cannot be verified.

Home is a small rails document, not a `CursorPage`.

## Regeneration

From the repository root:

```shell
pnpm contract:generate
pnpm contract:check
```

`contract:generate` writes this YAML and the TypeScript client in `packages/api-client`. `contract:check` regenerates and fails if git shows a drift (including untracked generated files). CI runs `pnpm contract:check` in `.github/workflows/api-contract.yml` without cloud credentials.

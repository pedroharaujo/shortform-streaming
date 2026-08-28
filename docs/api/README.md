# API contract

The committed OpenAPI document is [`openapi.yaml`](./openapi.yaml). It is generated from Django REST Framework with `drf-spectacular`. Do not edit it by hand.

## Conventions (components)

These shared shapes are published even while only health operations exist:

| Component | Role |
| --- | --- |
| `ErrorEnvelope` / `FieldError` | Error `code`, safe `message`, `request_id` (correlation ID), optional `field_errors` |
| `CursorPage` | Cursor pagination: opaque `cursor`, `next`, and `results` |
| `PublicId` | Opaque public string identifier (never a sequential database integer) |
| `FirebaseIdToken` | HTTP Bearer scheme for a Firebase ID token; **not** applied to health or anonymous catalog. Optional on playback authorize, progress, and offers |
| `HealthStatus` | `{ "status": "ok" \| "unavailable" }` for `/health/live` and `/health/ready` |
| `CurrentUserProfile` | `{ public_id, created_at, updated_at }` from `GET /v1/me`; never includes `firebase_uid` |
| `WatchProgress` | `{ episode_id, position_seconds, completed, updated_at }` from `GET`/`PUT /v1/progress/{episode_id}`; never includes `playback_url` |
| `EpisodeOffersGranted` / `EpisodeOffersLocked` | Polymorphic `GET /v1/offers/{episode_id}` on `decision`. Granted: `{ decision, episode_id, methods }`. Locked: `{ decision, episode_id, lock_reasons, methods }`. MVP `methods[].type` values are `entitlement`, `free`, and `rewarded_ad`. Never includes `playback_url` |

Health probes stay unauthenticated. Anonymous catalog reads (`GET /v1/catalog/home`, `GET /v1/series/{public_id}`, `GET /v1/episodes/{public_id}`) and anonymous playback authorize (`POST /v1/playback/{episode_id}/authorize`) are also unauthenticated and require explicit `X-Territory`, `X-Platform`, and `X-Language` headers. Those headers are never inferred from `Accept-Language`. Missing or malformed headers are HTTP 400 `ErrorEnvelope`. Ineligible or unmapped public ids are HTTP 404 `ErrorEnvelope`. An unset or disabled video provider is HTTP 503 `ErrorEnvelope` and never returns an unsigned playlist. Django never serves video bytes. A Bearer credential on health, catalog, or playback authorize must not change those outcomes.

`GET /v1/offers/{episode_id}` uses the same catalog context headers and optional Firebase ID token as playback authorize. A missing token is anonymous; a present invalid token is 401 `ErrorEnvelope`. Ineligible or unknown ids are HTTP 404. Catalog-eligible lock is HTTP 200 with `lock_reasons` and `methods` (anonymous locks omit rewarded-ad and return an empty `methods` list). Granted responses include methods and never a playback URL. Django never serves video bytes.

`GET`/`PUT /v1/progress/{episode_id}` uses the same catalog context headers and optional Firebase ID token. Anonymous progress requires `X-Device-Id` (a client-generated UUID, never a user id). Authenticated progress uses the verified profile and ignores `X-Device-Id`. Catalog-eligible lock is HTTP 403 `ErrorEnvelope` with code `playback_locked` and does not write. The progress JSON never includes a playback URL. Django never serves video bytes.

`GET /v1/me` requires `FirebaseIdToken`. Django verifies the ID token and maps the UID to one local profile. Missing, malformed, expired, or revoked tokens are HTTP 401 `ErrorEnvelope` with code `authentication_required`. Client-supplied user or profile identifiers are ignored. Local/CI verification defaults to a mock (`mock.<uid>` tokens); production uses firebase-admin and fails closed if a token cannot be verified.

Home is a small rails document, not a `CursorPage`.

## Regeneration

From the repository root:

```shell
pnpm contract:generate
pnpm contract:check
```

`contract:generate` writes this YAML and the TypeScript client in `packages/api-client`. `contract:check` regenerates and fails if git shows a drift (including untracked generated files). CI runs `pnpm contract:check` in `.github/workflows/api-contract.yml` without cloud credentials.

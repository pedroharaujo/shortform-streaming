# API contract

The committed OpenAPI document is [`openapi.yaml`](./openapi.yaml). It is generated from Django REST Framework with `drf-spectacular`. Do not edit it by hand.

## Conventions (components)

These shared shapes are published even while only health operations exist:

| Component | Role |
| --- | --- |
| `ErrorEnvelope` / `FieldError` | Error `code`, safe `message`, `request_id` (correlation ID), optional `field_errors` |
| `CursorPage` | Cursor pagination: opaque `cursor`, `next`, and `results` |
| `PublicId` | Opaque public string identifier (never a sequential database integer) |
| `FirebaseIdToken` | HTTP Bearer scheme for a Firebase ID token; **not** applied to health or anonymous catalog |
| `HealthStatus` | `{ "status": "ok" \| "unavailable" }` for `/health/live` and `/health/ready` |

Health probes stay unauthenticated. Anonymous catalog reads (`GET /v1/catalog/home`, `GET /v1/series/{public_id}`, `GET /v1/episodes/{public_id}`) are also unauthenticated and require explicit `X-Territory`, `X-Platform`, and `X-Language` headers. Those headers are never inferred from `Accept-Language`. Missing or malformed headers are HTTP 400 `ErrorEnvelope`. Ineligible public ids are HTTP 404 `ErrorEnvelope`. Firebase token verification is a later task.

Home is a small rails document, not a `CursorPage`.

## Regeneration

From the repository root:

```shell
pnpm contract:generate
pnpm contract:check
```

`contract:generate` writes this YAML and the TypeScript client in `packages/api-client`. `contract:check` regenerates and fails if git shows a drift (including untracked generated files). CI runs `pnpm contract:check` in `.github/workflows/api-contract.yml` without cloud credentials.

# API contract

The committed OpenAPI document is [`openapi.yaml`](./openapi.yaml). It is generated from Django REST Framework with `drf-spectacular`. Do not edit it by hand.

## Conventions (components)

These shared shapes are published even while only health operations exist:

| Component | Role |
| --- | --- |
| `ErrorEnvelope` / `FieldError` | Error `code`, safe `message`, `request_id` (correlation ID), optional `field_errors` |
| `CursorPage` | Cursor pagination: opaque `cursor`, `next`, and `results` |
| `PublicId` | Opaque public string identifier (never a sequential database integer) |
| `FirebaseIdToken` | HTTP Bearer scheme for a Firebase ID token; **not** applied to health |
| `HealthStatus` | `{ "status": "ok" \| "unavailable" }` for `/health/live` and `/health/ready` |

Health probes stay unauthenticated. Firebase token verification is a later task.

## Regeneration

From the repository root:

```shell
pnpm contract:generate
pnpm contract:check
```

`contract:generate` writes this YAML and the TypeScript client in `packages/api-client`. `contract:check` regenerates and fails if git shows a drift (including untracked generated files). CI runs `pnpm contract:check` in `.github/workflows/api-contract.yml` without cloud credentials.

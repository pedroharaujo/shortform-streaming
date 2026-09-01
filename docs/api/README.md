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

Every response includes `X-Request-ID`. A valid caller-supplied value is reused;
otherwise the backend generates a UUID. Error envelopes carry the same value so
a client-visible failure can be matched to the privacy-safe server completion
record without logging bodies, credentials, query strings, or raw object paths.

Health probes stay unauthenticated. Catalog reads and playback authorization are
also anonymous where the free-window policy allows. France, Android, and English
are server-owned MVP constants; client market headers are not accepted or used.
Ineligible or unmapped public ids are HTTP 404 `ErrorEnvelope`. An unset or
disabled video provider is HTTP 503 and never returns an unsigned playlist.
Django never serves video bytes.

Consumer API commands use `application/json`; form and multipart command bodies
are unsupported. `/v1/` bodies are capped at 64 KiB and return HTTP 413
`request_too_large` without reflecting request content. Bodyless POST actions stay
valid. Firebase Bearer credentials are capped at 4 KiB of printable, non-whitespace
ASCII before verification. These parser/verifier bounds are not a substitute for
edge or distributed abuse controls.

`GET /v1/offers/{episode_id}` uses an optional Firebase ID token. A missing token
is anonymous; a present invalid token is 401. Ineligible or unknown ids are 404.
Locked responses never include playback URLs.

`GET`/`PUT /v1/progress/{episode_id}` uses an optional Firebase ID token.
Anonymous progress requires `X-Device-Id`; authenticated progress uses the
verified profile and ignores that header. Locked progress is HTTP 403 and does
not write.

`GET /v1/me` requires `FirebaseIdToken`. Django verifies the ID token and maps the UID to one local profile. Missing, malformed, expired, or revoked tokens are HTTP 401 `ErrorEnvelope` with code `authentication_required`. Client-supplied user or profile identifiers are ignored. Local/CI verification defaults to a mock (`mock.<uid>` tokens); production uses firebase-admin and fails closed if a token cannot be verified.

Home is a small rails document, not a `CursorPage`.

## Regeneration

From the repository root:

```shell
pnpm contract:generate
pnpm contract:check
```

`contract:generate` writes this YAML and the TypeScript client in `packages/api-client`. `contract:check` regenerates and fails if git shows a drift (including untracked generated files). CI runs `pnpm contract:check` in `.github/workflows/api-contract.yml` without cloud credentials.

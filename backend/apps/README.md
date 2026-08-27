# Backend application boundary

`health` is the infrastructure health application created by P1-T02.

`catalog` is the rights-aware catalog bounded application created by P2-T03. Staff
manage Series, Season, Episode, Genre, localized text, and ContentRight records in
Django Admin (`/admin/`). Anonymous clients read eligible titles from:

- `GET /v1/catalog/home`
- `GET /v1/series/{public_id}`
- `GET /v1/episodes/{public_id}`

Every catalog read requires explicit `X-Territory` (ISO 3166-1 alpha-2),
`X-Platform` (`ios` or `android`), and `X-Language` (ISO 639-1, MVP `en`) headers.
Those values are never inferred from `Accept-Language`. Missing or malformed
headers return HTTP 400 `ErrorEnvelope`. Ineligible or unpublished public ids
return HTTP 404 `ErrorEnvelope`, never 403.

Eligibility is fail-closed at request time: published, not taken down, current
time inside the rights window (start inclusive, end exclusive), request territory
on the allowlist and not on the denylist, request platform in the grant, and
request language in the licensed original/subtitle/dub grant. Original language
is metadata, not an implicit grant.

Seed synthetic FR and DE titles (generated metadata only; tests do not depend on
this command):

```shell
uv run python backend/manage.py seed_catalog
```

`accounts` is the identity bounded application created by P2-T01. Django
verifies Firebase ID tokens and owns `UserProfile` rows keyed by `firebase_uid`.
The public API never returns `firebase_uid`. Clients call:

- `GET /v1/me` (Firebase ID token required)

Local and CI default to mock verification (`FIREBASE_AUTH_MODE=mock`, tokens
shaped `mock.<uid>`). Production uses firebase-admin (`FIREBASE_AUTH_MODE=admin`)
and fails closed when a token cannot be verified. Optional emulator host for
admin-mode local work: `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Never commit
service-account JSON.

`playback` is the video-provider, MediaAsset ingestion, and authorize bounded
application (P2-T05 / P2-T06). Django never serves video bytes. Staff upload a
vertical master through Django Admin; `VideoProvider` encodes it. Anonymous
clients request a short-lived opaque HLS URL from:

- `POST /v1/playback/{episode_id}/authorize`

The same catalog context headers are required. Unknown, ineligible, unpublished,
or episodes without a ready MediaAsset return HTTP 404 `ErrorEnvelope`, never
403. An unset or disabled `VideoProvider` returns HTTP 503 `ErrorEnvelope` and
never mints unsigned access. Local settings default to `VIDEO_PROVIDER=fake`.
Production rejects `fake`. Authorize looks up the episode's ready MediaAsset;
`PLAYBACK_SPIKE_ASSETS` is obsolete and is not consulted.

Later plan tasks own `entitlements`, `commerce`, `advertising`, `experiments`,
and `notifications`.

Generate 9:16 test media and submit it to Bunny Stream (requires non-production
credentials; missing credentials are not a Bunny failure). The command is a
provider smoke test only; it does not attach catalog MediaAsset. Staff ingest is
Django Admin file upload plus retry reconcile:

```shell
uv run python backend/manage.py spike_bunny_playback
```

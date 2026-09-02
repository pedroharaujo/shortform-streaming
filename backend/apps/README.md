# Backend application boundary

`health` is the infrastructure health application created by P1-T02.

`catalog` is the rights-aware catalog bounded application created by P2-T03. Staff
manage the self-owned English Series, Season, Episode, Genre, and provenance records in
Django Admin (`/admin/`). Anonymous clients read eligible titles from:

- `GET /v1/catalog/home`
- `GET /v1/series/{public_id}`
- `GET /v1/episodes/{public_id}`

The MVP catalog is fixed to France, Android, and English. Clients do not send
market headers and cannot change eligibility context.
Ineligible or unpublished public ids return HTTP 404 `ErrorEnvelope`, never 403.
Eligibility is fail-closed at request time: published, confirmed self-owned,
provenance recorded, promotional use approved, not taken down, and ready media.

Seed the single synthetic self-owned title (tests do not depend on this command):

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

Every consumer `/v1/` operation also passes through the Firebase App Check
middleware when `FIREBASE_APP_CHECK_MODE=enforce`. The middleware verifies
`X-Firebase-AppCheck` with Firebase Admin and requires the exact configured public
Android app ID before view work. Health, Admin, and the separately signed AdMob SSV
callback are excluded. Production requires the Admin verifier; enforcement remains
disabled pending `docs/runbooks/app-check.md` provider/device evidence.

`playback` owns the existing Django Admin media-ingestion workflow and authorizes
playback. Staff upload self-owned masters through Admin; production uses a
private signed landing bucket before provider submission. The workflow tracks
processing, captions, thumbnails, duration, and renditions. Admin takedown also
removes/expires the provider asset. Consumer APIs never accept or serve video
bytes.

Clients request a short-lived opaque HLS URL from:

- `POST /v1/playback/{episode_id}/authorize`

Firebase ID token is optional: a
missing header is anonymous; a present invalid token is HTTP 401
`ErrorEnvelope`. Unknown, ineligible, unpublished, taken-down,
or episodes without a ready MediaAsset return HTTP 404 `ErrorEnvelope`, never
403. Catalog-eligible lock returns HTTP 200 `decision=locked` with
`lock_reasons` (`login_required` or `entitlement_required`) and no
`playback_url`. Grant mints only after existing entitlement or the D-006 free
window (`Episode.order` 1–5 per season). An unset or disabled `VideoProvider`
returns HTTP 503 `ErrorEnvelope` on the grant path only and never mints
unsigned access. Local settings default to `VIDEO_PROVIDER=fake`. Production
rejects `fake`. Authorize looks up the episode's ready MediaAsset;
`PLAYBACK_SPIKE_ASSETS` is obsolete and is not consulted.

`entitlements` is the episode-entitlement bounded application created by
P2-T07. `EpisodeEntitlement` is unique per `(user_profile, episode)` with
source `staff` or `rewarded_ad`. Staff grant in Django Admin (default
`staff`). There is no public POST that creates rows and no
`GET /v1/me/entitlements` in this slice. `rewarded_ad` is stored for P3 and is
not written by a public API here.

`progress` is the watch-progress bounded application created by P2-T08.
`WatchProgress` is one row per granted episode for either a verified
`UserProfile` or an anonymous device UUID (`X-Device-Id`). Exactly one subject
is set. Clients call:

- `GET /v1/progress/{episode_id}`
- `PUT /v1/progress/{episode_id}`

Firebase ID token is optional: a
missing header is anonymous; a present invalid token is HTTP 401
`ErrorEnvelope`. Anonymous writes require `X-Device-Id` (a client-generated
UUID, never a user id). Authenticated writes use the verified profile and
ignore `X-Device-Id`. Catalog-ineligible ids return HTTP 404. Catalog-eligible
lock returns HTTP 403 `playback_locked` and does not write. Grant upserts
position and server-authoritative completion (client flag or 95% of duration)
and never mints a playback URL. Django never serves video bytes. There is no
Django Admin for `WatchProgress`. Anonymous free play does not create a
`UserProfile`.

`advertising` owns rewarded-ad intents and verified AdMob server-side grants.
Commerce, experiments, notifications, and additional platforms remain post-MVP.

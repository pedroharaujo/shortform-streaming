# SDK and data inventory

**Plan task:** P0-T03 remaining engineering slice
**Status:** Engineering inventory published; P0-T03 is **not** complete
**Code snapshot:** historical as of `85207d2` (`main` at inventory branch creation). It is **not** current `main`. P2-T01 (PR #48), P2-T05 (PR #45), and P2-T01-F1 (PR #51) have since merged; do not treat Firebase Auth or Bunny playback authorize as unshipped.
**Not legal advice.** Lawful-basis and consent cells are conservative GDPR-ready **planned/assumed** engineering defaults for a later legal review. They do not approve processing, transfers, or store declarations.

This file is the single engineering source for later privacy labels (P6-T04), account deletion (P2-T02), and legal/privacy review. Row labels below still describe the `85207d2` research snapshot plus later planned processors; they are not a claim that merged P2-T01/P2-T05 work is still unmerged. This inventory does not authorize production processing.

### P4-T01 event implementation update (2026-09-01)

The mobile runtime now emits only canonical `app_open`, `home_viewed`,
`series_impression`, and `series_opened` discovery events through Firebase in
local/staging builds after the current server-confirmed analytics preference is
active. It supplies an ephemeral per-process session ID and allowlisted
app/build/platform/locale/time context, and deduplicates accepted logical events.
Tests prove zero transport events before consent. Production transport remains a
hard no-op pending D-020, privacy/store disclosure review, and P6 validation.
The player also emits canonical start, progress, completion, displayed-lock, and
terminal safe-error events from authoritative UI/API triggers. Playback authorize
supplies the server-owned `free`, `rewarded_ad`, or `staff` access source; staff
playback does not fabricate a product start method. Signed playback URLs, provider
messages, and raw errors never enter event properties. F4 also emits visible
offer/selection, native loaded/opened/earned, terminal
safe-failure, and owner-status verified-grant diagnostics. The owner-only reward
response exposes only a derived `admob_ssv` grant source; provider bindings, SSV
queries, transactions, and tokens remain outside Analytics. Reward authority stays
with the verified callback and `EpisodeEntitlement`.

Password/Google `sign_up` and `login` now observe only a successful `/v1/me`
confirmation. Pre-consent authentication remains process-local and is retried only
if the same session later enables its server-owned preference. Accepted deletion
emits only its completion/pending status after the Analytics user ID and local data
are cleared; profile, session, country, email, credential, and receipt identifiers
are absent. Production transport remains hard-disabled.

### P4-T06-F1 installed-link update (2026-09-01)

The app can rewrite an installed custom-scheme series link through an eligibility-
checked internal landing. It accepts only bounded canonical campaign, ad-set,
creative, source, medium, and series tokens. It does not retain the incoming URL,
query string, or attribution history; only the safe tokens and internal target may
reach the existing consent-gated `app_open` diagnostic. No SDK or processor was
added. Production Analytics remains a hard no-op.

Google Play Install Referrer, fresh-install attribution, and persistent first/last
touch remain absent. Issue #113 requires an approved D-020 attribution/retention
window before adding them. This update neither authorizes paid acquisition nor
claims deferred-install attribution is complete.

### P4-T01 F2 implementation update (2026-09-01)

The mobile dependency and a tested consent controller for Firebase Analytics are
now present. Native collection, storage consent, screen reporting, and advertising
identifiers all default off. A process-wide controller now follows the current
server-owned profile preference across sign-in, preference changes, sign-out,
session replacement, unauthenticated cleanup, and deletion. Only the opaque backend
profile ID may be linked after consent; withdrawal and session cleanup disable
collection, clear identity, and reset local Analytics data. Product and account
event triggers are implemented, and production processing remains blocked on D-020
and P6 clearance. Production builds select a hard no-op adapter; local/staging synthetic
validation cannot silently activate production collection.

Owner boxes that remain open for the **ads-only** P0-T03 slice: legal/privacy jurisdiction review, content rating, and AdMob/ads-only finance/tax treatment. Store IAP EUR settlement is required before P7 IAP, not before this ads-only slice. See `STORE_COMPLIANCE_MATRIX.md`.

## How to read status labels

### P3-T07 implementation update (2026-08-31)

This update supersedes the historical planned AdMob row for the **test-only
Android implementation**. Production processing is disabled. It does not approve
D-020, legal bases, store disclosures or production SDK activation.

| Field / processor | Purpose and controls | Deletion / retention |
|---|---|---|
| AdMob / UMP through react-native-google-mobile-ads 16.0.0 (Google Ads 24.6.0, UMP 3.2.0) | Demo app/unit by default; paired publisher IDs only for local Android development-emulator tests. Explicit episode reward choice and account ads preference; fresh UMP permission before Ads SDK init, delayed native measurement, non-personalized requests. UMP privacy choices are accessible independently of reward eligibility. No new Analytics SDK or events. Device/network/consent processing by these SDKs still needs production disclosure review. | UMP privacy form manages provider consent; account preference blocks new reward attempts but is not provider erasure. Production provider retention, transfer and deletion procedures remain pending D-020. |
| expo-device 57.0.1 | Read `isDevice` locally to reject publisher ad attempts on physical or unidentified devices. No other device properties, new telemetry or device-identifier allowlist added. | No new server-side field or retention. |
| RewardIntent account/episode/context, random per-intent custom_data and ssv_user_id, request UUID, expiry, verified transaction ID/timestamp and grant time | Owner-only no-store API; opaque binding sent to AdMob instead of UID/email. Django validates authentic callback before a permanent episode grant. Raw query, signature and provider payload are not persisted. Development/gunicorn query logging is suppressed; ingress redaction remains a release gate. | Intents expire for redemption after 15 minutes, which is not a database retention period. Intents and entitlements cascade on account deletion. Automated cleanup/production retention remains pending D-020. |

See `../runbooks/rewarded-ads.md` for callback trust, rollback and the outstanding
provider end-to-end evidence. Test fixtures and device accounts are synthetic.

### P2-T02 implementation update (2026-08-31)

The historical rows below are superseded for the following consumer-account
fields by P2-T02. See `../runbooks/account-lifecycle.md` for operation and rollback.

| Field | Purpose / access | Deletion and retention |
|---|---|---|
| UserProfile locale, optional country, analytics/ads preferences, consent_updated_at | Account-owned preferences through GET/PATCH `/v1/me`; no SDK activation or eligibility override | Removed with the profile. Defaults are off; D-020 remains required before production processing. |
| UserProfile UID/public ID/timestamps; authenticated progress and episode entitlements | Existing authenticated account data; never expose UID through the API | Locally cascade-deleted when a deletion request is accepted; Firebase identity cleanup is retried until completed. |
| AccountDeletion UID fingerprint, public receipt ID, status, request/completion/attempt timestamps and attempt count | Backend replay prevention and operational audit only; fingerprint is pseudonymous, not anonymous | Raw UID is held only while pending and cleared at completion. Operational fingerprint/receipt retention requires D-020 approval; not analytics or financial records. |
| Firebase auth_time | Verify recent same-account sign-in before deletion | Checked in memory only; not copied into receipts, profiles, or logs. |

Unlinked guest-device progress is not associated with a consumer profile and is
not deleted as if it belonged to the signed-in user. Future push/analytics/ad
processors and P7 financial records must specify their own deletion propagation
before shipping. No legal, privacy-label, residency, or retention approval is
implied by this update.

### Historical status labels

Every inventory row uses one of:

| Label | Meaning |
|---|---|
| **current-on-main** | Present in code and OpenAPI at the `85207d2` snapshot. Later `main` also includes merged P2-T01 / P2-T01-F1 / P2-T05; see the snapshot note above. |
| **in-flight (not merged)** | Research label from the `85207d2` inventory. P2-T01 (PR #48) and P2-T05 (PR #45) have **merged** since then; do not treat those rows as still unshipped. |
| **planned MVP** | Accepted architecture required for ads-only MVP launch; **not implemented**. |
| **planned P7** / **not-in-MVP (deferred P7)** | Accepted architecture deferred to Phase 7 (issue #52, 2026-08-27); **not implemented**. Not a silent drop. |
| **not-in-MVP** / **not-adopted** | Explicitly out of MVP or awaiting a decision so the processor is not silently omitted or declared in store labels. |

## Decision fidelity

| ID | Inventory treatment |
|---|---|
| D-013 | **Accepted.** Firebase Auth, Analytics, Crashlytics, and App Check are planned MVP processors (ADR 0003). Remote Config A/B and FCM are **planned P7**. Consumer Firebase Auth verification (`GET /v1/me`) and native Android Auth (P2-T01 / P2-T01-F1) have **merged to `main` after** `85207d2`. Do not treat Firebase Auth as unshipped. |
| D-014 / ADR 0005 | Bunny Stream is the accepted **default**; GCP Cloud CDN is the **documented fallback and is not active**. P2-T05 on-device proof is not this task. |
| D-015 / ADR 0006 | RevenueCat plus Django ledger remain accepted architecture. **MVP implementation deferred to P7**; MVP commerce is AdMob only. Not implemented. |
| D-016 / ADR 0007 | Firebase Analytics typed MVP events are implemented but production-disabled. BigQuery export, Looker Studio, and Remote Config A/B are **planned P7**. |
| D-004 | **Founder approved 2026-08-27.** Launch catalog is 1 series; data model still supports N. |
| D-005–D-007 | **Founder approved 2026-08-27** (guest boundary, hardcoded free window, rewarded-ad-only MVP monetization). Anonymous catalog on `main` is P2-T03 engineering, not this inventory converting those decisions. |
| D-008 / D-009 | Remain **Proposed**. Required before P7 IAP only; not required for ads-only MVP. |
| D-017 | **Decision required.** Meta/TikTok paid acquisition is unpaid until approved; SDKs/pixels are **not-in-MVP / not-adopted**. |
| D-018 | **Decision required.** No MMP is adopted. MMP remains a P7 spend gate. |
| D-020 | **Decision required.** Region and retention cells that are unknown say **pending D-020**. This file does not record an EU-region or retention decision. |
| D-003 | Age rating is catalog metadata only on `main`; anonymous GET is not age-gated. |

## Minimization (applies to all analytics and non-essential telemetry)

Never send to analytics, crash non-breadcrumbs, or similar product telemetry:

- email
- auth token (including Firebase ID tokens)
- signed video URL / CDN token
- full IP address
- payment receipt / store receipt payload
- contract reference (including opaque `contract_reference`)
- free-form error payload (use a safe code; API `ErrorEnvelope` messages are static)

Separate authentication identity, operational logs, analytics identifiers, and financial audit records. Do not paste secrets, licensed media, confidential rates, real PII, provider payloads, or signed URLs into this repository.

---

## Current-on-main (`85207d2` snapshot; not current `main`)

Verified against `backend/apps/health/`, `backend/apps/catalog/`, `backend/config/settings/base.py`, `backend/config/urls.py`, `backend/config/exceptions.py`, and `docs/api/openapi.yaml` at `85207d2`. OpenAPI paths on this revision are `/health/live`, `/health/ready`, `/v1/catalog/home`, `/v1/series/{public_id}`, `/v1/episodes/{public_id}` only. There is no `LOGGING` dict; Django’s default request/error logging applies. `AUTH_USER_MODEL` is unset, so staff identity is `django.contrib.auth` `User`. Consumer Firebase identity is **not** on this revision.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| current-on-main | `GET /health/live` — JSON `{status}` only; no request body; unauthenticated | Process liveness. Does not query PostgreSQL. Not a consumer data collection point. | Not personal data in normal use; if a client IP appears in infra logs, Art. 6(1)(f) security/reliability — planned/assumed | Django app process (planned hosting: GCP Cloud Run) | **pending D-020** | **pending D-020**; process logs have no app-level retention policy on `main` | Platform/ops; no consumer role | No stored personal record to delete. Infra logs follow **pending D-020**. |
| current-on-main | `GET /health/ready` — JSON `{status}`; unauthenticated; bounded `SELECT 1` | Readiness including PostgreSQL reachability | Same as live probe. Probe is not a catalog or identity read. | Django + PostgreSQL | **pending D-020** | **pending D-020** | Platform/ops | No consumer profile. Database exists as infrastructure, not as this probe’s dataset. |
| current-on-main | Anonymous `GET /v1/catalog/home`, `GET /v1/series/{id}`, `GET /v1/episodes/{id}` | Rights-aware public catalog for explicit request context. `authentication_classes = []`, `AllowAny`. Ineligible ids return 404, never 403. Monetization lock state omitted. | Art. 6(1)(b) steps to deliver the requested catalog **or** Art. 6(1)(f) to serve a public catalog — planned/assumed. D-005 guest/monetization boundary is **Founder approved 2026-08-27**; this row is still P2-T03 engineering, not an SDK. | Django API; PostgreSQL catalog tables | **pending D-020** | Editorial catalog retained while the title is operated; **pending D-020** for backups/replicas | Anonymous clients (eligible metadata only); staff Admin (full editorial/rights) | Catalog rows are editorial, not consumer accounts. Takedown/unpublish hides titles from public GET. No P2-T02 consumer deletion on `main`. |
| current-on-main | Request headers `X-Territory` (ISO 3166-1 alpha-2), `X-Platform` (`ios` or `android`), `X-Language` (ISO 639-1). Required; never inferred from `Accept-Language`. | Eligibility: territory, platform, language, current time. | Art. 6(1)(b)/(f) to apply rights windows — planned/assumed. Not used as a user profile on `main`. | Django (in-memory request context); not persisted as a user field on `main` | **pending D-020** | Request-scoped. The structured application completion logger does not include these headers. Infrastructure log retention remains **pending D-020**. | Anonymous client supplies; staff do not need these headers for Admin | Nothing stored on a consumer profile. Log retention is **pending D-020** / P5 observability. |
| current-on-main | Optional `X-Request-ID` or generated UUID → response `X-Request-ID`, API `ErrorEnvelope.request_id`, and structured completion `request_id` | Correlate a client-visible response with server handling. Envelope messages are static/safe. | Art. 6(1)(f) support/diagnostics — planned/assumed | Django process stdout; planned Cloud Logging | **pending D-020** | Request log lifetime **pending D-020** | Client (value sent/received); staff/ops with log access | Not a durable consumer identifier. No deletion workflow on `main`. |
| current-on-main | Public catalog payload: opaque `public_id`, localized title/synopsis, optional `artwork_url` metadata, `original_language`, genre names, season/episode order, `duration_seconds` | Render home, series detail, and episode detail | Art. 6(1)(b)/(f) as catalog content — planned/assumed. Not personal data. | Django; PostgreSQL | **pending D-020** | While the title remains in the catalog / backups **pending D-020** | Anonymous clients; staff Admin | Editorial unpublish/takedown. `contract_reference` is **not** in serializers (verified at `85207d2`). |
| current-on-main | `ContentRight.contract_reference` (opaque CharField). Seed values are generated (`synthetic-contract-{name}`). Never rates. | Staff rights administration and publish validation. Private-system handle only. | Not consumer PII. Must never go to analytics or the public API. If a contract identifier could identify a person, treat as confidential staff data — planned/assumed. | Django Admin + PostgreSQL | **pending D-020** | While the rights row exists; archive/deletion of licensed records is a P0-T02/legal topic, **pending D-020** | Staff (`is_staff` Admin). Not returned on public GET. | Staff may delete/replace rights rows in Admin. Not part of consumer deletion. Never send to analytics. |
| current-on-main | Other staff-only rights fields: licensor display name, territory allow/deny lists, platforms, language grant, window, exclusive, takedown, `drm_required` (stored, not enforced on GET), opaque `revenue_share_rule_reference` (never rates) | Rights-aware publish and eligibility | Not consumer PII. Confidential business metadata stays in Admin/Postgres. | Django Admin + PostgreSQL | **pending D-020** | **pending D-020** | Staff Admin | Operator takedown/edit. Not a consumer dataset. |
| current-on-main | `seed_catalog` generated metadata (synthetic FR/DE English titles, draft hidden title, synthetic licensors, synthetic contract/revshare references) | Local/CI catalog fixtures. Generated metadata only; not licensed media. | Not production personal data. Do not replace with real contracts or PII. | Developer/CI PostgreSQL | Local/CI; not a D-020 production region | Disposable with the database | Developers/CI | Drop/reseed the database. Never copy production PII into seeds. |
| current-on-main | Django Admin + `django.contrib.auth` staff `User`: username, hashed password, optional email/name, `is_staff` / `is_superuser` / `is_active`, `last_login`, `date_joined` | Operator authentication for `/admin/`, separate from consumer Firebase identity. User/Group administration is superuser-only; other staff use model permissions. | Art. 6(1)(b) employment/contractor access **or** Art. 6(1)(f) to secure Admin — planned/assumed. Not a consumer account. | Django + PostgreSQL (`auth_user`) | **pending D-020** | While the staff account exists; `last_login` until overwritten; **pending D-020** | Superusers administer staff; model-scoped staff access permitted Admin models | Admin User delete/disable. Consumer deletion is separate. Sessions invalidate on password change/logout. |
| current-on-main | Secure/HttpOnly/Lax SameSite Django Admin session cookie scoped to `/admin/` + `django_session` row; CSRF secret stored in the session | Keep a staff Admin session and protect unsafe form actions | Art. 6(1)(f) / strictly necessary for Admin — planned/assumed | Django + PostgreSQL | **pending D-020** | Rolling one-hour inactivity limit and browser-close expiry; database cleanup/backup retention **pending D-020** | The authenticated staff user; ops with DB access | Logout/expiry/flush/password change invalidates access. Consumer REST auth uses Firebase Bearer tokens, not this session. |
| current-on-main | Privacy-safe structured request-completion logs plus Django framework error/access logs. Completion fields are request ID, method, route template/coarse family, status, duration, event, severity. Query strings are redacted from `django.server`; API envelopes omit bodies/tokens/secrets. | Reliability, latency/error diagnosis, security of Admin and API | Art. 6(1)(f) security and service integrity — planned/assumed. Application completion records deliberately exclude raw paths, queries, bodies, IPs, users, credentials, signed URLs, and provider payloads. Infrastructure/framework output still requires live redaction verification. | Django process stdout/stderr; planned GCP Cloud Logging (not configured on `main`) | **pending D-020** | **pending D-020**. Local logs are ephemeral. | Engineering/ops | No consumer deletion hook. Production region/retention and provider verification remain **pending D-020** / P5-T06/P5-T07. |

---

## Merged after snapshot (P2-T01 / P2-T05)

Research rows below were labeled in-flight at `85207d2`. Those PRs have **merged** (P2-T01 #48, P2-T05 #45; native Android Auth follow-up P2-T01-F1 #51). Do not treat Firebase Auth or Bunny playback authorize as unshipped. Row text is the historical research snapshot, not a current-unmerged claim.

### P2-T01 — UserProfile / Firebase UID / `GET /v1/me` (PR #48)

Branch researched: `origin/p2-t01/firebase-auth-django`. PR: https://github.com/pedroharaujo/shortform-streaming/pull/48

Does not implement P2-T02 consent/deletion, Apple/Google providers as complete product, App Check enforcement, or playback.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| in-flight (not merged) | `UserProfile.firebase_uid` (unique, not serialized) | Map a **verified** Firebase UID to one local profile. Client-supplied user ids are ignored. | Art. 6(1)(b) to operate an account once D-005/auth UX is implemented — planned/assumed. D-005 is **Founder approved 2026-08-27**. | Django/PostgreSQL (planned); Firebase Authentication holds the identity record (planned; PR verifies tokens) | **pending D-020** | Until P2-T02 deletion/anonymization; **pending D-020** | Backend only. Never on `GET /v1/me`. Staff Admin not defined for this model on `main`. | **Not implemented.** P2-T02 must delete or irreversibly anonymize. Do not start P2-T02 in this slice. |
| in-flight (not merged) | `UserProfile.public_id`, `created_at`, `updated_at` returned by `GET /v1/me` | Opaque client handle and timestamps. First successful call get-or-creates the row. | Art. 6(1)(b) — planned/assumed | Django/PostgreSQL | **pending D-020** | Until P2-T02; **pending D-020** | Authenticated consumer (their own profile); not anonymous catalog | **Not implemented** (P2-T02). Catalog/health stay anonymous even with a bad bearer on that PR. |
| in-flight (not merged) | Firebase ID token on `Authorization` for `/v1/me` | Prove Firebase Authentication; Django authorizes. Token must not be logged or sent to analytics. | Art. 6(1)(b) authentication — planned/assumed | Firebase Authentication (verify); Django (authorize) | **pending D-020** | Token lifetime is Firebase-controlled; Django must not persist the token | Token subject + verifying server | Expiry/revocation → 401. Token is not a stored field. Account deletion is P2-T02. |

### P2-T05 — Playback authorize and short-lived signed HLS URLs (PR #45)

Branch researched: `origin/p2-t05/bunny-playback-spike`. PR: https://github.com/pedroharaujo/shortform-streaming/pull/45

Anonymous free-playback spike. Does not implement MediaAsset (P2-T06), entitlements (P2-T07), or the full player (P2-T08). GCP Cloud CDN fallback was **not** activated. This inventory does not start P2-T05 device work.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| in-flight (not merged) | `POST /v1/playback/{episode_id}/authorize` with the same `X-Territory` / `X-Platform` / `X-Language` headers as catalog | Django remains the authorizer after eligibility checks, then returns an opaque HTTPS HLS playlist URL it does not serve. | Art. 6(1)(b)/(f) to deliver requested playback — planned/assumed. Anonymous spike is not itself the D-005 guest-boundary implementation. | Django; active `VideoProvider` (Fake locally; Bunny Stream when configured on that PR) | **pending D-020**. Bunny processing region is **not** decided here. | Authorization is request-scoped. Spike asset map is config, not a consumer table. | Anonymous client on that PR; Django. Ineligible → 404. | No consumer playback history on that PR. URL expiry is the access control. P2-T02/P2-T08 progress deletion is out of scope. |
| in-flight (not merged) | Short-lived signed/tokenized HLS `playback_url` + `expires_at` | Bearer credential for CDN bytes. Plan rule: CDN URLs are short-lived and **excluded from logs and analytics**. | Art. 6(1)(b)/(f) — planned/assumed. Not DRM (ADR 0005). | Bunny Stream CDN (default path on that spike). GCP Cloud CDN is documented-not-active. | **pending D-020** | Until `expires_at`. Do not persist in analytics, crash reports, or Admin screenshots. | The client that received the response; anyone who intercepts the URL until expiry | Expiry / unsigned request denied at CDN (spike evidence on the PR, not on `main`). Takedown at provider is a later Django action (ADR 0005). Never copy signed URLs into Git. |

### P2-T08 — WatchProgress and product player (this slice)

Does not implement AdMob, AccessPolicy, account deletion, or production Bunny credentials. Progress deletion remains P2-T02.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| in-flight (not merged) | `WatchProgress` (`user_profile` XOR `device_id`, `episode`, `position_seconds`, `completed`, timestamps) | Resume and server-authoritative completion for granted episodes. No playback URL. | Art. 6(1)(b)/(f) to resume requested playback — planned/assumed. Anonymous device UUID is not a user id (D-005). | Django/PostgreSQL | **pending D-020** | Until P2-T02 deletion; **pending D-020** | Authenticated consumer (their profile rows); anonymous device (matching `X-Device-Id` only); no Django Admin | **Not implemented.** P2-T02 must delete profile-scoped and document device-scoped rows. Do not start P2-T02 here. |
| in-flight (not merged) | `GET`/`PUT /v1/progress/{episode_id}` with catalog context headers; optional Firebase Bearer; anonymous `X-Device-Id` (UUID) | Read/upsert progress after the same authorize decision as playback. Lock → 403, ineligible → 404, never mint. | Art. 6(1)(b)/(f) — planned/assumed. Invalid Bearer is 401, not anonymous. | Django | **pending D-020** | Request-scoped logs **pending D-020**; durable row as above | Same as WatchProgress | Same. Do not log signed URLs. |
| in-flight (not merged) | Client-generated anonymous device UUID in `expo-secure-store`, sent only as `X-Device-Id` on progress | Correlate anonymous resume without creating `UserProfile` or a Firebase anonymous user. | Art. 6(1)(f) to resume on-device playback — planned/assumed. Not an account. | On-device SecureStore; Django stores the UUID on anonymous rows only | Device; server **pending D-020** | Until app uninstall / SecureStore clear; server until P2-T02 | The device; Django for matching rows | Uninstall clears the client key (new UUID next install). Server deletion is P2-T02. Never put the UUID in `EXPO_PUBLIC_*`. |

### P2-T06 — MediaAsset staff ingest (this slice)

Staff-authenticated Django Admin ingest of **self-owned/generated test media**. No PII. Does not mark P0-T03 complete. Signed PUT (P2-T06-F1 / #55) is this slice: a staff Admin two-step so the master body does not transit Cloud Run/Django. GCP Cloud CDN fallback stays unplugged and is **not** a playback origin. D-020 residency/retention is not decided here.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| in-flight (not merged) | `MediaAsset` (checksum, provider name/id, state, caption language/presence, thumbnail count, duration, renditions, redacted diagnostic) | Track ingest readiness so an episode cannot publish or play without a ready asset plus valid rights. Postgres stores provider-agnostic ids, not CDN files (ADR 0005). | Art. 6(1)(f) to operate the service / Art. 6(1)(b) to deliver requested playback — planned/assumed. Generated test media only; licensed media waits for P0-T02 / D-019. | Django/PostgreSQL; active `VideoProvider` (Fake locally; Bunny Stream when configured). | **pending D-020** | While the episode is operated; takedown expires/deletes the provider asset (ADR 0005); **pending D-020** | Staff via Django Admin. Viewers never read this table; they receive only short-lived URLs from authorize. | Admin takedown → `removed` + provider delete/expire. Signed URLs, API keys, and raw provider payloads must not appear in diagnostics, logs, or Admin. |
| in-flight (not merged) | Short-lived staff HTTPS PUT URL (object key `staff-masters/{integer-pk}`) | Staff mint in Django Admin, PUT bytes to a private store, then complete. SHA-256 is verified before `VideoProvider.submit_master`. Placeholder example: `https://localhost/internal/staff-masters/{pk}?exp=…&sig=redacted`. | Art. 6(1)(f) to operate the service — planned/assumed. Generated test media only. | Private staff landing zone (Fake in local/CI; GCS adapter when `STAFF_UPLOAD_STORE=gcs`). **Not** a viewer playback origin. | **pending D-020** | Until URL expiry (default 600s). Not stored on `MediaAsset`, not logged, not in `diagnostic_message`, not viewer-facing. | Django `is_staff` Admin only. Viewers never receive write credentials. | Expiry denies PUT. Complete reads the private object server-side. Provider takedown remains ADR 0005. |

---

## Planned processors

Accepted by D-013, D-014, D-007 and ADRs 0003–0007 unless noted, with P7 timing from issue #52 (2026-08-27). **Snapshot:** processors not implemented on `main` at `85207d2` remain labeled planned below, except that consumer Firebase Auth verification and Bunny playback authorize later merged (see snapshot note). Region and retention remain **pending D-020**. Consent/deletion propagation is P2-T02 / P4-T01 / P6-T04, not this slice.

| Status | Field / event (processor + typical data) | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| planned MVP | Firebase Authentication: email/password and Google Sign-In (Android, D-027); email, provider ids, Firebase UID. Apple Sign-In is deferred to an iOS storefront, not waived. Phone/SMS auth is out of MVP without a decision. | Consumer identity. Django verifies ID tokens and owns profiles (ADR 0003). Email stays in Firebase, not in analytics. | Art. 6(1)(b) to create/use an account — planned/assumed. D-005 is **Founder approved 2026-08-27**. | Google Firebase Authentication | **pending D-020** | **pending D-020** | The account holder; Django via UID; Firebase project admins | P2-T02 must delete Firebase user and local profile or anonymize; not started. |
| implemented, production-disabled | Firebase Analytics: app-instance / user ids where consent permits; canonical MVP events below | Product analytics. **Not** the financial ledger (ADR 0003/0007). | Art. 6(1)(a) + ePrivacy consent for non-essential measurement — planned/assumed, consent-gated | Google Firebase Analytics | **pending D-020** | **pending D-020** | Product/growth/engineering with least privilege | Opt-out/session cleanup disables collection, clears identity, and resets local data. Accepted deletion emits status only after identity detachment, then disables collection. |
| planned P7 | Firebase Remote Config | Server-safe client defaults: paywall position, free-episode count, coin price, ad offer, messaging. MVP free window is hardcoded/admin (D-006). | Art. 6(1)(f) to configure the client **or** consent if tied to profiling — planned/assumed. Server remains authoritative. | Google Firebase Remote Config | **pending D-020** | **pending D-020** | Engineering/product; fetched by the app | Fetch is not a durable consumer record. Experiment exposure is a separate event. |
| planned P7 | Firebase A/B Testing / experiment assignment | Reversible client experiments (ADR 0007). Log exposure when behavior is used. | Consent when the experiment is non-essential / profiling — planned/assumed | Google Firebase A/B Testing (with Analytics) | **pending D-020** | **pending D-020** | Product/engineering | Stop experiment; deletion of Analytics identifiers follows P2-T02/P4-T01. Optional server `ExperimentExposure` only for financially material server decisions. |
| planned MVP | Firebase Crashlytics: stack traces, device model/OS, app version; no free-form PII payload | Crash reporting | Art. 6(1)(f) for stability of a requested app **or** consent if not strictly necessary — planned/assumed. Conservative default: consent-gated unless legal later classifies it as strictly necessary. | Google Firebase Crashlytics | **pending D-020** | **pending D-020** | Engineering | Deletion/opt-out per provider tools and P2-T02; never put tokens, emails, or signed URLs in crash context. |
| planned MVP | Firebase Performance Monitoring: traces, network timings (no signed URL query strings) | Playback/API performance. May land with MVP observability or wait for P7; not a launch blocker. | Same conservative consent/legitimate-interest split as Crashlytics — planned/assumed | Google Firebase Performance Monitoring | **pending D-020** | **pending D-020** | Engineering | Same as Crashlytics. Strip CDN query credentials from traces. |
| planned P7 | FCM / APNs device push token, permission state, preferences | Transactional/editorial push (P4-T08) | Consent for non-essential notifications; Art. 6(1)(b) for strictly necessary service messages if later scoped — planned/assumed | Google Firebase Cloud Messaging; Apple APNs | **pending D-020** | Until rotate/logout/deletion; **pending D-020** | The device user; notifications backend | Tokens rotate, deduplicate, detach on logout/deletion (plan). P2-T02/P4-T08 not started. |
| planned MVP | Firebase App Check attestation tokens | Attest genuine app instances; reduce abuse | Art. 6(1)(f) security of the service — planned/assumed | Google Firebase App Check | **pending D-020** | Token lifetime; **pending D-020** | Verifying backends | Short-lived; not a consumer profile field. |
| planned P7 | RevenueCat: app user id (mapped to Django profile), store product ids, subscription lifecycle, webhook event **references** (not raw receipts in analytics) | Store product presentation, receipt lifecycle, subscription entitlements (ADR 0006). Django ledger remains authority for coins. Deferred from MVP 2026-08-27; MVP commerce is AdMob only. | Art. 6(1)(b) to fulfil a purchase; Art. 6(1)(c) for legally required financial records — planned/assumed | RevenueCat; Apple; Google Play | **pending D-020** | Financial/audit **pending D-020** and legal/accounting needs | Support/finance with least privilege; not analytics | P2-T02: financial audit retains only legally necessary pseudonymous fields. Do not put receipts in analytics. |
| planned MVP | AdMob rewarded ads: ad unit, consent/nPA flags, SSV callback identifiers (server intent), no live ads outside production | Opt-in rewarded ads; production grant from verified server callback. Only MVP monetization path (D-007). | ePrivacy + Art. 6(1)(a) for advertising identifiers / personalization; non-personalized ads still need a legal review — planned/assumed. Gate SDK init on consent. | Google AdMob | **pending D-020** | **pending D-020** | Advertising/ops; Django for entitlement grant | Opt-out/consent withdrawal; entitlement records follow commerce deletion rules (P2-T02/P3). |
| planned MVP | Bunny Stream default: encode/store/deliver ABR HLS; Django mints short-lived access; app plays in `expo-video`, not Bunny’s web player | Production video path (D-014 / ADR 0005). Playback authorize spike **merged** after `85207d2` (PR #45); full MediaAsset/entitlements/player remain later P2 tasks. | Art. 6(1)(b)/(f) to deliver video — planned/assumed. Extra DPA/subprocessors apply (Bunny is an EU company); region still **pending D-020**. | Bunny Stream | **pending D-020** (do not invent an EU-region decision) | Media retained while licensed/operated; takedown must expire/delete at provider (ADR 0005); **pending D-020** | Staff via Django ingestion; viewers only via expiring URLs | Takedown/expiry. Signed URLs never in logs/analytics/Git. |
| planned MVP (documented fallback; **not active**) | GCP Cloud Storage → Transcoder → Cloud CDN signed prefix/cookie | Fallback only if Bunny fails P2-T05, a license/residency/support constraint forbids Bunny, or measured cost/reliability is worse. Do not run both pipelines. | Same as video delivery — planned/assumed. Activate only under ADR 0005 triggers. | Google Cloud (Storage, Transcoder, Cloud CDN) | **pending D-020** | Same as video; **pending D-020** | Staff/ops if activated | Same takedown/expiry rules. **Not active** — do not declare as a shipping SDK/processor until activated. |
| planned MVP | Expo / EAS: Expo account, build metadata, signing handled by EAS/Apple/Google, runtime updates | Development builds, CI/release binaries. Expo Go is not sufficient for AdMob or native Firebase. Purchases wait for P7. | Art. 6(1)(b)/(f) for building and delivering the app — planned/assumed. EAS credentials never in `.env`. | Expo (EAS) | **pending D-020** | Build artifacts per Expo retention; **pending D-020** | Mobile engineers; Expo org admins | Rotate credentials in EAS; delete unused artifacts per provider tools. Not consumer deletion. |
| planned MVP (optional) | Sentry error monitoring | Optional if Firebase Crashlytics plus Cloud Error Reporting is sufficient (plan). | Same conservative consent/legitimate-interest split as Crashlytics — planned/assumed | Sentry (only if adopted) | **pending D-020** | **pending D-020** | Engineering | Do not enable in production without DPA and this inventory update. Prefer Crashlytics + Cloud Error Reporting unless a later decision adopts Sentry. |
| planned MVP | Supabase managed PostgreSQL (dev/early staging) then paid non-pausing production DB; Cloud SQL remains a migration option (ADR 0004). Mobile never connects to Supabase APIs. | Application database: catalog now; profiles, ledger, entitlements later | Art. 6(1)(b)/(f)/(c) depending on table — planned/assumed | Supabase (Postgres); possible future GCP Cloud SQL | **pending D-020** | Backups/PITR **pending D-020**. Free-tier pause is not a production retention policy. | Backend/staff via Django; no direct mobile DB access | P2-T02 for consumer rows; operator procedures for staff/catalog. |
| planned MVP | GCP Cloud Run (Django API/Admin) | Host the modular monolith (ADR 0002) | Art. 6(1)(f) hosting the requested service — planned/assumed | Google Cloud Run | **pending D-020** | Request/instance logs **pending D-020** | Platform/ops | Infra teardown does not replace P2-T02. |
| planned MVP | GCP Cloud Logging (and later Monitoring/Trace/Error Reporting per P5-T07) | Operational logs/metrics. Privacy-safe context only. | Art. 6(1)(f) — planned/assumed. No tokens, receipts, signed URLs, full IP in exported analytics. | Google Cloud Logging | **pending D-020** | **pending D-020** | Engineering/ops | Retention/redaction policy is D-020 + P5-T07. |
| planned P7 | BigQuery export of supported Firebase data + server commerce/ad facts; Looker Studio dashboards (D-016 / ADR 0007) | Funnels, retention, LTV, playback quality. Server/provider facts drive finance. Deferred from MVP 2026-08-27; MVP uses typed Firebase events only. | Consent-originated Analytics exports remain consent-based; financial facts Art. 6(1)(c)/(b) — planned/assumed | Google BigQuery; Looker Studio | **pending D-020** | **pending D-020**; partitioning/cost controls required (ADR 0007) | Product/growth/finance with least privilege | Deletion/export alignment with P2-T02/P4-T02; not implemented. |

### Canonical analytics events

Source: `MICRODRAMA_IMPLEMENTATION_PLAN.md` § Canonical analytics events. P4-T01 implements the typed SDK and account, discovery, playback, and reward events behind consent in local/staging while production stays hard-disabled. Coin, subscription, push, and experiment events are **planned P7**.

Shared planned properties (only if consent permits): `event_id`; anonymous/app-instance ID; authenticated user ID; app version/build; platform; locale; country; timestamp; session ID; series/episode IDs and episode number; offer ID; access method; campaign, ad set, creative, source, medium, deep-link target. Coin price, store product ID, and experiment ID/variant are P7 properties.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| implemented, production-disabled | `app_open`, `sign_up`, `login`, `account_deleted` | Session and account funnel | Art. 6(1)(a) + ePrivacy — planned/assumed, consent-gated | Firebase Analytics | **pending D-020** | **pending D-020** | Product/growth | P2-T02 / P4-T01; deletion clears identity/data before a status-only event and cannot re-identify |
| implemented, production-disabled | `home_viewed`, `series_impression`, `series_opened` | Discovery | Same | Firebase Analytics | **pending D-020** | **pending D-020** | Product/growth | Same |
| implemented, production-disabled | `episode_started`, `episode_progress`, `episode_completed`, `playback_error` | Viewing quality. `playback_error` uses a safe code, never a free-form payload or signed URL. | Same | Firebase Analytics | **pending D-020** | **pending D-020** | Product/engineering | Same |
| implemented, production-disabled | `locked_episode_viewed`, `offer_presented`, `offer_selected` | Lock / ad-offer funnel | Same | Firebase Analytics | **pending D-020** | **pending D-020** | Product/growth | Same |
| implemented, production-disabled | `rewarded_ad_loaded`, `rewarded_ad_started`, `rewarded_ad_completed`, `reward_granted`, `reward_failed` | Ad offer diagnostics. Grants are server-authoritative. | Consent for ads/measurement — planned/assumed | Firebase Analytics (diagnostic); AdMob (ad delivery) | **pending D-020** | **pending D-020** | Product/ads | Same; finance uses verified callbacks, not these events |
| planned P7 | `coin_pack_viewed`, `purchase_started`, `purchase_succeeded`, `purchase_failed`, `purchase_restored`, `coins_spent`, `episode_unlocked` | Commerce diagnostics. No receipts. | Consent for analytics; purchase fulfilment remains Art. 6(1)(b) on the ledger — planned/assumed | Firebase Analytics (diagnostic); Django ledger / RevenueCat (authority) | **pending D-020** | Analytics **pending D-020**; ledger per legal/accounting **pending D-020** | Product vs finance separated | Analytics deletion ≠ ledger retention |
| planned P7 | `subscription_started`, `subscription_renewed`, `subscription_cancelled`, `subscription_expired` | Subscription funnel diagnostics | Same split as commerce | Firebase Analytics (diagnostic); RevenueCat/Django (authority) | **pending D-020** | Same split | Product vs finance | Same split |
| planned P7 | `push_permission_prompted`, `push_permission_result`, `notification_opened` | Push consent and engagement | Art. 6(1)(a) for permission analytics — planned/assumed | Firebase Analytics; FCM for delivery | **pending D-020** | **pending D-020** | Product | Token detach on deletion |
| planned P7 | `experiment_exposure` | Record assignment when behavior is used, not merely fetched | Consent when non-essential — planned/assumed | Firebase Analytics / A/B Testing | **pending D-020** | **pending D-020** | Product/engineering | Same as Analytics deletion |

---

## Edge processors (not silently omitted)

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| not-in-MVP | Transactional email provider for **customized** production auth email if Firebase’s built-in templates are insufficient | Password reset / verification email if Firebase requires customization | Art. 6(1)(b) to send requested account email — planned/assumed **if** a provider is later selected | Unselected. Firebase may send default Auth email without a separate vendor. | **pending D-020** | **pending D-020** | The recipient; provider admins | Not configured. Do not declare a third-party ESP on store labels until selected and inventoried. |
| not-in-MVP / not-adopted | Meta / TikTok advertiser accounts, pixels, or SDK | Paid acquisition creative tests (brief). D-017 budget is **TBD / decision required**. Unpaid until approved. | Would require consent + D-017 approval — **not adopted**. Do not initialize these SDKs. | Meta; TikTok | n/a until D-017 | n/a | n/a | Do not collect. If later approved, add rows and DPAs before any SDK. |
| not-adopted | MMP (for example Adjust or AppsFlyer) | Material paid-acquisition attribution if native attribution cannot answer cohort economics (P4-T07, ADR 0007) | D-018 **decision required**. Would be consent-gated if adopted. | Unselected | n/a until D-018 | n/a | n/a | Do not declare an MMP in privacy labels. Platform-native attribution + campaign parameters remain the small-test path. |

---

## What this slice does not do

- Does not implement or configure any SDK, auth, playback, deletion, commerce, or analytics runtime.
- Does not start P2-T01 device work or P2-T05 device work. P2-T06 MediaAsset staff ingest is this engineering slice; it does not mark P0-T03 complete.
- Does not mark P0-T03 complete. Legal/privacy, content-rating, and ads-only finance/tax owner boxes stay open. Store IAP EUR settlement waits for P7.
- Does not invent a D-020 residency/retention decision. D-005–D-007 are founder-approved 2026-08-27 in the decision register; this inventory does not convert D-008/D-009 from Proposed. D-017, D-018, D-019, D-020, and D-025 remain open.
- Does not treat merged P2-T01 / P2-T05 / P2-T01-F1 as still unshipped; the `85207d2` snapshot is historical.

## Related documents

- `docs/product/STORE_COMPLIANCE_MATRIX.md` — commerce, ads, store, privacy baseline; P0-T03 owner boxes
- `docs/product/DECISION_REGISTER.md`
- `docs/product/MVP_PRODUCT_BRIEF.md` — thinner MVP: 1 series, ads-only (D-004–D-007 approved 2026-08-27)
- `docs/adr/0003-firebase-identity-mobile-services.md` through `0007`
- `MICRODRAMA_IMPLEMENTATION_PLAN.md` — P0-T03, canonical events, privacy rules
- `docs/analytics/README.md` — placeholder until P4-T01

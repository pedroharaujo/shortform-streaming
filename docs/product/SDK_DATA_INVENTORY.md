# SDK and data inventory

**Plan task:** P0-T03 remaining engineering slice
**Status:** Engineering inventory published; P0-T03 is **not** complete
**Code snapshot:** historical as of `85207d2` (`main` at inventory branch creation). It is **not** current `main`. P2-T01 (PR #48), P2-T05 (PR #45), and P2-T01-F1 (PR #51) have since merged; do not treat Firebase Auth or Bunny playback authorize as unshipped.
**Not legal advice.** Lawful-basis and consent cells are conservative GDPR-ready **planned/assumed** engineering defaults for a later legal review. They do not approve processing, transfers, or store declarations.

This file is the single engineering source for later privacy labels (P6-T04), account deletion (P2-T02), and legal/privacy review. Row labels below still describe the `85207d2` research snapshot plus later planned processors; they are not a claim that merged P2-T01/P2-T05 work is still unmerged. This inventory does not authorize production processing.

### Approved scope amendment (2026-09-07; implementation pending)

D-007/D-008/D-015 bring Google Play/RevenueCat coin purchases, ledger and refunds into MVP. D-016/D-032 bring minimum attribution, BigQuery financial/cohort/spend joins and daily LTV/CAC reporting into MVP. D-034 makes France/Android/English/one audience active launch configuration with generalized domain capability; D-004 targets approximately 3–5 titles with D-031 free/ad/coin/paid-promotion rights. No processor, region, retention period, license value or production activation is approved by this inventory update. The revised planned tables below supersede the older P7 timing; historical snapshot tables remain labeled as evidence only.

### Dormant purchase coordinator (P3-T06, 2026-09-09)

The injected synthetic checkout coordinator can persist one unresolved marker per
server purchase identity in Expo SecureStore. The strict versioned marker contains
only that opaque identity, synthetic application/product IDs and a random attempt
UUID. It contains no Firebase UID, credential, price, receipt, raw transaction ID
or provider payload. Transaction IDs exist only in process memory for an owned
attempt and in an authenticated status request body; they never enter public
state, logs or analytics. Process loss therefore blocks an unknown attempt instead
of claiming automatic reconciliation or initiating another checkout.

The shipped coordinator factory remains disabled without constructing a provider
or touching storage/network. No new SDK or processor is adopted. Account changes
do not expose or erase another owner's unresolved marker. Corrupt or inaccessible
storage fails closed. Before real checkout, extend and validate the account
deletion/device cleanup and provider reconciliation lifecycle under P2-T02/D-020;
this synthetic implementation does not approve financial retention or deletion.

### Current analytics implementation (2026-09-02; checked against schemas 2026-09-07)

The Android runtime has one consent-gated typed event set: `app_open`, `sign_up`,
`login`, `account_deleted`, `episode_started`, `episode_completed`,
`playback_error`, `locked_episode_viewed`, `rewarded_ad_started`,
`reward_granted`, and `reward_failed`. Events use allowlisted app/session and
episode context only. Password/provider payloads, email, Firebase UID, signed URLs,
SSV bindings, transaction identifiers, raw errors, and free-form PII never enter
Analytics. Reward authority remains the verified server callback and entitlement.

Campaign attribution, custom deep-link parsing, Install Referrer, first/last touch,
and campaign properties were removed on 2026-09-02. That implementation history
is unchanged. Minimum attribution is now planned MVP under P4-T06; D-020 precedes
real collection/export and D-017 budget approval precedes spend. D-018 is conditional
on MMP need; advanced deferred links remain post-MVP unless necessary for the test.

### P5-T05-F3 App Check implementation update (2026-09-02)

The Android dependency and custom-backend verification boundary are implemented.
Development builds use Firebase's debug provider without an embedded debug token;
release builds select Play Integrity. When its public rollout switch is enforced,
the app requests a short-lived token on demand for each consumer API request and sends it only in
`X-Firebase-AppCheck`. Django verifies the Firebase project and exact Android app
ID before protected `/v1/` view work, except for the separately signed AdMob
callback. Tokens and decoded claims are not persisted or logged. Production
enforcement defaults off until issue #122's provider/device and D-020 review gates
pass.

### P4-T01 F2 implementation update (2026-09-01)

The mobile dependency and a tested consent controller for Firebase Analytics are
now present. Native collection, storage consent, screen reporting, and advertising
identifiers all default off. A process-wide controller now follows the current
server-owned profile preference across sign-in, preference changes, sign-out,
session replacement, unauthenticated cleanup, and deletion. Only the opaque backend
profile ID may be linked after consent; withdrawal and session cleanup disable
collection, clear identity, and reset local Analytics data. Product and account
event triggers are implemented. Production defaults disabled; the current consent adapter remains a no-op in
production even with the public switch, so later release implementation and
D-020/privacy/store/P6 approval are required before activation.

Open P0-T03 owner boxes now include France privacy/legal and rating review, AdMob plus Google coin merchant/tax/refund/recognition and EUR settlement, D-008 final terms/values, and review of RevenueCat/attribution/warehouse data. See `STORE_COMPLIANCE_MATRIX.md`. D-017 budget/guardrails and D-035 audience precede paid spend.

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
processors and planned MVP coin financial records must specify their own deletion/retention integration
before shipping. No legal, privacy-label, residency, or retention approval is
implied by this update.

### Historical status labels

Every inventory row uses one of:

| Label | Meaning |
|---|---|
| **current-on-main** | Present in code and OpenAPI at the `85207d2` snapshot. Later `main` also includes merged P2-T01 / P2-T01-F1 / P2-T05; see the snapshot note above. |
| **in-flight (not merged)** | Research label from the `85207d2` inventory. P2-T01 (PR #48) and P2-T05 (PR #45) have **merged** since then; do not treat those rows as still unshipped. |
| **planned MVP** | Required by current approved MVP scope; not implemented unless a newer implementation update says otherwise. |
| **planned P7** / **not-in-MVP (deferred P7)** | Remaining post-MVP scope. The blanket issue #52 timing from 2026-08-27 is superseded for Android coins and minimum economics on 2026-09-07; see current planned rows. |
| **not-in-MVP** / **not-adopted** | Explicitly out of MVP or awaiting a decision so the processor is not silently omitted or declared in store labels. |

## Decision fidelity

| ID | Inventory treatment |
|---|---|
| D-013 | **Accepted.** Firebase Auth, Analytics, Crashlytics, and App Check are planned MVP processors (ADR 0003). Remote Config A/B and FCM are **planned P7**. Consumer Firebase Auth verification (`GET /v1/me`) and native Android Auth (P2-T01 / P2-T01-F1) have **merged to `main` after** `85207d2`. Do not treat Firebase Auth as unshipped. |
| D-014 / ADR 0005 | Bunny Stream is the accepted **default**; GCP Cloud CDN is the **documented fallback and is not active**. P2-T05 on-device proof is not this task. |
| D-015 / ADR 0006 | Google Play coins/RevenueCat plus Django ledger, lifecycle/refunds, atomic unlock and reconciliation are **planned MVP** under the 2026-09-07 direction. Apple and subscriptions remain P7; no new runtime is claimed. |
| D-016 / ADR 0007 | Existing typed events are implemented, production-disabled. Minimum commerce/acquisition events, BigQuery export/facts/spend/cost models and daily report are **planned MVP**; Looker/experiments/push remain P7. |
| D-001 / D-004 / D-023 / D-027 / D-031 | 2026-09-07 direction: approximately 3–5 independently approved titles; France/Android/English/one audience are launch configuration; licensed free/ad/coin/paid-promotion rights required. Current fixed-context implementation is historical P2-T03-F2; generalized configuration/permissions planned P2-T03-F3/P3-T01-F1. |
| D-005–D-007 | 2026-09-07: anonymous free viewing, auth before monetized unlock/purchase, editorial per-episode free/ad/coin/both policy; rewarded-ad-only scope superseded. No runtime change by this inventory. |
| D-008 / D-009 | D-008 coin MVP direction **Approved** 2026-09-07; prices/sizes/final terms/refund policy remain open. D-009 subscription remains Proposed/post-MVP. |
| D-017 | Budget/test period/business guardrails **Decision required before MVP paid spend**; no amount approved. Ad-network SDKs/pixels are not automatically adopted. |
| D-018 | MMP threshold/adoption **Decision required when justified** by spend/ambiguity; no MMP adopted and no blanket dependency for the capped MVP test. |
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

## Current MVP implementation (2026-09-02)

This section describes observed implementation, not the full 2026-09-07 target.
The later planned tables define additions; the revision-specific tables below
remain historical research evidence and are not a current implementation guide.

| Field / event | MVP use | Processor / storage | Access and deletion |
|---|---|---|---|
| Public catalog: opaque ids, direct English title/synopsis, artwork metadata, genre, order, duration and lock state | Serves eligible self-owned or licensed series in France on Android. Territory, platform, and language are server constants; clients send no market headers. | Django/PostgreSQL | Anonymous catalog readers receive public fields only. Unpublish, global/right takedown, rights mismatch/expiry, DRM requirement, or a closed episode window hides content. |
| `Series.self_owned`, `provenance_reference`, `promotional_use_approved`, `takedown`, `free_episode_count`, `rewarded_ads_enabled`; `ContentRight` licensor/private reference, territory allow/deny, platform/language grant, window, takedown, DRM and promotional-use fields | Private self-owned provenance or licensed publication/eligibility evidence and the earlier free/ad access policy; per-episode coin/both methods and new rights permissions are planned. | Django Admin/PostgreSQL | Staff only except derived eligibility/lock/offer output. Never analytics data. No contracts, rates, provider payloads, personal data, or licensed media enter this repository. |
| `MediaAsset` upload/processing/ready/removed state plus checksum, provider id, captions, thumbnails, duration and renditions | Keep Django Admin ingestion, publication, and playback fail-closed. | Django/PostgreSQL + private upload landing store + Bunny Stream | Staff upload only privately cleared masters through Admin. Licensed-master ingestion remains a human D-031 gate; publication and playback fail closed without a valid runtime grant. Viewers receive only short-lived authorized playback URLs. |
| Firebase UID, profile preferences, password or Google provider identity, email held by Firebase, and short-lived ID token | Email/password or Google Sign-In, authenticated progress, rewards, and same-provider deletion reauthentication. | Firebase Authentication + Django/PostgreSQL | A user reads/updates only their profile. Email is not copied to Django or Analytics. Deletion removes the Firebase identity and local account data through the idempotent deletion workflow. |
| Anonymous device UUID and `WatchProgress` | Resume anonymous free playback without creating an account. | Device SecureStore + Django/PostgreSQL | Sent only as `X-Device-Id`; uninstall clears the device copy. Server retention remains D-020. |
| Reward intent, Google SSV transaction id/status and episode entitlement | Grant one episode after an authentic, replay-safe rewarded-ad callback. | Django/PostgreSQL + Google AdMob | Server-only authority. The client cannot grant rewards. Production remains disabled until publisher validation and consent/release gates pass. |
| Consent-gated typed Analytics events | Minimum product learning: app/auth/account, episode start/complete/error, lock, and reward outcome. | Firebase Analytics when explicitly enabled | No email, UID, signed URL, free-form PII or provider payload. Opt-out disables collection and clears identity. |

## Historical `85207d2` snapshot (not current implementation)

Verified against `backend/apps/health/`, `backend/apps/catalog/`, `backend/config/settings/base.py`, `backend/config/urls.py`, `backend/config/exceptions.py`, and `docs/api/openapi.yaml` at `85207d2`. OpenAPI paths on this revision are `/health/live`, `/health/ready`, `/v1/catalog/home`, `/v1/series/{public_id}`, `/v1/episodes/{public_id}` only. There is no `LOGGING` dict; Django’s default request/error logging applies. `AUTH_USER_MODEL` is unset, so staff identity is `django.contrib.auth` `User`. Consumer Firebase identity is **not** on this revision. The status labels below are relative to that historical snapshot, not current `main`.

| Status at `85207d2` | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| current-on-main | `GET /health/live` — JSON `{status}` only; no request body; unauthenticated | Process liveness. Does not query PostgreSQL. Not a consumer data collection point. | Not personal data in normal use; if a client IP appears in infra logs, Art. 6(1)(f) security/reliability — planned/assumed | Django app process (planned hosting: GCP Cloud Run) | **pending D-020** | **pending D-020**; process logs have no app-level retention policy on `main` | Platform/ops; no consumer role | No stored personal record to delete. Infra logs follow **pending D-020**. |
| current-on-main | `GET /health/ready` — JSON `{status}`; unauthenticated; bounded `SELECT 1` | Readiness including PostgreSQL reachability | Same as live probe. Probe is not a catalog or identity read. | Django + PostgreSQL | **pending D-020** | **pending D-020** | Platform/ops | No consumer profile. Database exists as infrastructure, not as this probe’s dataset. |
| current-on-main | Anonymous `GET /v1/catalog/home`, `GET /v1/series/{id}`, `GET /v1/episodes/{id}` | Public catalog for an explicit request context. MVP config is France/Android/English with one self-owned series; existing generalized eligibility remains. `authentication_classes = []`, `AllowAny`. Ineligible ids return 404, never 403. Monetization lock state omitted. | Art. 6(1)(b) steps to deliver the requested catalog **or** Art. 6(1)(f) to serve a public catalog — planned/assumed. D-005 guest/monetization boundary is **Founder approved 2026-08-27**; this row is still P2-T03 engineering, not an SDK. | Django API; PostgreSQL catalog tables | **pending D-020** | Editorial catalog retained while the title is operated; **pending D-020** for backups/replicas | Anonymous clients (eligible metadata only); staff Admin (full editorial/provenance and future-rights fields) | Catalog rows are editorial, not consumer accounts. Takedown/unpublish hides titles from public GET. No P2-T02 consumer deletion on `main`. |
| current-on-main | Request headers `X-Territory` (ISO 3166-1 alpha-2), `X-Platform` (`ios` or `android`), `X-Language` (ISO 639-1). Required; never inferred from `Accept-Language`. MVP sends the fixed France/Android/English launch context. | Existing eligibility compatibility; MVP does not add multi-country behavior. | Art. 6(1)(b)/(f) to deliver the configured catalog — planned/assumed. Not used as a user profile on `main`. | Django (in-memory request context); not persisted as a user field on `main` | **pending D-020** | Request-scoped. The structured application completion logger does not include these headers. Infrastructure log retention remains **pending D-020**. | Anonymous client supplies; staff do not need these headers for Admin | Nothing stored on a consumer profile. Log retention is **pending D-020** / P5 observability. |
| current-on-main | Optional `X-Request-ID` or generated UUID → response `X-Request-ID`, API `ErrorEnvelope.request_id`, and structured completion `request_id` | Correlate a client-visible response with server handling. Envelope messages are static/safe. | Art. 6(1)(f) support/diagnostics — planned/assumed | Django process stdout; planned Cloud Logging | **pending D-020** | Request log lifetime **pending D-020** | Client (value sent/received); staff/ops with log access | Not a durable consumer identifier. No deletion workflow on `main`. |
| current-on-main | Public catalog payload: opaque `public_id`, localized title/synopsis, optional `artwork_url` metadata, `original_language`, genre names, season/episode order, `duration_seconds` | Render home, series detail, and episode detail | Art. 6(1)(b)/(f) as catalog content — planned/assumed. Not personal data. | Django; PostgreSQL | **pending D-020** | While the title remains in the catalog / backups **pending D-020** | Anonymous clients; staff Admin | Editorial unpublish/takedown. `contract_reference` is **not** in serializers (verified at `85207d2`). |
| current-on-main | `ContentRight.contract_reference` (opaque CharField). Seed values are generated (`synthetic-contract-{name}`). Never rates. | Existing future-licensing compatibility. MVP self-owned provenance is recorded privately and no licensor contract is required. | Not consumer PII. Must never go to analytics or the public API. If a future contract identifier could identify a person, treat as confidential staff data — planned/assumed. | Django Admin + PostgreSQL | **pending D-020** | While the row exists; future licensed-record handling is post-MVP, **pending D-020** | Staff (`is_staff` Admin). Not returned on public GET. | Staff may delete/replace rows in Admin. Not part of consumer deletion. Never send to analytics. |
| current-on-main | Other staff-only rights fields: licensor display name, territory allow/deny lists, platforms, language grant, window, exclusive, takedown, `drm_required` (stored, not enforced on GET), opaque `revenue_share_rule_reference` (never rates) | Existing generalized publish/eligibility compatibility; MVP uses France/Android/English defaults and self-owned provenance | Not consumer PII. Confidential business metadata stays in Admin/Postgres. | Django Admin + PostgreSQL | **pending D-020** | **pending D-020** | Staff Admin | Operator takedown/edit. Not a consumer dataset. |
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
| historical slice | `GET`/`PUT /v1/progress/{episode_id}`; optional Firebase Bearer; anonymous `X-Device-Id` (UUID) | Read/upsert progress after the same authorization decision as playback. France/Android/English are fixed server-side; no catalog context headers remain. Lock → 403, ineligible → 404, never mint. | Art. 6(1)(b)/(f) — planned/assumed. Invalid Bearer is 401, not anonymous. | Django | **pending D-020** | Request-scoped logs **pending D-020**; durable row as above | Same as WatchProgress | Same. Do not log signed URLs. |
| in-flight (not merged) | Client-generated anonymous device UUID in `expo-secure-store`, sent only as `X-Device-Id` on progress | Correlate anonymous resume without creating `UserProfile` or a Firebase anonymous user. | Art. 6(1)(f) to resume on-device playback — planned/assumed. Not an account. | On-device SecureStore; Django stores the UUID on anonymous rows only | Device; server **pending D-020** | Until app uninstall / SecureStore clear; server until P2-T02 | The device; Django for matching rows | Uninstall clears the client key (new UUID next install). Server deletion is P2-T02. Never put the UUID in `EXPO_PUBLIC_*`. |

### P2-T06 — MediaAsset provider metadata (current MVP)

Staff upload and encode **self-owned/generated test media** directly in Bunny Stream,
then record only ready provider metadata in Django Admin. Django has no signed upload,
object-store landing zone, or processing pipeline. GCP Cloud CDN fallback stays
unplugged and is not a playback origin. D-020 residency/retention is not decided here.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| implemented | `MediaAsset` (provider name/id, ready/removed state, caption presence, thumbnail count, duration and renditions) | Prevent publication or playback without a ready provider asset and valid self-owned publication metadata. PostgreSQL stores provider ids, not video bytes. | Art. 6(1)(f) to operate the service / Art. 6(1)(b) to deliver requested playback — planned/assumed. MVP uses only approved self-owned media. | Django/PostgreSQL; active `VideoProvider` (Fake locally; Bunny Stream when configured). | **pending D-020** | While the episode is operated; takedown expires/deletes the provider asset; **pending D-020** | Staff via Django Admin. Viewers receive only short-lived URLs from authorize. | Admin takedown → `removed` + provider delete/expire. Signed URLs, API keys and raw provider payloads must not appear in logs or Admin. |

---

## Planned processors

Accepted directions in D-013/D-014/D-007/D-015/D-016 and ADRs 0003–0007; scope labels below updated 2026-09-07. Prior issue #52 P7 timing is superseded for Android coins and minimum economics. **Snapshot:** processors not implemented on `main` at `85207d2` remain labeled planned below, except that consumer Firebase Auth verification and Bunny playback authorize later merged (see snapshot note). Region and retention remain **pending D-020**. Consent/deletion propagation is P2-T02 / P4-T01 / P6-T04, not this slice.

| Status | Field / event (processor + typical data) | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| implemented MVP | Firebase Authentication with Android email/password and Google Sign-In; provider id and Firebase UID. Phone/SMS and Apple providers are outside MVP. | Consumer identity. Django verifies ID tokens and owns profiles (ADR 0003). Email stays in Firebase, not in analytics. | Art. 6(1)(b) to create/use an account — planned/assumed. D-005 and D-030 are founder approved. | Google Firebase Authentication | **pending D-020** | **pending D-020** | The account holder; Django via UID; Firebase project admins | The idempotent P2-T02 workflow deletes the Firebase user and local profile data after same-provider reauthentication. |
| implemented, production-disabled | Firebase Analytics: app-instance / user ids where consent permits; canonical MVP events below | Product analytics. **Not** the financial ledger (ADR 0003/0007). | Art. 6(1)(a) + ePrivacy consent for non-essential measurement — planned/assumed, consent-gated | Google Firebase Analytics | **pending D-020** | **pending D-020** | Product/growth/engineering with least privilege | Opt-out/session cleanup disables collection, clears identity, and resets local data. Accepted deletion emits status only after identity detachment, then disables collection. |
| planned P7 | Firebase Remote Config | Server-safe client defaults: paywall position, free-episode count, coin price, ad offer, messaging. MVP access uses server/Admin episode policy (D-006); client configuration cannot change rights, coin price or entitlements. | Art. 6(1)(f) to configure the client **or** consent if tied to profiling — planned/assumed. Server remains authoritative. | Google Firebase Remote Config | **pending D-020** | **pending D-020** | Engineering/product; fetched by the app | Fetch is not a durable consumer record. Experiment exposure is a separate event. |
| planned P7 | Firebase A/B Testing / experiment assignment | Reversible client experiments (ADR 0007). Log exposure when behavior is used. | Consent when the experiment is non-essential / profiling — planned/assumed | Google Firebase A/B Testing (with Analytics) | **pending D-020** | **pending D-020** | Product/engineering | Stop experiment; deletion of Analytics identifiers follows P2-T02/P4-T01. Optional server `ExperimentExposure` only for financially material server decisions. |
| planned MVP | Firebase Crashlytics: stack traces, device model/OS, app version; no free-form PII payload | Crash reporting | Art. 6(1)(f) for stability of a requested app **or** consent if not strictly necessary — planned/assumed. Conservative default: consent-gated unless legal later classifies it as strictly necessary. | Google Firebase Crashlytics | **pending D-020** | **pending D-020** | Engineering | Deletion/opt-out per provider tools and P2-T02; never put tokens, emails, or signed URLs in crash context. |
| planned MVP | Firebase Performance Monitoring: traces, network timings (no signed URL query strings) | Playback/API performance. May land with MVP observability or wait for P7; not a launch blocker. | Same conservative consent/legitimate-interest split as Crashlytics — planned/assumed | Google Firebase Performance Monitoring | **pending D-020** | **pending D-020** | Engineering | Same as Crashlytics. Strip CDN query credentials from traces. |
| planned P7 | FCM / APNs device push token, permission state, preferences | Transactional/editorial push (P4-T08) | Consent for non-essential notifications; Art. 6(1)(b) for strictly necessary service messages if later scoped — planned/assumed | Google Firebase Cloud Messaging; Apple APNs | **pending D-020** | Until rotate/logout/deletion; **pending D-020** | The device user; notifications backend | Tokens rotate, deduplicate, detach on logout/deletion (plan). P4-T08 push integration remains planned; account deletion already exists and must integrate each new processor. |
| implemented, production-disabled | Firebase App Check attestation token and verified Android app ID claim | Attest genuine app instances; reduce abuse without replacing user authentication, authorization, rights, or idempotency | Art. 6(1)(f) security of the service — planned/assumed | Google Firebase App Check / Play Integrity | **pending D-020** | Provider-managed token lifetime; no application persistence; **pending D-020** | Verifying backend only; no Analytics/log access | When the public rollout switch is enforced, requested on demand and sent only in `X-Firebase-AppCheck`; token and claims are not stored or logged. Debug token registration is private. |
| planned MVP (Android coins); Apple/subscriptions P7 | RevenueCat app user ID mapped to account, store/product/environment/transaction identity, purchase/refund state, original amount/currency, private event reference | Verify Google coin lifecycle; Django ledger/entitlements own balance/access (D-015). No raw receipts/payloads in client Analytics or public Git. | Purchase fulfillment/required finance basis to be approved; analytics still optional consent — planned/assumed | RevenueCat; Google Play; restricted Django finance storage. Apple later | **pending D-020** | Minimal audit/financial retention, deletion/alias/late-event procedure **pending D-020/legal** | Least-privilege commerce/support/finance; separated analytics joins | Extend P2-T02 before shipping: delete/propagate what is not legally required, retain only approved pseudonymous audit facts; prevent cascade loss or reassignment of money. |
| planned MVP | Wallet, immutable CoinLedgerEntry, StoreTransaction, episode entitlement/source and reconciliation/adjustment references | Persistent coins, idempotent credits, atomic debit/grant, refunds/chargebacks and support audit; not a cash wallet | Fulfillment and legal/fraud retention review pending; client diagnostics require separate consent | Django/PostgreSQL; restricted downstream finance models | **pending D-020** | Per-field financial/operational periods and backups pending legal/accounting approval | Owner-only balance; least-privilege support adjustments; no normal staff editing history | Define deletion-versus-financial retention and late-event ownership before release; no blanket retention or accidental deletion of ledger audit. |
| planned MVP | AdMob rewarded ads: ad unit, consent/nPA flags, SSV callback identifiers (server intent), no live ads outside production | Opt-in rewarded ads; production grant from verified server callback. One of two MVP paths alongside purchased coins (D-007). | ePrivacy + Art. 6(1)(a) for advertising identifiers / personalization; non-personalized ads still need a legal review — planned/assumed. Gate SDK init on consent. | Google AdMob | **pending D-020** | **pending D-020** | Advertising/ops; Django for entitlement grant | Opt-out/consent withdrawal; entitlement records follow commerce deletion rules (P2-T02/P3). |
| implemented MVP | Bunny Stream default: staff upload/encode directly in Bunny; Django records ready metadata and mints short-lived access; Android plays in `expo-video` | Production video path (D-014 / ADR 0005). Django does not ingest or serve video bytes. | Art. 6(1)(b)/(f) to deliver video — planned/assumed. Extra DPA/subprocessors apply; region remains **pending D-020**. | Bunny Stream | **pending D-020** | Media retained while operated; takedown must expire/delete at provider; **pending D-020** | Staff manage provider assets; viewers receive expiring URLs only | Takedown/expiry. Signed URLs never in logs/analytics/Git. |
| planned MVP (documented fallback; **not active**) | GCP Cloud Storage → Transcoder → Cloud CDN signed prefix/cookie | Fallback only if Bunny fails P2-T05, a license/residency/support constraint forbids Bunny, or measured cost/reliability is worse. Do not run both pipelines. | Same as video delivery — planned/assumed. Activate only under ADR 0005 triggers. | Google Cloud (Storage, Transcoder, Cloud CDN) | **pending D-020** | Same as video; **pending D-020** | Staff/ops if activated | Same takedown/expiry rules. **Not active** — do not declare as a shipping SDK/processor until activated. |
| planned MVP | Expo / EAS: Expo account, build metadata, signing handled by EAS/Apple/Google, runtime updates | Development builds, CI/release binaries. Expo Go is not sufficient for AdMob or native Firebase. Android Google/RevenueCat coin integration is planned MVP; Apple/subscriptions remain P7. | Art. 6(1)(b)/(f) for building and delivering the app — planned/assumed. EAS credentials never in `.env`. | Expo (EAS) | **pending D-020** | Build artifacts per Expo retention; **pending D-020** | Mobile engineers; Expo org admins | Rotate credentials in EAS; delete unused artifacts per provider tools. Not consumer deletion. |
| planned MVP (optional) | Sentry error monitoring | Optional if Firebase Crashlytics plus Cloud Error Reporting is sufficient (plan). | Same conservative consent/legitimate-interest split as Crashlytics — planned/assumed | Sentry (only if adopted) | **pending D-020** | **pending D-020** | Engineering | Do not enable in production without DPA and this inventory update. Prefer Crashlytics + Cloud Error Reporting unless a later decision adopts Sentry. |
| planned MVP | Supabase managed PostgreSQL (dev/early staging) then paid non-pausing production DB; Cloud SQL remains a migration option (ADR 0004). Mobile never connects to Supabase APIs. | Application database: catalog now; profiles, ledger, entitlements later | Art. 6(1)(b)/(f)/(c) depending on table — planned/assumed | Supabase (Postgres); possible future GCP Cloud SQL | **pending D-020** | Backups/PITR **pending D-020**. Free-tier pause is not a production retention policy. | Backend/staff via Django; no direct mobile DB access | P2-T02 for consumer rows; operator procedures for staff/catalog. |
| planned MVP | GCP Cloud Run (Django API/Admin) | Host the modular monolith (ADR 0002) | Art. 6(1)(f) hosting the requested service — planned/assumed | Google Cloud Run | **pending D-020** | Request/instance logs **pending D-020** | Platform/ops | Infra teardown does not replace P2-T02. |
| planned MVP | GCP Cloud Logging (and later Monitoring/Trace/Error Reporting per P5-T07) | Operational logs/metrics. Privacy-safe context only. | Art. 6(1)(f) — planned/assumed. No tokens, receipts, signed URLs, full IP in exported analytics. | Google Cloud Logging | **pending D-020** | **pending D-020** | Engineering/ops | Retention/redaction policy is D-020 + P5-T07. |
| planned MVP | Minimum Firebase Analytics export plus backend/store/ad/ledger/refund and private spend/content/infra facts; approved opaque cohort joins | Contribution LTV/CAC, retention and ad/coin economics; client finance diagnostics never authoritative | Exported Analytics retains consent conditions; financial/legal basis separately reviewed — planned/assumed | Google BigQuery; private controlled source imports | **pending D-020** | Per-dataset retention/deletion, partitions, query/budget controls **pending D-020** | Product/growth/finance least privilege; no public datasets/exports | Propagate deletion/withdrawal to permitted event/user joins and processors; retain only approved financial audit; prove export cleanup and backup handling. |
| planned P7 | Looker Studio dashboards, expanded Crashlytics/Remote Config/experiment exports | Advanced visualization/experiments beyond MVP daily report | Review before adoption; inherited consent does not authorize new purposes | Google BigQuery/Looker/Firebase as adopted | **pending D-020** | **pending D-020** | Least-privilege readers/owners | Extend export/deletion inventory before adding processors. |
| planned MVP | Bounded source/campaign/creative IDs, acquisition/cohort date, approved pseudonymous join key, consent/attribution coverage and network spend rows with date/currency/provenance | Minimum campaign-spend to acquired-user/revenue/cost cohort joins; Google Play/native attribution or Install Referrer where needed, no MMP by default | Live tracking basis/consent and retention require D-020; D-017 controls spend, not automatic tracking permission | Google Play/native attribution, selected ad-network private reports, Django/BigQuery as implemented | **pending D-020** | Attribution window/device persistence/export retention **pending D-020 and P4-T06 review** | Growth/finance aggregate reports; restricted identity joins | Clear/detach device/account attribution as required, propagate deletion/withdrawal to approved joins; keep lawful aggregate spend, never raw personal URLs/referrers or unauthorized tracking history. |

### Canonical analytics events

Source: `MICRODRAMA_IMPLEMENTATION_PLAN.md` § Canonical analytics events. P4-T01 implements the typed Android app, account, playback, lock, and reward events behind explicit build enablement and consent. Coin/commerce and minimum campaign properties are **planned MVP** (P4-T01-F5/P4-T06). Subscription, push and experiment events remain **planned P7**.

Shared MVP properties (only if consent permits): event ID; ephemeral session ID; app version/build; Android platform; locale; timestamp; series/episode IDs and episode number; access method; safe outcome/error codes. Bounded campaign/creative, server method and store-product/coin fields are planned MVP additions, subject to the revised schemas; push/experiment properties remain P7. Restricted financial keys/amounts do not become raw client properties.

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| implemented, production-disabled pending release implementation/approval | `app_open`, `sign_up`, `login`, `account_deleted` | App and account funnel; authentication method is a bounded `password` or `google` value | Art. 6(1)(a) + ePrivacy — planned/assumed, consent-gated | Firebase Analytics | **pending D-020** | **pending D-020** | Product | P2-T02 / P4-T01; deletion clears identity/data before a status-only event and cannot re-identify |
| implemented, production-disabled pending release implementation/approval | `episode_started`, `episode_completed`, `playback_error` | Viewing quality. `playback_error` uses a safe code, never a free-form payload or signed URL. | Same | Firebase Analytics | **pending D-020** | **pending D-020** | Product/engineering | Same |
| implemented, production-disabled pending release implementation/approval | `locked_episode_viewed` | Lock reach | Same | Firebase Analytics | **pending D-020** | **pending D-020** | Product | Same |
| implemented, production-disabled pending release implementation/approval | `rewarded_ad_started`, `reward_granted`, `reward_failed` | Minimum ad diagnostics. Grants are server-authoritative. | Consent for ads/measurement — planned/assumed | Firebase Analytics (diagnostic); AdMob (ad delivery) | **pending D-020** | **pending D-020** | Product/ads | Same; verified callbacks, not Analytics, are authoritative |
| planned MVP | `offer_presented`, `offer_selected`, `coin_pack_viewed`, `purchase_started`, `purchase_completed`, `purchase_failed`, `purchase_refunded`, `coins_credited`, `coins_spent`, `episode_unlocked`; `unlock_method` | Exposure diagnostics and separate server facts per analytics contract. Historical `purchase_succeeded` maps to `purchase_completed`; no duplicate counting. Existing `locked_episode_viewed` covers paywall/lock. | Optional diagnostic consent; fulfillment/legal financial retention requires separate approval | Firebase Analytics diagnostics; Django/store/RevenueCat authoritative facts and restricted BigQuery joins | **pending D-020** | Separate analytics and financial retention periods **pending D-020/legal** | Product diagnostics versus least-privilege finance | Analytics deletion does not authorize financial history destruction or indefinite retention; approved minimization and processor cleanup required. |
| planned P7 | `subscription_started`, `subscription_renewed`, `subscription_cancelled`, `subscription_expired` | Subscription funnel diagnostics | Same split as commerce | Firebase Analytics (diagnostic); RevenueCat/Django (authority) | **pending D-020** | Same split | Product vs finance | Same split |
| planned P7 | `push_permission_prompted`, `push_permission_result`, `notification_opened` | Push consent and engagement | Art. 6(1)(a) for permission analytics — planned/assumed | Firebase Analytics; FCM for delivery | **pending D-020** | **pending D-020** | Product | Token detach on deletion |
| planned P7 | `experiment_exposure` | Record assignment when behavior is used, not merely fetched | Consent when non-essential — planned/assumed | Firebase Analytics / A/B Testing | **pending D-020** | **pending D-020** | Product/engineering | Same as Analytics deletion |

---

## Edge processors (not silently omitted)

| Status | Field / event | Purpose | Lawful basis / consent (planned/assumed) | Processor | Region | Retention | Access roles | Deletion behavior |
|---|---|---|---|---|---|---|---|---|
| planned MVP campaigns; network/provider selection open, SDKs/pixels not adopted | Approved network advertiser account and bounded campaign/creative/spend exports; no automatic device SDK/pixel | Small capped test after D-017 approval, audience D-035, private promotion rights and privacy review | D-017 budget is not tracking consent; D-020/legal review of chosen attribution path required | Network(s) to be selected; Meta/TikTok are options, not approvals | **pending selection/D-020** | Approved aggregate spend/attribution retention TBD | Growth/finance least privilege | Review purposes/DPA/deletion before any processor/SDK integration; no SDK initialized by this plan. |
| conditional/not-adopted | MMP, e.g. Adjust or AppsFlyer | Attribution only if initial or later spend/ambiguity justifies it (P4-T07) | D-018 explicit decision plus D-020 privacy/consent review before adoption | Unselected | n/a until adoption | n/a until adoption | n/a | Minimum MVP attribution is required separately under P4-T06; no automatic MMP collection. |

---

## Limits of this documentation update

- Implements/configures no SDK, schema, runtime, account, export, campaign or processor.
- Does not close P0-T03 or approve D-020, D-008 commercial terms, D-017 spend, D-035 audience or production activation; D-018 remains conditional. D-019/D-031 fail-closed direction is approved, but each actual license needs private review.
- Preserves historical inventory/evidence with explicit snapshot labels. Current code has no coin/warehouse/attribution implementation implied by these planned rows; exact shipping binary/network inspection remains P6-T04 work.

## Related documents

- `docs/product/STORE_COMPLIANCE_MATRIX.md` — commerce, ads, store, privacy baseline; P0-T03 owner boxes
- `docs/product/DECISION_REGISTER.md`
- `docs/product/MVP_PRODUCT_BRIEF.md` — current ad-plus-coin LTV/CAC MVP, approximately 3–5 titles, launch configuration versus platform capability (2026-09-07)
- `docs/adr/0003-firebase-identity-mobile-services.md` through `0007`
- `MICRODRAMA_IMPLEMENTATION_PLAN.md` — P0-T03, canonical events, privacy rules
- `docs/analytics/README.md` — current implementation history plus planned commerce/cohort metric definitions

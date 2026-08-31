# P3-T07 verified rewarded ads

Task: P3-T07. Authority: D-005, D-007, D-027, ADR 0002/0003,
MVP_PRODUCT_BRIEF and STORE_COMPLIANCE_MATRIX. The user authorized implementation
through a focused PR without routine approval pauses; no public activation.

The separately approved [P3-T07-F1 callback test](2026-08-31-p3-t07-callback-test-design.md)
extends this scope to a temporary callback-only public test and local publisher
unit configuration. It does not authorize production activation.

## Design

Use the existing Django modular monolith and PostgreSQL transaction boundary.
An `advertising` app owns intents and verified callback processing; existing
EpisodeEntitlement and playback authorization remain the access authority.
A separate queue would complicate deletion and grant reconciliation unnecessarily.
Client-authoritative grants are excluded by the product specification.

POST `/v1/rewards/intents` requires Firebase authentication, catalog context,
`episode_id`, UUID `request_id`, and `accepted: true`. It rechecks the current
profile (including ads preference), Android platform, eligible content and an
available rewarded offer. A 15-minute intent stores the server-selected user,
episode, context and test unit. `(profile, request_id)` is unique. Reusing a key
for a different episode fails; concurrent requests cannot duplicate the intent.

The response schema `RewardIntent` contains `id`, `episode_id`, `status`
(`pending`, `granted`, `expired`, `unavailable`), `expires_at`, `reward_description`,
`ad_unit_id`, `ssv_user_id`, `custom_data`. The SSV identifiers are random opaque
per-intent values, not Firebase UIDs or emails. `custom_data` binds the callback
to the intent; `ssv_user_id` supplies an independent binding. GET
`/v1/rewards/{reward_id}` is authenticated and owner-only. No response includes
a playable URL. Static safe errors use the existing ErrorEnvelope.

GET `/v1/rewards/admob/ssv` is unauthenticated at the HTTP layer but verifies
Google ECDSA/SHA-256 signatures before database effects. Verify the exact raw
query prefix before `signature` and `key_id`; reject duplicates, malformed
encoding, missing fields, unknown keys and untrusted signatures. Keys come only
from the fixed Google HTTPS key server, with bounded I/O and at most 24-hour
cache lifetime. No configurable attacker-selected key URL or runtime fake key.

Grant processing checks the intent binding, expected test ad unit, valid provider
timestamp, unused/unexpired intent and unique provider transaction. Provider
reward amount/item never select the product reward: one verified completion
always means one episode. Recheck catalog eligibility, offer policy and consent
inside the transaction. Serialize with the account identity lock and profile /
intent row locks so deletion cannot recreate data. Store only minimal verified
transaction facts, not callback payloads or signatures. Duplicate verified
delivery converges on one grant; mismatches and competing transactions cannot
grant twice. Profile deletion cascades intents and their transaction references;
old callbacks cannot recover the deleted intent.

## Android slice

Add a small reward screen reachable from a locked player. P3-T08 owns the full
offer sheet; this task only supplies the opt-in and test-ad journey needed to
exercise P3-T07. Load the episode and server offer first. Show the episode title
and permanent unlock description before the explicit Watch test ad action.
Check account preference and UMP consent before SDK initialization; use delayed
app measurement and non-personalized test requests. No analytics SDK activation.
Use only Google's Android rewarded demo unit and demo app ID. Runtime production
configuration disables the flow; no live unit configuration is introduced.

The native adapter sets SSV options before loading/presenting. Reward-earned is
UI feedback only; dismiss/error paths may poll for an already verified callback.
Bound polling and permit status retry without another ad. Only server `granted`
permits navigation back through the existing playback authorization endpoint.
Cancel stale work when the session changes or screen unmounts. No local grant,
intent credentials or reward payloads in storage/logs.

## Verification and limits

Backend integration tests cover real ephemeral ECDSA signatures, forgery,
replay, owner/episode/unit/context mismatch, expiration, current rights/window /
takedown changes, consent withdrawal, deletion and actual PostgreSQL races.
Mobile tests cover disclosure/opt-in, delayed grant, no local grant, consent /
no-fill failure and session cancellation at the highest useful layer.

Google's shared demo ad unit cannot be configured with this project's callback
URL. A real Google callback needs an approved configured AdMob test integration
and reachable callback URL. Do not replace that acceptance evidence with a
synthetic signature or bypass consent. Attempt Android observation and record
unavailable provider/device checks as blockers. No live ads, licensed media,
paid services, private environment edits or automated impressions.

## Operations

Rewards default disabled. Explicit local test mode enables the real verifier
and test unit only; production rejects test mode. Migrations only add tables.
Rollback disables reward intake without removing existing entitlements. Public
release still requires D-020, D-025 and applicable legal/privacy/store approvals.
Do not log SSV query strings at Django, proxy or hosting ingress. Provider-side
processing/deletion and production retention remain release gates; local rows
are removed by P2-T02. Keep evidence synthetic and redact any device diagnostics.

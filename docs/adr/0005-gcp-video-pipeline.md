# ADR 0005: Bunny Stream Default HLS Delivery with GCP Cloud CDN Fallback

- **Status:** Accepted default 2026-08-24; **P2-T05 passed on Android under D-026** (2026-08-26 Pixel emulator using a temporary proof route later removed; see `docs/runbooks/playback-spike.md` and the COST_MODEL spike table). Bunny did **not** fail; GCP Cloud CDN fallback stays **unplugged**; D-014 was **not** reopened. iOS and licensed-content DRM are outside the MVP.
- **Date:** 2026-08-23
- **Updated:** 2026-08-28

## Context

Vertical episodes need adaptive playback and private access. Django must not serve video bytes. Free-tier-only delivery is unrealistic once users watch meaningful video. Assembling private GCS + Transcoder + Cloud CDN on GCP is workable but operationally heavy and, at expected MVP watch-hours, several times more expensive than a managed HLS product.

## Decision

**Default production path:** Bunny Stream. Staff upload a self-owned vertical master through Django Admin; Bunny encodes ABR HLS (for example 360p, 540p, and 720p), stores, and delivers from its CDN. Django authorizes playback after self-owned publication, takedown, and entitlement checks within the fixed France/Android MVP scope, then issues a short-lived Bunny token (or signed HLS URL). The mobile app plays that HLS URL in `expo-video`. The app never uses Bunny’s web player as a lock-in.

**Documented fallback:** private Cloud Storage source bucket → asynchronous Google Transcoder API → private HLS output bucket → Cloud CDN with short-lived signed prefix/cookie access. Activate this path only if Bunny fails P2-T05, a license/residency/support requirement forbids Bunny, measured reliability misses guardrails, or total cost is worse at measured volume.

Use a `VideoProvider` interface for job submission/status, asset metadata, takedown, and playback authorization. Postgres stores provider-agnostic asset IDs and readiness; it is not a file listing of CDN objects. Signed/tokenized URLs reduce casual sharing but are not DRM.

Do not operate both pipelines in production at once. Do not put Bunny video IDs in the mobile client except as opaque playback URLs returned by Django.

## Consequences

- CDN/transcoding remain variable costs in cohort contribution; model Bunny on GB (and optional DRM add-on), not GCP load-balancer floor, unless the fallback is active.
- Takedown is a Django action that must also delete or expire the asset at the active provider.
- P2-T05 spikes Bunny Stream on device (9:16 HLS, tokens, seek, captions, expiry, cost per source minute). P2-T05 on-device proof is Android per D-026; iOS native play is deferred to the iOS ship pass. A GCP CDN spike is in-scope only if Bunny fails or D-019 requires a different provider.
- Extra vendor DPA/subprocessors apply for Bunny (EU company). Confirm region and processing terms before licensed media.

## Reconsider when

Content contracts require Widevine/FairPlay or other certified DRM that Bunny cannot satisfy, playback quality misses guardrails, Bunny operational/ToS/residency constraints fail, or GCP Cloud CDN (or another managed DRM vendor) has better measured total cost.

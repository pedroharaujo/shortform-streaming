# ADR 0005: GCP HLS Video Pipeline Behind a Provider Boundary

- **Status:** Proposed; requires P2-T05 proof-of-concept and first-license DRM decision
- **Date:** 2026-08-23

## Context

Vertical episodes need adaptive playback and private access. Django must not serve video bytes. Free-tier-only delivery is unrealistic once users watch meaningful video.

## Decision

The proposed path is private Cloud Storage source bucket → asynchronous Google Transcoder API → private HLS output bucket → Cloud CDN with short-lived signed prefix/cookie access. Django issues authorization after rights, territory, publication, and entitlement checks.

Use a `VideoProvider` interface for job submission/status, asset metadata, takedown, and playback authorization. Signed URLs reduce casual sharing but are not DRM.

## Consequences

- CDN/transcoding are variable costs that belong in cohort contribution.
- Private-origin and signed-access configuration require security tests.
- An early device/network proof-of-concept must validate 9:16 HLS, captions, seeking, interruptions, and cost.

## Reconsider when

Content contracts require Widevine/FairPlay or other certified DRM, playback quality misses guardrails, operational load is too high, or a managed provider has better measured total cost.

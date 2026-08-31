# P3-T07-F1 native publisher test

**Scope update, 2026-08-31 (D-028):** Completed implementation/build/review work
satisfies P3-T07 development acceptance. The unchecked genuine provider journey
below transfers to release issue #98; it no longer blocks PR #97 or later MVP
coding. #96 is superseded. Setup still precedes any publisher-owned ad attempt.

The user asked to proceed after AdMob dashboard verification. Continue in the
existing P3-T07 branch/PR; no production activation or automatic merge.

## Constraints

- Use the user's development Android app/unit via process-only public build
  variables; commit only fictional examples, never their actual IDs or .env.
- Both IDs are required together, validated and from the same publisher.
  Overrides are local-only; defaults remain Google's demo IDs.
- Publisher-unit requests require an Android emulator, a development JS build,
  local environment, fresh UMP permission, explicit opt-in and a matching
  server-selected unit. Set emulator test-device configuration before SDK init.
- Unknown/physical devices, release builds, staging/production overrides,
  mismatched units or stale sessions fail before a publisher ad request.
- No client grant. Keep genuine Google signatures, expiry, unit bindings,
  idempotency and fresh playback authorization. No dashboard probe handler.
- Callback-only tunnel, no query capture, synthetic account and generated media,
  bounded supervised lifetime; stop services after the attempt. No paid services,
  staging ingress changes, private environment edits or provider-payload logs.

## Tasks

- [x] Add validated Expo config and runtime publisher-test safeguards, with
  regression-first tests at the configuration/SDK adapter boundaries. Review
  independently before any publisher ad request.
- [x] Prebuild/install Android; confirm embedded app ID and emulator identity.
  Prepare the isolated backend/Firebase emulator and generated playable media.
- [ ] Start a supervised callback-only test window and observe explicit opt-in,
  a native Test Ad, genuine Google delivery, one entitlement, and fresh authorized
  playback. If provider delivery is unavailable, keep acceptance incomplete and
  preserve the exact blocker without fabricating a grant.
  Attempted: UMP stopped preparation because the development app has no consent
  form configured. Post-failure observation: zero intents/grants/entitlements.
  Next requirement: approved app privacy-policy URL and an app-specific message.
- [x] Run relevant/full gates, review, record redacted evidence, stop services
  and update the draft PR. No automatic merge or production activation.

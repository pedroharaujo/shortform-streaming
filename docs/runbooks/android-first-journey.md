# First hands-on Android journey

**Decision:** D-036, founder approved 2026-09-13.
**Tasks:** P2-T08, P3-T03, P3-T04 and P3-T06.
**Tracking:** [issue #164](https://github.com/pedroharaujo/shortform-streaming/issues/164).

The next checkpoint is an app the founder can use: choose a series, watch a free
episode, sign in with Google, buy a test coin pack through Google Play, unlock the
next episode and keep watching. Reuse the existing services and screens. Ads and
advanced reporting follow this checkpoint; public-release requirements remain.

## What exists and what is missing

The Android catalog, native HLS player, progress/resume/autoplay, Google sign-in,
wallet and episode-unlock screens exist. Django Admin manages catalog and media.
PostgreSQL owns account, wallet and access records; Bunny delivers the video.

Store checkout is unfinished. The shipped checkout factory returns unavailable,
and the current server purchase registry and callback accept synthetic tests
only. Do not connect RevenueCat to that synthetic HMAC callback or present a
synthetic credit as evidence of a Google Play payment. Genuine provider
verification and interrupted-purchase recovery must accompany native checkout.

## Bring up the existing viewing experience

Engineering runs these commands from the repository root. Existing private local
configuration is required; never put its contents in Git or screenshots.

1. Start Docker Desktop, then `docker compose up -d --wait postgres`.
2. With the local `.env` pointing at the local database, run
   `uv run --env-file .env python backend/manage.py migrate` and then
   `uv run --env-file .env python backend/manage.py runserver 127.0.0.1:8000`.
3. Start `firebase emulators:start --only auth --project <local-firebase-project>`
   using the same non-production project as the app and backend. The backend
   uses `FIREBASE_AUTH_MODE=admin` and
   `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`; keep the Auth emulator on loopback.
4. Run `pnpm mobile:android` after `uv run python scripts/start_android_avd.py`.
   The existing Android emulator configuration uses `http://10.0.2.2:8000` for
   the backend and `http://10.0.2.2:9099` for local authentication.
5. Inspect the existing catalog before running any seed command. For the playable
   check, create a separate generated test series and episodes in Django Admin,
   then use its existing upload/processing workflow with generated or approved
   self-owned video in the non-production Bunny library. Publish only when the
   media and eligibility checks pass. Do not reset existing titles or uploads.
   `seed_catalog` is only a metadata fixture: its fake URLs are **not playable
   media**, and its READY fake assets prevent uploading another master into those
   episodes. Keep that fixture separate from the playable test series. Repeat
   seeding now preserves existing operator edits and media rather than replacing
   them.

If the emulator is listed as unauthorized, approve its debugging connection in
the emulator and confirm `adb devices` reports `device`. A physical USB phone
needs explicit connection setup; it cannot use the emulator-only `10.0.2.2`
addresses as-is. Do not open the local database or Auth emulator to the LAN.

## Finish genuine test checkout

Engineering owns the native RevenueCat adapter, server verification and recovery
integration, checkout screen, account binding, once-only credit, and return to
the locked episode. Preserve server-owned balances and fresh playback
authorization. Do not add another synthetic-only checkout surface.

External setup requires the non-production Google Play/RevenueCat app connection,
a test consumable product and a Google Play license tester. Confirm their status
with the founder and configure sensitive values privately. A synthetic fixture
quantity is not an approved commercial pack or price. Real purchases remain
disabled pending the existing commercial and release approvals.

## Acceptance on Android

Record device/build and safe outcomes only. Never capture account details,
credentials, signed media URLs, provider payloads or licensed frames as evidence.
The full checkpoint remains incomplete until the genuine test checkout works.

- [ ] Browse the prepared series and actually play a free episode.
- [ ] Resume mid-episode and continue to the next free episode.
- [ ] Sign in with Google and return to the selected locked episode.
- [ ] Display a Google Play test product with the store-provided price.
- [ ] Complete a license-tester purchase and observe verified server coin credit.
- [ ] Spend coins once, authorize again, and play the unlocked episode.
- [ ] Cancel or interrupt checkout without duplicate charges or coin credits;
      recover a completed purchase after restarting the app.
- [ ] Keep an unlocked episode available to the same account after sign-in;
      prevent access by another account or after a content takedown.

Automated authorization and financial-integrity tests remain required before
merge. Device/provider observations stay unchecked until observed, following
D-029; none of the steps above is evidence of public-release readiness.

## Local observation, 2026-09-13

PostgreSQL is healthy, existing migrations were applied, the backend readiness
and catalog endpoints returned HTTP 200, and the local Firebase Auth emulator
started. Two newly generated 12-second test animations were prepared; their
uploads failed and their local series remains unpublished. Bunny rejected a
read-only metadata request with HTTP 401. Verify the matching Stream library ID
and API key in private local configuration before retrying. Do not publish the
failed assets or change older titles' approval state to bypass this blocker.

This is startup evidence only; the device and genuine-purchase checklist above
remains unchecked.

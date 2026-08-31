# P3-T07-F1 callback test implementation plan

**Goal:** Prepare and expose a temporary callback-only test endpoint under #96.
**Architecture:** Loopback bridge to existing verifier and synthetic PostgreSQL;
HTTPS tunnel with verified query privacy. Staging and production remain unchanged.
**Tech stack:** Python standard library, existing Django verifier and pytest, ngrok.

## Constraints

Follow the approved callback-test design. No extra worktree, trust-key override,
raw callback retention, real user data, paid service or automatic merge.

## Tasks

- [x] Add `backend/tests/advertising/test_callback_bridge.py` network-boundary
  tests: exact signed query survives, headers/bodies do not leak, malformed or
  unauthorized routes/methods/bodies fail closed, transport failure is generic,
  bounds and expiration stop intake. Run `uv run pytest
  backend/tests/advertising/test_callback_bridge.py` before implementation.
- [x] Implement `backend/config/reward_callback_bridge.py`: fixed loopback target,
  bounded HTTP server, no request logging, empty responses, one-hour deadline.
- [x] Add publisher-unit regression to `test_callbacks.py`, observe failure,
  then configure unit in local settings and use it for intent/grant binding.
  Production rejects the override. Keep schema unchanged.
- [x] Run bridge tests, all advertising/backend tests, lint, formatting, typing,
  migration drift and contract checks. Independently review boundary code and
  address findings. Record exact results in the rewarded-ads runbook.
- [x] Verify tunnel cloud/local query capture controls, then start only the
  bridge endpoint. Probe forbidden paths and unsigned callback without real
  bindings. Provide the user the live URL and fresh synthetic verification
  fields only when all safeguards are verified. Otherwise report the specific
  remaining configuration blocker and leave public forwarding stopped.

Execution is inline with independent security review; user already approved
the endpoint and routine implementation choices require no further pause.

Validation complete: full pnpm check passed; independent review findings fixed.
Live callback intake rejects unsigned requests; the user receives the URL for
manual AdMob setup next. Genuine Google and native playback evidence remain open.

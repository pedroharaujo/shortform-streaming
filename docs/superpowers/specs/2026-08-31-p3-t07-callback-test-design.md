# P3-T07-F1 temporary callback test

The user approved a temporary public callback-only endpoint on 2026-08-31.
This extends the earlier local-only test authorization, not production activation.

Use a short-lived HTTPS tunnel to a loopback bridge, never directly to Django.
The bridge forwards only GET `/v1/rewards/admob/ssv`, preserving the raw query,
to the dedicated local synthetic backend. Reject other paths/methods, request
bodies and oversized requests; limit concurrency, request rate and lifetime.
Do not forward caller headers, backend bodies, redirects or debug responses.
Return only an empty status response with no-store. Record aggregate status
counts only, never request paths, queries, headers, signatures or bindings.

Enable publisher-owned ad-unit configuration only in explicit local test mode;
keep Google's demo unit as the default and production disabled. The backend
must bind each intent and verified callback to the configured unit. Existing
signature, eligibility, identity, expiry and idempotency checks stay intact.
Mobile publisher-ID configuration and a native rebuild follow dashboard callback
verification; no requests using the publisher's unit precede emulator safeguards.

Before public activation, verify tunnel account capture/export settings prevent
callback-query retention. Local `--inspect=false` alone is insufficient evidence
about cloud logging. Use harmless markers to check the deployed boundary first.
If this cannot be established, do not route real callbacks through the tunnel.
Do not change staging ingress, buy services, edit private .env, or deploy production.

The initial plan used a fresh synthetic intent for dashboard verification.
During the authorized setup, Google's signed dashboard request instead supplied
a placeholder unit, so the normal configured-unit check correctly rejected it.
For this supervised session, replace that assumption with a separate expiring
setup challenge in the temporary local launcher: verify Google's signature,
both fresh random bindings, the placeholder unit and timestamp/expiry, then
acknowledge delivery without creating an intent or calling the grant service.
The launcher is restricted to the dedicated local database, DEBUG/test mode,
and the original supervisor deadline. Other requests keep the original handler.
Remove this session-only handler and restore the normal backend after saving
the verified URL. Never add placeholder units to the reward allowlist or turn
a dashboard probe into an entitlement. This does not enable production rewards.
Dashboard callbacks are setup evidence only; the PR remains draft until a real
native test ad, verified callback, entitlement and playback are observed together.
Stop the task-owned bridge/tunnel after testing, and expire the bridge automatically
within one hour even if the session is interrupted.

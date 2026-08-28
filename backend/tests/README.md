# Backend tests

Pytest is configured in the root `pyproject.toml` (`testpaths = ["backend/tests"]`).
The health tests prove liveness does not touch the database (with or without a
Bearer token), readiness succeeds against PostgreSQL without creating a profile,
and database failures are returned as a non-sensitive HTTP 503. Production
configuration fails fast on missing required values, non-PostgreSQL URLs, mock
Firebase, and the fake video provider. OpenAPI tests prove shared contract
components, the Firebase bearer scheme, unauthenticated catalog and optional-Firebase
playback authorize and progress operations, authenticated `GET /v1/me` without
`firebase_uid`, progress schemas without `playback_url`, and ErrorEnvelope status
mapping.

Accounts tests under `backend/tests/accounts/` cover missing and malformed
authorization, expired tokens, ignored client-supplied user IDs, idempotent
profile creation without exposing `firebase_uid`, and fail-closed admin
verification (missing project id, initialize failure, expired/revoked/malformed
mapping, and uid return).

Catalog tests under `backend/tests/catalog/` cover invalid rights windows, empty
allowlists, publish-without-English and publish-without-valid-right, takedown
rights that do not satisfy publish, opaque public ids, two-territory FR/DE
eligibility, hidden unpublished/expired/future/takedown/wrong-platform/
wrong-language titles, malformed catalog headers (400 ErrorEnvelope), ineligible
public ids (404 not 403), omitted database ids and contract secrets, ignored
Accept-Language, anonymous catalog reads, and takedown hiding an episode.
Builders construct synthetic data in tests; they do not depend on `seed_catalog`.

Repository-level tests remain under `tests/repository/`.

See the Testing policy in `CONTRIBUTING.md`: prefer one test at the highest
level that would catch the bug, and keep this suite's auth, eligibility,
playback authorize, production settings, progress, and OpenAPI coverage.

# Backend tests

Pytest is configured in the root `pyproject.toml` (`testpaths = ["backend/tests"]`).
The health tests prove liveness does not touch the database, readiness succeeds
against PostgreSQL, database failures are returned as a non-sensitive HTTP 503, and
production configuration fails fast. OpenAPI tests prove shared contract
components, the Firebase bearer scheme, unauthenticated health and catalog
operations, authenticated `GET /v1/me`, and that health JSON matches the
`HealthStatus` schema.

Accounts tests under `backend/tests/accounts/` cover missing, malformed, expired,
and revoked tokens, ignored client-supplied user IDs, idempotent and concurrent
profile creation, and mock versus fail-closed admin verification.

Catalog tests under `backend/tests/catalog/` cover rights-window and publish
validation, duplicate episode order, Django Admin staff access versus anonymous
denial, two-territory FR/DE eligibility, hidden unpublished/expired/future/
takedown/wrong-platform/wrong-language titles, malformed catalog headers (400
ErrorEnvelope), ineligible public ids (404 not 403), and frozen-clock window
boundaries. Builders construct synthetic data in tests; they do not depend on
`seed_catalog`.

Repository-level tests remain under `tests/repository/`.

See the Testing policy in `CONTRIBUTING.md`: prefer one test at the highest
level that would catch the bug, and keep this suite's auth, eligibility,
playback authorize, production settings, and OpenAPI coverage.

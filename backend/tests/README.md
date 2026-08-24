# Backend tests

Pytest is configured in the root `pyproject.toml`. The health tests prove liveness does not
touch the database, readiness succeeds against PostgreSQL, database failures are returned
as a non-sensitive HTTP 503, and production configuration fails fast. OpenAPI tests prove
shared contract components, the Firebase bearer scheme, unauthenticated health operations,
and that health JSON matches the `HealthStatus` schema. Repository-level tests remain
under `tests/repository/`.

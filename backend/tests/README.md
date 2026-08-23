# Backend tests

Pytest is configured in the root `pyproject.toml`. The health tests prove liveness does not
touch the database, readiness succeeds against PostgreSQL, database failures are returned
as a non-sensitive HTTP 503, and production configuration fails fast. Repository-level
tests remain under `tests/repository/`.

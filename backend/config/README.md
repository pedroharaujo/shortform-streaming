# Backend configuration

`settings/base.py` contains shared Django/DRF, PostgreSQL, OpenAPI, and Django Admin
configuration (sessions, messages, staticfiles, templates). Local Admin is served
by `runserver` when `DEBUG` is true; production collectstatic is owned by P5-T02.
`spectacular.py` holds `drf-spectacular` settings and shared schema components.
Health and anonymous catalog operations are forced to `security: []`.
`exceptions.py` maps API errors onto the shared `ErrorEnvelope` (`code`, `message`,
`request_id` from `X-Request-ID` or a generated UUID, optional `field_errors`).
`settings/local.py` supplies safe loopback-only development defaults.
`settings/production.py` requires explicit secret, host, and database configuration and
enables Django's deployment security controls.

OpenAPI is generated with `pnpm contract:generate` (no Swagger UI and no staticfiles).
Schema generation parses `DATABASE_URL` but does not need a live database.

ASGI and WSGI default to production settings so a deployment cannot silently inherit
development defaults. `manage.py` defaults to local settings for documented developer
commands.

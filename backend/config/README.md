# Backend configuration

`settings/base.py` contains shared Django/DRF, PostgreSQL, OpenAPI, and Django Admin
configuration (sessions, messages, staticfiles, templates). WhiteNoise is inserted
immediately after `SecurityMiddleware` and `STORAGES["staticfiles"]` uses
`CompressedStaticFilesStorage`. `CONN_MAX_AGE` is an env integer defaulting to 0
(0–3600) with `conn_health_checks=True`. Local Admin is served by `runserver` when
`DEBUG` is true. The production image runs `collectstatic` with
`config.settings.staticbuild` (placeholders only; no production fail-fast) and
serves Admin static files through WhiteNoise. See
[docs/runbooks/django-container.md](../../docs/runbooks/django-container.md).
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

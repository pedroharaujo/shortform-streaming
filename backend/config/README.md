# Backend configuration

`settings/base.py` contains shared Django/DRF, PostgreSQL, and OpenAPI configuration.
`spectacular.py` holds `drf-spectacular` settings and shared schema components.
`settings/local.py` supplies safe loopback-only development defaults.
`settings/production.py` requires explicit secret, host, and database configuration and
enables Django's deployment security controls.

OpenAPI is generated with `pnpm contract:generate` (no Swagger UI and no staticfiles).
Schema generation parses `DATABASE_URL` but does not need a live database.

ASGI and WSGI default to production settings so a deployment cannot silently inherit
development defaults. `manage.py` defaults to local settings for documented developer
commands.

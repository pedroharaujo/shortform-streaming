# Backend configuration

`settings/base.py` contains shared Django/DRF and PostgreSQL configuration.
`settings/local.py` supplies safe loopback-only development defaults.
`settings/production.py` requires explicit secret, host, and database configuration and
enables Django's deployment security controls.

ASGI and WSGI default to production settings so a deployment cannot silently inherit
development defaults. `manage.py` defaults to local settings for documented developer
commands.

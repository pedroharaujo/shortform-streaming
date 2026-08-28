# Django container (P5-T02)

Issue: [#77](https://github.com/pedroharaujo/shortform-streaming/issues/77). This runbook is the local image and migration-vs-web contract. Live staging deploy, Artifact Registry push, Cloud Run traffic, and “deploy a backward-compatible migration and rollback a revision” are **deferred to P5-T03**. Do not treat a successful local Compose run as a Cloud Run deploy.

## Build

From the repository root, with no production secrets in the environment or build args:

```shell
docker build -f backend/Dockerfile -t shortform-backend:ci .
```

The GitHub Application CI **Container** job runs that exact command string only. It does **not** run Compose or `scripts/verify_backend_container.sh`. The image is multi-stage (`python:3.14-slim-bookworm` + pinned uv `0.9.28`), non-root (`USER app`, uid/gid 1000), and does not `docker push`.

Confirm the image user and that secret names are not baked into `Env`:

```shell
docker inspect --format '{{.Config.User}} {{json .Config.Env}}' shortform-backend:ci
```

`web` without production process env must fail closed (`ImproperlyConfigured`):

```shell
docker run --rm shortform-backend:ci web
```

## No secrets in image layers

- The Dockerfile never `ENV`s `DJANGO_SECRET_KEY`, `DATABASE_URL`, or `FIREBASE_PROJECT_ID`.
- Build-time `collectstatic` uses `DJANGO_SETTINGS_MODULE=config.settings.staticbuild` only. That module setdefaults placeholders in Python and does **not** import `config.settings.production` (no SSL/Firebase/Bunny fail-fast).
- Runtime still uses `config.wsgi` → production settings, injected at **process start** (Compose, Cloud Run, or the entrypoint default `DJANGO_SETTINGS_MODULE=config.settings.production`).
- Do not put placeholders on `ENV` or `RUN KEY=...` for secrets; they would appear in `docker history`.

Console scripts such as gunicorn are created with shebangs that point at the
venv path. The builder sets `UV_PROJECT_ENVIRONMENT=/app/.venv` so those
shebangs remain valid after the venv is copied into the runtime image.

Default `CMD ["web"]` runs gunicorn only. It never migrates.

The shell entrypoint expands `$PORT` (a JSON-array `CMD` cannot). Defaults:

- `--bind 0.0.0.0:${PORT:-8080}`
- `--workers ${GUNICORN_WORKERS:-2}`
- `--threads ${GUNICORN_THREADS:-4}`
- `--timeout ${GUNICORN_TIMEOUT:-30}` (rejected if `0` or non-integer)
- `--graceful-timeout 30`
- `--keep-alive 5`
- `--access-logfile -` / `--error-logfile -`
- `--worker-tmp-dir /dev/shm`
- no `--preload`

Other argv (`python manage.py ...`) is passed through with `exec`.

## collectstatic and Admin static files

The runtime stage runs:

```text
DJANGO_SETTINGS_MODULE=config.settings.staticbuild python manage.py collectstatic --noinput --skip-checks
```

WhiteNoise (`CompressedStaticFilesStorage`, not Manifest) is installed immediately after `SecurityMiddleware` and serves `/static/` from `STATIC_ROOT`. Local `runserver` with `DEBUG` is unchanged.

## Migrations vs web

| Entrypoint | Command | Behavior |
| --- | --- | --- |
| `web` (default) | gunicorn | Request process only. **Never** `migrate`. |
| `migrate` | `python manage.py migrate --noinput` | Apply migrations, then exit. |

Compose serializes them: `migrate` waits for healthy Postgres; `api` waits for `migrate` `service_completed_successfully`. Do not fold migrate into the Cloud Run request process.

`docker compose up -d --wait postgres` (no profile) is unchanged for the local `runserver` bootstrap.

## Compose local evidence

Production settings with **explicit dummy** values in `compose.yaml` (not `.env.example`, which sets `VIDEO_PROVIDER=fake`). `DJANGO_SECRET_KEY` is the scanner-safe public literal `local-compose-not-a-production-secret` (same class of dummy as `replace-with-provider-value`; not a production secret). Leave `VIDEO_PROVIDER` and `STAFF_UPLOAD_STORE` unset. Publish `127.0.0.1:8080:8080`.

Production enables `SECURE_SSL_REDIRECT`. Host curls and probes must send `X-Forwarded-Proto: https` and a matching `Host` (`127.0.0.1` or `localhost`). Do not add a production flag to disable SSL redirect.

```shell
docker build -f backend/Dockerfile -t shortform-backend:ci .
docker compose --profile container up -d --wait
scripts/verify_backend_container.sh
```

The verify script is **local** (and optional operator) evidence. It checks live/ready JSON, Admin login HTML, Admin CSS, Postgres stop/start recovery (ready 503 / live 200, then ready 200), and `docker stop` on `api` within the gunicorn graceful window. It tears down Compose on success or failure. It requires `shortform-backend:ci` already built.

Do not claim the GitHub Container job ran Compose. Wiring `scripts/verify_backend_container.sh` into Application CI is deferred until that change does not ALWAYS_RUN the Mobile job (editing `.github/workflows/application-ci.yml` or `scripts/ci_path_filters.py` retriggers Mobile) or until expo pins are current (P2-T08 / P5-T03).

## Readiness (unchanged views)

`/health/live` is process-only. `/health/ready` runs a bounded `SELECT 1`. This slice does not add a migrations query to `ReadyView` (OpenAPI owned by P2-T08 / #78).

Migrations-before-traffic is enforced by the **release contract** (run `migrate` to completion, then start `web`), not by changing the ready payload.

## Cloud Run probe mapping (P5-T03)

Do not edit `infra/**` here. When P5-T03 wires Cloud Run:

- Startup/readiness: HTTP GET `/health/ready` with `X-Forwarded-Proto: https` and the service Host.
- Liveness: HTTP GET `/health/live` with the same forwarded proto (do not require Postgres).
- Run `migrate` as a **separate** release step (Cloud Run Job or equivalent) against the same image tag/digest **before** shifting request traffic to a new `web` revision.
- Inject production secrets at process start (Secret Manager), never as image `ENV`.
- Optional operator override: `CONN_MAX_AGE=60` (see below). Default remains `0`.

## Connection pooling

`CONN_MAX_AGE` is an env integer defaulting to `0` (range 0–3600) with `conn_health_checks=True`. Cloud Run plus Cloud SQL typically wants a short persistent age such as `60` so each instance reuses connections without holding them for the process lifetime. Keep the default `0` unless the operator sets the override.

## Image scan

Scan-ready: run a local scanner against the built tag when the tool is installed, for example:

```shell
trivy image --severity HIGH,CRITICAL shortform-backend:ci
```

This repository does not add a paid SaaS scanner or an unpinned `aquasecurity/trivy-action`. Absence of Trivy on a developer machine is not a pass for HIGH/CRITICAL findings; record that the command was unavailable. P5-T03/P5-T05 may attach scanning to deploy CI later.

## Deferred to P5-T03

- Workload Identity Federation and Artifact Registry push
- Staging Cloud Run deploy of this image
- Deploying a backward-compatible migration and rolling back a revision without schema corruption
- Production approval gates
- `tofu apply` and edits under `infra/**`
- Wiring `scripts/verify_backend_container.sh` into the Application CI Container job (that edit ALWAYS_RUNs Mobile; expo pins are owned by P2-T08)

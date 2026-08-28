# Shortform Streaming

Public monorepo for a mobile-first vertical microdrama streaming platform.

The MVP consists of a Django REST backend/Django Admin and one React Native/Expo application for iOS and Android. A consumer web client is explicitly post-MVP.

## Local backend bootstrap

P1-T02 provides a runnable Django 6.1 backend and local PostgreSQL. Install Git,
Python 3.12–3.14, [uv](https://docs.astral.sh/uv/), pnpm, and Docker with Compose, then
run:

```shell
git clone https://github.com/pedroharaujo/shortform-streaming.git
cd shortform-streaming
uv sync --locked
docker compose up -d --wait postgres
uv run python backend/manage.py migrate
uv run python backend/manage.py runserver 127.0.0.1:8000
```

The local settings use the safe development defaults shown in `.env.example`; copying
that file is optional. The local container uses PostgreSQL's passwordless `trust` mode,
but its port is bound only to `127.0.0.1`, never every host interface. Do not reuse this
authentication mode outside local development. If port 5432 is occupied, choose another
loopback port in a local `.env`, update `DATABASE_URL` to match, and add
`--env-file .env` immediately after `uv run` in the Django commands below.

Confirm the service in another terminal:

```shell
curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready
```

Both return `{"status":"ok"}` with HTTP 200 while PostgreSQL is available. Liveness is
process-only. Readiness performs a bounded `SELECT 1` and returns HTTP 503 with the
non-sensitive payload `{"status":"unavailable"}` if PostgreSQL cannot be reached.
Stop local services without deleting their named data volume with `docker compose down`.

Staff catalog management uses Django Admin at `http://127.0.0.1:8000/admin/` (local
`DEBUG` + `runserver`; the production image collects Admin static files — see
[docs/runbooks/django-container.md](./docs/runbooks/django-container.md)). Create a staff user and
optional synthetic FR/DE titles (generated metadata only):

```shell
uv run python backend/manage.py createsuperuser
uv run python backend/manage.py seed_catalog
uv run python backend/manage.py spike_bunny_playback
```

`spike_bunny_playback` generates 9:16 test media and uploads it through
`VideoProvider`. It no-ops with a clear error when `VIDEO_PROVIDER` is `fake` or
Bunny credentials are missing (that is not a Bunny failure). See
[docs/runbooks/playback-spike.md](./docs/runbooks/playback-spike.md). Never
commit keys or paste signed URLs.

Anonymous catalog reads require explicit `X-Territory` (ISO 3166-1 alpha-2),
`X-Platform` (`ios` or `android`), and `X-Language` (ISO 639-1, MVP `en`) headers.
Those values are never inferred from `Accept-Language`.

```shell
curl -sS -H "X-Territory: FR" -H "X-Platform: ios" -H "X-Language: en" \
  http://127.0.0.1:8000/v1/catalog/home
```

Local Django accepts `10.0.2.2` as a host so an Android emulator can reach this server
through that alias. Keep `runserver` on `127.0.0.1:8000`; the emulator still maps
`10.0.2.2` to the host loopback.

Run the dependency-free repository safety gate separately:

```shell
python scripts/check_repository_foundation.py
```

## Architecture and repository layout

The target is a modular monorepo with independently deployable backend, mobile, and infrastructure layers:

```text
mobile (Expo) ---- HTTPS ---- backend (Django/DRF) ---- PostgreSQL
      |                              |
      +---- mobile providers         +---- private media authorization
```

- `backend/` contains the Django/DRF modular monolith, split settings, and backend tests.
- `mobile/` contains the Expo/React Native development-client application (P1-T03).
- `packages/api-client/` contains the OpenAPI-generated TypeScript client (P1-T04).
- `infra/` holds environment and reusable infrastructure definitions when provisioning begins.
- `docs/` contains product decisions, ADRs, contracts, analytics references, and runbooks.
- `scripts/` and `tests/repository/` contain repository-wide deterministic checks.

Later tasks add the domain applications and cloud infrastructure.

## Common commands

Install exactly the dependency versions committed in `uv.lock`:

```shell
uv sync --locked
```

Run all backend checks (PostgreSQL must be running for the test suite):

```shell
pnpm backend:check
```

CI collects a coverage report without a failing floor. Reproduce that locally with:

```shell
pnpm backend:test:coverage
```

Build the backend image (no registry login or push). Application CI Container
runs only this build command. Compose and `scripts/verify_backend_container.sh`
are **local** evidence (dummy production values in `compose.yaml`; do not use
`.env.example` for that profile). Wiring the verify script into Application CI
is deferred so it does not ALWAYS_RUN Mobile (P2-T08 / P5-T03):

```shell
docker build -f backend/Dockerfile -t shortform-backend:ci .
docker compose --profile container up -d --wait
scripts/verify_backend_container.sh
```

See [docs/runbooks/django-container.md](./docs/runbooks/django-container.md). Live
staging deploy remains P5-T03.

Regenerate the OpenAPI document and TypeScript client, then fail if git shows drift:

```shell
pnpm contract:generate
pnpm contract:check
```

Run the current repository-wide aggregate gate with `pnpm check` (includes `contract:check`).

## Local mobile bootstrap

P1-T03 provides a strict TypeScript Expo app with Expo Router, an Android/iOS
development-build configuration (not Expo Go), and a backend-availability screen.
P2-T04 makes Home the launch route (`app/index.tsx`) and keeps health at `/health`.
Details, including the emulator sequence, are in [mobile/README.md](./mobile/README.md).

`EXPO_PUBLIC_*` values are compiled into the public JavaScript bundle. Never place a
secret, key, token, or credential in `EXPO_PUBLIC_API_ENVIRONMENT`,
`EXPO_PUBLIC_API_BASE_URL`, or `EXPO_PUBLIC_CATALOG_TERRITORY`. Copy those three
names from `.env.example` into `mobile/.env` (gitignored). All three are required;
the app does not default an environment or infer territory from device locale.

Use `http://10.0.2.2:8000` as `EXPO_PUBLIC_API_BASE_URL` on the Android emulator and
`http://127.0.0.1:8000` on the iOS simulator. Set `EXPO_PUBLIC_CATALOG_TERRITORY=FR`
for the synthetic FR-only Harbor Lights seed.

From the repository root (`export PATH="$HOME/.local/bin:$PATH"` if `pnpm` is the
corepack shim):

```shell
pnpm install
pnpm mobile:lint
pnpm mobile:format:check
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:config:check
pnpm mobile:bundle:check
```

`pnpm mobile:bundle:check` runs `expo export` for Android and iOS JavaScript bundles using the same public `EXPO_PUBLIC_*` fixtures as the config check. It does not compile native apps or invoke EAS.

The first Android development client is `pnpm --filter @shortform/mobile android`
with the emulator already running. P1-T03 did **not** execute that emulator path;
record it as an **omission**, not a pass.

Run backend checks independently:

```shell
pnpm backend:lint
pnpm backend:format:check
pnpm backend:typecheck
pnpm backend:migrations:check
pnpm backend:test
```

Run the complete repository-foundation gate:

```shell
python scripts/check_repository_foundation.py
```

Run its components independently:

```shell
python scripts/scan_secrets.py
python -m unittest discover -s tests/repository -p "test_*.py"
python scripts/validate_ai_governance.py
git diff --check
```

Before pushing a branch, scan every blob introduced since the branch point, including files that were added and later removed:

```shell
git fetch origin main
python scripts/scan_secrets.py --history-range origin/main..HEAD
```

History scanning requires a complete, non-shallow checkout and fails closed when either endpoint is unavailable. CI fetches complete history and supplies the exact pull-request or push range automatically. An all-zero base is treated as an initial branch and scans every commit reachable from its head.

Contract and infrastructure commands become available only when their owning bootstrap
tasks commit working implementations. An unavailable required check is a blocker, never
a pass.

## Production configuration

Start production entry points with `DJANGO_SETTINGS_MODULE=config.settings.production`.
Production settings fail immediately unless all of these values are non-empty:

- `DJANGO_SECRET_KEY`: a strong, externally managed secret;
- `DJANGO_ALLOWED_HOSTS`: comma-separated API hostnames;
- `DATABASE_URL`: a standard PostgreSQL connection URL.

`DATABASE_CONNECT_TIMEOUT` defaults to two seconds so readiness does not hang on an
unreachable database and accepts only an integer from 1 through 10. `CONN_MAX_AGE`
defaults to 0 (a connection per request) and accepts only an integer from 0 through
3600; operators may set `CONN_MAX_AGE=60` on Cloud Run. SQLite, MySQL, and
other database engines are rejected in every environment. Production enables HTTPS
redirect, secure cookies, proxy HTTPS handling, HSTS, and related Django deployment
protections. Do not reuse the local example values or commit a populated `.env`.

## Project status

Implementation has started with Phase 0 product, rights, compliance, architecture, and cost gates. The founder-approved MVP launch scope is the 21 EU countries using EUR listed canonically in decision D-001. The MVP interface and initial microdrama catalog are in English. The ads-only MVP has no IAP; store-localized price strings apply when P7 IAP ships. EUR is the company's base reporting currency and desired store-settlement currency for that later IAP path.

Phase 1 engineering may proceed without company-registration or store-account data. Development and automated tests use only short self-owned, generated, or purpose-made test media and local/emulated/provider-fake integrations; real licensed media and production credentials are not required.

The approved geographic scope is not final launch clearance. Territorial content rights, GDPR/privacy, per-market legal and language review, age/content controls, store compliance, incorporation and registration details of the intended French entity, and AdMob production configuration remain mandatory **ads-only** release gates. Store IAP EUR-compatible Apple/Google payment-profile and bank configuration is required before P7 IAP, not before ads-only launch. No public distribution or real advertising may be enabled before ads-only clearance. Real purchase or subscription flows wait for P7.

## Source of truth

- [Complete product and implementation plan](./MICRODRAMA_IMPLEMENTATION_PLAN.md)
- [MVP product brief](./docs/product/MVP_PRODUCT_BRIEF.md)
- [Decision register](./docs/product/DECISION_REGISTER.md)
- [Content-rights checklist](./docs/product/CONTENT_RIGHTS_CHECKLIST.md)
- [Store and privacy compliance matrix](./docs/product/STORE_COMPLIANCE_MATRIX.md)
- [Unit-cost model](./docs/product/COST_MODEL.md)
- [Architecture decision records](./docs/adr/)
- [AI-native development workflow](./docs/AI_DEVELOPMENT.md)

## Repository safety

This repository is public. Never commit secrets, real `.env` files, licensed video or artwork, confidential contracts/rates, provider payloads, production data, personal data, store credentials, or signing material.

Keep private inputs under a root holding location such as `/sources/`, `/licensed-media/`, `/contracts/`, `/credentials/`, or `/private/`. These names are anchored to the repository root so legitimate nested source modules such as `backend/apps/media/` remain trackable. Ignore rules are only the first barrier: the repository gate also rejects prohibited tracked delivery media, even after `git add --force`.

The scanner reports only a rule and repository-relative location, never the detected value. It accepts UTF-8 and BOM-marked UTF-16 text, rejects symlinks and unsupported/binary encodings, and fails closed above the explicit 2 MiB per-file limit. P1-T01 has no media-fixture allowlist; a later task must document provenance and add a narrow generated/self-owned fixture prefix before committing any test media.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and the [repository controls runbook](./docs/runbooks/repository-controls.md) before making changes.

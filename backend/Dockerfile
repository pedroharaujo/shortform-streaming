# Production Cloud Run image (P5-T02 / #77). Deterministic, non-root, no
# build secrets. Runtime production settings are injected at process start.
# Build: docker build -f backend/Dockerfile -t shortform-backend:ci .
# This file never imports production Django settings and never bakes
# credentials into layers.

FROM python:3.14-alpine3.24 AS builder

COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /bin/uv

WORKDIR /src
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY backend ./backend

FROM python:3.14-alpine3.24 AS runtime

# Runtime uses the locked venv. Remove unused installers and their vendored
# dependencies; apply the available libuuid security fix from this Alpine series.
RUN apk upgrade --no-cache libuuid \
    && python -m pip uninstall --yes pip \
    && python -c "import shutil,sysconfig; shutil.rmtree(sysconfig.get_path('stdlib') + '/ensurepip')"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /src/backend /app/backend

WORKDIR /app/backend

RUN DJANGO_SETTINGS_MODULE=config.settings.staticbuild \
    python manage.py collectstatic --noinput --skip-checks \
    && chmod +x /app/backend/docker-entrypoint.sh \
    && addgroup -g 1000 app \
    && adduser -u 1000 -G app -h /app -D -H app \
    && chown -R app:app /app

USER app
ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]
CMD ["web"]

# Production Cloud Run image (P5-T02 / #77). Deterministic, non-root, no
# build secrets. Runtime production settings are injected at process start.
# Build: docker build -f backend/Dockerfile -t shortform-backend:ci .
# This file never imports production Django settings and never bakes
# credentials into layers.

FROM python:3.14-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /bin/uv

WORKDIR /src
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY backend ./backend

FROM python:3.14-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=builder /src/.venv /app/.venv
COPY --from=builder /src/backend /app/backend

WORKDIR /app/backend

RUN DJANGO_SETTINGS_MODULE=config.settings.staticbuild \
    python manage.py collectstatic --noinput --skip-checks \
    && chmod +x /app/backend/docker-entrypoint.sh \
    && groupadd --gid 1000 app \
    && useradd --uid 1000 --gid 1000 --home-dir /app --no-create-home app \
    && chown -R app:app /app

USER app
ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]
CMD ["web"]

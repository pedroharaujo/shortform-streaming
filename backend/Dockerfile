# CI smoke image only. P5-T02 owns production hardening (non-root user,
# image scanning, static files, and runtime process shape).
# Build must succeed without production secrets: this file never imports
# production Django settings and never bakes credentials into layers.

FROM python:3.13-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /bin/uv

WORKDIR /src
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY backend ./backend

FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=builder /src/.venv /app/.venv
COPY --from=builder /src/backend /app/backend

# Runtime production settings still require env at process start. The default
# command only proves the interpreter and Django import work without secrets.
WORKDIR /app/backend
CMD ["python", "-c", "import django; print(django.get_version())"]

#!/bin/sh
set -eu

# Container defaults to production settings at process start. Compose and Cloud
# Run still inject secrets via the process environment; this image never bakes
# them in. manage.py defaults to local settings on a developer host, so export
# here so `migrate` cannot silently inherit those development defaults.
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.production}"

run_web() {
  timeout="${GUNICORN_TIMEOUT:-30}"
  case "$timeout" in
    '' | *[!0-9]*)
      echo "GUNICORN_TIMEOUT must be a positive integer" >&2
      exit 1
      ;;
  esac
  if [ "$timeout" -lt 1 ]; then
    echo "GUNICORN_TIMEOUT must be >= 1 (never 0)" >&2
    exit 1
  fi

  # Expand PORT in the shell. A JSON-array CMD cannot expand environment values.
  # Do not run migrations here. Do not preload workers.
  exec gunicorn \
    --bind "0.0.0.0:${PORT:-8080}" \
    --workers "${GUNICORN_WORKERS:-2}" \
    --threads "${GUNICORN_THREADS:-4}" \
    --timeout "$timeout" \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile - \
    --worker-tmp-dir /dev/shm \
    config.wsgi:application
}

case "${1:-web}" in
  web)
    run_web
    ;;
  migrate)
    exec python manage.py migrate --noinput
    ;;
  *)
    exec "$@"
    ;;
esac

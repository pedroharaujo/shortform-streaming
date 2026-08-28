#!/usr/bin/env bash
# Local / operator Compose evidence for the backend image. Application CI does
# not run this script (Container job is docker build only). See
# docs/runbooks/django-container.md.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${SHORTFORM_BACKEND_IMAGE:-shortform-backend:ci}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-shortform-backend-ci}"
export COMPOSE_PROJECT_NAME

API_URL="http://127.0.0.1:8080"
COMPOSE=(docker compose --profile container)

cleanup() {
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

die() {
  echo "verify_backend_container: $*" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  die "docker is required"
fi
if ! docker compose version >/dev/null 2>&1; then
  die "docker compose is required"
fi
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  die "$IMAGE is missing; run: docker build -f backend/Dockerfile -t shortform-backend:ci ."
fi

user="$(docker inspect --format '{{.Config.User}}' "$IMAGE")"
if [[ -z "$user" || "$user" == "root" || "$user" == "0" || "$user" == "0:0" ]]; then
  die "image user must be non-root, got ${user:-empty}"
fi

env_json="$(docker inspect --format '{{json .Config.Env}}' "$IMAGE")"
for forbidden in DJANGO_SECRET_KEY DATABASE_URL FIREBASE_PROJECT_ID; do
  if [[ "$env_json" == *"${forbidden}="* ]]; then
    die "image Env must not set ${forbidden}"
  fi
done

echo "==> web without production env fails closed"
set +e
timeout 30 docker run --rm --network none \
  -e GUNICORN_WORKERS=1 \
  -e GUNICORN_THREADS=1 \
  "$IMAGE" web
noenv_status=$?
set -e
if [[ "$noenv_status" -eq 0 ]]; then
  die "expected ImproperlyConfigured when production env is missing"
fi
if [[ "$noenv_status" -eq 124 ]]; then
  die "web without production env timed out instead of failing closed"
fi

http_get() {
  local url="$1"
  local body_file="$2"
  local header_file="$3"
  curl -sS --max-time 10 \
    -D "$header_file" \
    -o "$body_file" \
    -w "%{http_code}" \
    -H "X-Forwarded-Proto: https" \
    -H "Host: 127.0.0.1" \
    "$url"
}

wait_http() {
  local url="$1"
  local expected="$2"
  local attempts="${3:-30}"
  local body header code
  body="$(mktemp)"
  header="$(mktemp)"
  for _ in $(seq 1 "$attempts"); do
    code="$(http_get "$url" "$body" "$header" || true)"
    if [[ "$code" == "$expected" ]]; then
      cat "$body"
      rm -f "$body" "$header"
      return 0
    fi
    sleep 1
  done
  echo "last status ${code:-none} body $(cat "$body" 2>/dev/null || true)" >&2
  rm -f "$body" "$header"
  return 1
}

assert_json_ok() {
  local url="$1"
  local expected_code="$2"
  local body header code
  body="$(mktemp)"
  header="$(mktemp)"
  code="$(http_get "$url" "$body" "$header")"
  if [[ "$code" != "$expected_code" ]]; then
    die "${url} expected HTTP ${expected_code}, got ${code}: $(cat "$body")"
  fi
  python3 - "$body" "$expected_code" <<'PY'
import json
import sys

path, expected = sys.argv[1], int(sys.argv[2])
payload = json.loads(open(path, encoding="utf-8").read())
wanted = {"status": "ok"} if expected == 200 else {"status": "unavailable"}
if payload != wanted:
    raise SystemExit(f"unexpected json {payload!r}")
PY
  rm -f "$body" "$header"
}

echo "==> compose profile container"
"${COMPOSE[@]}" up -d --wait --wait-timeout 120

echo "==> GET /health/live"
assert_json_ok "${API_URL}/health/live" 200

echo "==> GET /health/ready"
assert_json_ok "${API_URL}/health/ready" 200

echo "==> GET /admin/login/"
admin_body="$(mktemp)"
admin_header="$(mktemp)"
admin_code="$(http_get "${API_URL}/admin/login/" "$admin_body" "$admin_header")"
if [[ "$admin_code" != "200" ]]; then
  die "/admin/login/ expected HTTP 200, got ${admin_code}"
fi
if ! grep -qi "text/html" "$admin_header"; then
  die "/admin/login/ expected HTML Content-Type"
fi
if ! grep -qi "<html" "$admin_body"; then
  die "/admin/login/ expected HTML body"
fi
rm -f "$admin_body" "$admin_header"

echo "==> GET /static/admin/css/base.css"
css_body="$(mktemp)"
css_header="$(mktemp)"
css_code="$(http_get "${API_URL}/static/admin/css/base.css" "$css_body" "$css_header")"
if [[ "$css_code" != "200" ]]; then
  die "/static/admin/css/base.css expected HTTP 200, got ${css_code}"
fi
if ! grep -qi "text/css" "$css_header"; then
  die "/static/admin/css/base.css expected CSS Content-Type"
fi
rm -f "$css_body" "$css_header"

echo "==> stop postgres: ready 503, live 200"
"${COMPOSE[@]}" stop postgres
if ! wait_http "${API_URL}/health/ready" 503 20 >/dev/null; then
  die "ready did not return 503 after postgres stop"
fi
assert_json_ok "${API_URL}/health/ready" 503
assert_json_ok "${API_URL}/health/live" 200

echo "==> start postgres: ready 200"
"${COMPOSE[@]}" start postgres
"${COMPOSE[@]}" up -d --wait --wait-timeout 60 postgres
if ! wait_http "${API_URL}/health/ready" 200 30 >/dev/null; then
  die "ready did not return 200 after postgres start"
fi
assert_json_ok "${API_URL}/health/ready" 200

echo "==> SIGTERM api within graceful window"
api_id="$("${COMPOSE[@]}" ps -q api)"
[[ -n "$api_id" ]] || die "api container id missing"
start_ts="$(date +%s)"
docker stop -t 30 "$api_id" >/dev/null
elapsed="$(($(date +%s) - start_ts))"
if [[ "$elapsed" -gt 35 ]]; then
  die "api stop took ${elapsed}s, expected within the 30s graceful window"
fi
echo "api stopped in ${elapsed}s"

echo "verify_backend_container: passed"

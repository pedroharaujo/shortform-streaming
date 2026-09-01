# Privacy-safe request correlation

P5-T06-F1 establishes a local/backend correlation boundary. It is not the final
Cloud Logging, dashboard, alert, crash, uptime, or retention setup.

## Request completion schema

Each Django response receives `X-Request-ID`. A caller value is accepted only by
the shared bounded printable validation; otherwise Django generates a UUID. The
same value is used by API `ErrorEnvelope.request_id` and the completion log.

The `shortform.request` JSON line contains only:

- `event` (`request_completed`)
- `request_id`
- `http_method`
- `http_route` (Django route template or `api`, `health`, `admin`, `other`)
- `http_status`
- `duration_ms`
- `severity`

The formatter intentionally ignores the log message and every non-allowlisted
record field. Do not add raw paths, query strings, request/response bodies,
Authorization or App Check headers, signed URLs, IP addresses, user/profile/device
identifiers, provider payloads, or exception locals.

## Local verification

```shell
uv run pytest backend/tests/security/test_request_observability.py
pnpm backend:check
```

The tests cover a routed API error, an early oversized-body rejection, shared
response/envelope IDs, route templating, and hostile query/header/body markers.

## Deferred release evidence

- D-020 must approve production log region and retention.
- Cloud Logging ingestion must be proven with generated traffic only.
- Dashboards, alerts, mobile Crashlytics, uptime checks, and controlled failure
  capture remain P5-T06 work.
- Never paste production log samples, signed media URLs, credentials, provider
  payloads, licensed metadata, or personal data into this public repository.

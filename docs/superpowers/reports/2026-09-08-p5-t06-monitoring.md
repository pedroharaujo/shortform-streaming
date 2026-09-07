# P5-T06 disabled monitoring implementation report

## Result

The staging configuration now has a reusable observability module that creates
nothing by default. An explicit enable switch can create two privacy-safe
log-based metrics and one dashboard over existing request completion logs and
documented Cloud Run metrics. A second switch can create API 5xx and p95 latency
alerts only after an operator supplies channels, a label-safe owner, severity,
an HTTPS runbook URL, and positive thresholds.

The implementation does not enable production monitoring, select a production
region or retention policy, create notification channels, change ingress, or
represent telemetry the application does not emit.

## Verification

- The first mocked plan test failed because the observability module was not yet
  declared, establishing the test-first baseline.
- `tofu fmt -check -recursive infra` passed.
- Fresh credential-free `tofu init -backend=false -input=false
  -lockfile=readonly`, `tofu validate -no-color`, and `tofu test -no-color`
  passed with the locked Google provider from a local cache. All 16 mocked runs
  passed. The independent final run used
  `TF_DATA_DIR=$env:TEMP/shortform-observability-root-20260908` and
  `TF_PLUGIN_CACHE_DIR=$env:TEMP/shortform-smoke-tofu-20260908/providers`.
- On the isolated monitoring branch, `cd backend` followed by
  `uv run pytest tests/security/test_request_observability.py -q` passed all
  four request-observability tests against the temporary local PostgreSQL
  database. Backend application code is unchanged by this PR.
- `python scripts/check_repository_foundation.py` passed all 50 tests plus the
  repository safety and governance checks.

No verification command applied infrastructure, read cloud state, used a
credential, or treated an unavailable live check as passing.

## Implemented signals

- Cloud Run API request count, 5xx count, and globally reduced p95 request
  latency.
- Per-route request count and duration distributions from the reviewed
  `request_completed` JSON event. Metric labels are limited to bounded route and
  numeric status; request IDs and methods are excluded.
- Cloud Run unhealthy probe counts and migrate/smoke job completion outcomes,
  grouped only by documented labels.
- API 5xx and p95 latency alert templates with operator-selected thresholds,
  destinations, owner, severity, and runbook metadata.

## Remaining acceptance work

Issue #123 remains open. A human must approve the D-020 production region,
retention, access, deletion, and provider constraints; select thresholds and
alert ownership; and verify the runbook, owner, and notification channels exist
and are reachable. An isolated staging run must then prove log ingestion,
metric extraction, dashboard values, controlled incidents, notification
delivery, acknowledgement, recovery, and closure.

Mobile crash capture, uptime, provider/CDN/transcoding, playback quality,
database saturation, purchase lifecycle, and commerce reconciliation telemetry
remain absent or unverified and are not represented by placeholder metrics.

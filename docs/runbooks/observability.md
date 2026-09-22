# Privacy-safe backend monitoring

P5-T06-F1 provides local request correlation. P5-T06-F2 / #123 adds an offline,
disabled-by-default OpenTofu foundation for the backend signals that already
exist. It does not prove Cloud Logging ingestion, notification delivery, mobile
crash capture, uptime, provider monitoring, production retention, or recovery.

## Emitted request event

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

The formatter ignores the log message and every non-allowlisted record field.
Do not add raw paths, query strings, request/response bodies, Authorization or
App Check headers, signed URLs, IP addresses, user/profile/device identifiers,
provider payloads, or exception locals.

Cloud Run captures one-line JSON written to stdout as `jsonPayload`. The log
metrics filter on `resource.type`, `resource.labels.service_name`,
`resource.labels.location`, and `jsonPayload.event`. They extract only the
bounded route and numeric status. Request IDs and methods remain searchable in
the original log but never become metric labels.

## Signals represented by the disabled module

| Dashboard signal | Source and limits |
| --- | --- |
| Request volume and 5xx count | Cloud Run `run.googleapis.com/request_count`; covers requests that reach a revision, not edge/IAM rejections. |
| Request p95 latency | Cloud Run `run.googleapis.com/request_latencies`; distributions are summed during alignment before the percentile is reduced across series. |
| Per-route volume and duration | User-defined log metrics from the reviewed `request_completed` JSON event. |
| Unhealthy probes | Cloud Run `run.googleapis.com/container/completed_probe_count`, grouped by documented probe labels. |
| Job outcomes | Cloud Run `run.googleapis.com/job/completed_execution_count` for the existing migrate and smoke jobs, grouped by its documented `result` label. The module does not guess result values for an alert. |

The repository does not currently emit operational metrics for Supabase
database saturation, Bunny CDN/transcoding, playback quality, Crashlytics,
purchase lifecycle, or commerce reconciliation. No empty chart or placeholder
metric represents those capabilities.

Google's primary documentation describes [Cloud Run structured log capture](https://docs.cloud.google.com/run/docs/logging),
[Cloud Run metric descriptors and labels](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z),
[Logging query field syntax](https://docs.cloud.google.com/logging/docs/view/logging-query-language),
and [Monitoring aggregation behavior](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies#Aggregation).

## Configuration and safe default

Committed defaults create no log metrics, dashboard, alerts, or observability API
enablement:

```hcl
observability_enabled        = false
observability_alerts_enabled = false
```

The module creates no log bucket, sink, exclusion, retention rule, notification
channel, uptime check, trace resource, public ingress, or production resource.
Supplying the existing staging `region` scopes filters; it is not D-020 approval.

Enabling only `observability_enabled` creates the two log metrics and dashboard
and conditionally enables Logging and Monitoring APIs. Alert creation remains
off. Do not enable this during an unrelated staging apply.

Before setting `observability_alerts_enabled = true`, an operator must supply:

- at least one existing full Monitoring notification-channel resource name;
- a real lowercase label-safe owner (`[a-z][a-z0-9_-]{0,62}`);
- explicit `info`, `warning`, or `critical` severity;
- a reachable HTTPS incident runbook URL;
- positive 5xx-per-minute and p95-latency thresholds selected from a controlled
  staging baseline.

OpenTofu fails planning when a required field is missing, a channel, owner,
severity, or threshold has an invalid format, or the owner uses a reserved
placeholder value. The operator must separately verify that the runbook is
reachable and that the channel and owner exist. The module creates two policies:
API 5xx count and sustained p95 latency. It does not invent alert thresholds or
notification destinations.

## Credential-free verification

Use a fresh `TF_DATA_DIR` outside the repository, the committed lock file, and a
local provider cache or mirror. Do not initialize the real backend.

```shell
tofu fmt -check -recursive infra
cd infra/environments/staging
tofu init -backend=false -input=false -lockfile=readonly
tofu validate
tofu test -no-color
python ../../../scripts/check_repository_foundation.py
```

The mocked plans prove the default has zero resources/APIs, the explicit enable
path uses only documented signals and safe labels, and alert activation fails
closed without operator configuration. They do not contact GCP or validate live
metric data.

## Required live follow-up

- Approve D-020 production log/metric/crash regions, retention, access, deletion,
  and provider constraints before public production activation.
- Assign the operator inputs above and review the plan against the isolated
  staging project before enabling anything.
- With generated traffic only, prove structured log ingestion, metric label and
  distribution extraction, dashboard values, controlled 5xx/latency incidents,
  notification delivery, acknowledgement, recovery, and closure.
- Implement and validate mobile Crashlytics, uptime, provider telemetry,
  playback-quality signals, and commerce reconciliation before claiming the full
  P5-T06 acceptance matrix.
- Never paste production logs, signed media URLs, credentials, provider payloads,
  licensed metadata, or personal data into this public repository or issue.

#123 remains open until those source and live checks are complete. D-017 governs
paid-acquisition spend, not these operational thresholds. D-025 is a release and
production-account gate; it does not block this disabled coding foundation.

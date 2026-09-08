# Disabled staging monitoring foundation (#123)

## Scope

Add a credential-free, disabled-by-default OpenTofu foundation for the telemetry
that the application and Cloud Run already produce. Enabling the foundation may
create project-scoped log-based metrics, one dashboard, and explicitly configured
alert policies. The default staging plan must create none of those resources and
must not enable the Logging or Monitoring APIs.

The application emits one reviewed structured completion event with
`http_method`, bounded `http_route`, numeric `http_status`, `duration_ms`, and
`severity`. The platform supplies Cloud Run request count, latency, instance,
probe, and job-completion metrics. No database-saturation, provider CDN,
transcoding, playback-quality, crash, purchase, or reconciliation metric exists,
so this slice must not name or graph one.

## Configuration contract

- `observability_enabled` defaults to `false` and gates the Logging API,
  Monitoring API, log metrics, dashboard, and every alert.
- `observability_alerts_enabled` defaults to `false`. Enabling alerts requires
  observability, at least one existing notification-channel ID, a non-placeholder
  operational owner, explicit severity, an HTTPS runbook URL, and positive
  operator-selected thresholds. No alert threshold or severity is guessed in
  committed configuration.
- Region, service, and existing migrate/smoke job names come from the staging
  composition. The module does not choose a production region or retention.
- The module does not create notification channels, log buckets, sinks,
  exclusions, retention rules, uptime checks, traces, or public ingress.

## Telemetry and privacy contract

Create a request-completion counter and duration distribution from Cloud Run
`jsonPayload`. Labels may extract only bounded `http_route` and numeric
`http_status`. `request_id` and `http_method` remain searchable in logs but are
never metric labels; the current method validator permits too many distinct
alphabetic values for a metric dimension. Raw paths, query strings, bodies,
credentials, signed URLs, IPs, users, devices, and provider payloads must never
appear in metric filters, extractors, dashboards, or alert documentation.

The dashboard covers only:

- Cloud Run request volume, 5xx responses, and p95 latency;
- per-route request completion volume and duration from the reviewed log event;
- Cloud Run unhealthy probe results and failed executions of the existing
  migrate/smoke jobs.

Alerts cover API 5xx count and p95 latency using operator-provided thresholds and
channels. Probe and job charts group the documented result labels without
guessing undocumented label values. Live ingestion, delivery, and recovery
evidence remains open.

## Acceptance

- Mocked default plan proves zero observability resources and zero observability
  API enablement.
- Mocked enabled plan proves the exact resources, real metric descriptors, low
  cardinality labels, service/location/job scoping, and disabled alerts.
- Alert activation fails before plan when a required field is missing, a channel,
  owner, severity, or threshold has an invalid format, or the owner uses a
  reserved placeholder. Operators remain responsible for verifying the runbook,
  notification channel, and owner exist and are reachable.
- OpenTofu format, offline init/validate/test, repository foundation, and relevant
  backend request-observability tests pass without credentials or cloud calls.
- Documentation clearly keeps D-020 production retention/region, mobile/provider
  telemetry, live failure evidence, uptime, and notification verification open.

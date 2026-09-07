# P5-T06 disabled monitoring implementation plan

> **For agentic workers:** Stay in this checkout. Do not apply infrastructure,
> read cloud state, use credentials, or mark live evidence complete.

**Goal:** Deliver the offline engineering portion of #123 over telemetry that
already exists, while keeping every production and human verification gate open.

**Architecture:** A reusable module is called by staging but creates nothing
unless one explicit switch is enabled. Alerts require a second switch plus all
operator-owned inputs. Cloud Run platform metrics provide service and job health;
the reviewed request JSON provides bounded route detail.

- [x] Add failing mocked-plan tests for disabled defaults, enabled resources,
  privacy-safe labels, and fail-closed alert configuration.
- [x] Add the observability module and wire conditional APIs and staging inputs.
- [x] Expand the observability and infrastructure documentation with the exact
  implemented signal inventory and unresolved human/live prerequisites.
- [x] Run `tofu fmt`, fresh offline locked-provider init, `tofu validate`, mocked
  `tofu test`, request-observability tests, and repository foundation checks.
- [x] Record exact evidence and limits in the matching report. Keep #123 open.

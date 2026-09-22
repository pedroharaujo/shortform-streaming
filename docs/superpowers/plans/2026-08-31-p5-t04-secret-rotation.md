# P5-T04 Secret Configuration Foundation Implementation Plan

> **For agentic workers:** Execute this bounded task in the assigned checkout;
> use Superpowers execution and verification guidance and an independent code
> reviewer. The founder authorized this worktree exception only for this task.

**Goal:** Make runtime secret adoption explicit and reduce secret access without
claiming that live rotation or the full P5-T04 acceptance has passed.

**Architecture:** Keep Secret Manager names separate from versions/values.
Cloud Run service and jobs accept a map of version selectors keyed by runtime
environment name; omitted entries retain `latest`. Staging derives secret IAM
from the configured consumers, never the set of all provisioned secret names.

**Tech stack:** OpenTofu 1.11.14 / locked Google provider; Python stdlib unittest.

## Constraints and design decisions

- Base: clean `e5da0ba` main checkout. Branch: `codex/p5-t04-secret-rotation`.
- Authority: P5-T04, D-012/D-013/D-014, ADRs 0002/0003/0005, SECURITY.md.
- No live cloud actions, credential reads, deployments, secret values, paid
  resources, new release decisions, mobile/backend behavior, or automatic merge.
- Four supported selectors: `DJANGO_SECRET_KEY`, `DATABASE_URL`,
  `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`. Accept positive integer
  version strings or `latest`; reject unknown names, aliases, empty/null values.
- Preserve the existing mandatory Django/database names and optional Bunny
  names. Wire the existing Bunny module configuration through staging, so IAM
  can reference the exact configured names, including optional created extras.
- Fail before apply if consumed names are not provisioned. Make workloads depend
  on the secret IAM grants; do not create new secret versions through OpenTofu.
- IAM remains scoped to secrets, not versions. Existing shared service/job
  identity remains; per-consumer isolation and version-level enforcement are
  explicit follow-ups, not silently claimed as implemented.
- Do not add Django key fallbacks: upload/object-store HMAC uses the same key.
- No zero-downtime claim for providers without proven overlap. Runbook must
  distinguish staged candidate adoption, job templates, rollback, and revocation.

## Implementation and acceptance

- [x] Add failing mocked-plan regressions in
  `infra/environments/staging/tests/secret_configuration.tftest.hcl`:
  default access only to Django/database; distinct selected versions across
  service/jobs; optional custom Bunny names; unused extras denied; invalid
  selectors and missing consumed names rejected. Use `mock_provider "google"`
  and `command = plan` exclusively. Run:
  `tofu -chdir=infra/environments/staging test -no-color`.
- [x] Implement version lookup in `infra/modules/cloud_run/{main,variables}.tf`
  and `infra/modules/cloud_run_job/{main,variables}.tf`, for example
  `lookup(var.secret_versions, "DJANGO_SECRET_KEY", "latest")`.
  Export names/version references only for configuration review/tests.
- [x] Wire the selector map and optional Bunny settings in staging
  `{main,variables}.tf`; restrict `iam.tf` runtime accessor to consumed IDs and
  add an existence precondition. Keep ingress, WIF, image ownership and all
  release gates unchanged. Add mocked tests to the existing tofu CI gate.
- [x] Add synthetic scanner/redaction regressions to
  `tests/repository/test_secret_scanner.py` for the inventoried secret formats.
  Retain the scanner implementation unless the regressions expose a real gap.
- [x] Write `docs/runbooks/secrets-and-rotation.md`: names/purpose, environments,
  storage/owner/consumers, per-provider overlap/rollback, preflight, adoption,
  old-value revocation, redacted evidence, and explicit live follow-up. Link it
  from the docs index and staging README/deploy guidance; update tfvars example.
- [x] Run `tofu fmt -check -recursive infra`, backend-disabled init, validate,
  mocked tests, `python scripts/check_repository_foundation.py`,
  `python scripts/validate_ai_governance.py`, `git diff --check`, and relevant
  existing redaction tests. Run `pnpm check` if bootstrap supports it. Missing
  required checks remain blockers; record exact commands/results in PR evidence.
- [ ] Independently review the final diff for correctness, authorization,
  secret exposure, safe rollback, and honest acceptance. Fix blocking findings
  and rerun affected gates. Prepare one P5-T04 PR and open a live follow-up.

Local tests prove configuration and scanning behavior only. P5-T03 live WIF,
Environment setup, deployment, failure/no-promotion, rollback, and fork denial
remain required. P5-T04 environment isolation, overlap and a real staging
rotation followed by old-value revocation remain unverified until separately
authorized and observed. Keep the master task acceptance boxes unchecked.

Follow-up opened as [#101](https://github.com/pedroharaujo/shortform-streaming/issues/101).
Independent read-only review found no blocking findings; the reviewer reran all
nine mocked plans, validate, formatting, scanner regressions and diff hygiene.
Final local results: OpenTofu format/init/validate and all nine mocked plans
passed; repository foundation passed all 50 tests and governance; the existing
request-log redaction regression passed (1 test); API contract generation/check
passed with no contract changes. `git diff --check` passed. The full `pnpm check`
aggregate was not run: no database is assigned to this worktree, and P3-T08's
services must not be used. Required remote PR gates still need their own results.

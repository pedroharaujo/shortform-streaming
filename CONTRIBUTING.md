# Contributing

## Before starting

1. Read `MICRODRAMA_IMPLEMENTATION_PLAN.md` and identify the plan task ID.
2. Read the relevant product brief, decision-register entries, ADRs, and dependencies.
3. Do not implement production behavior that depends on an unapproved legal, rights, market, price, or budget decision.
4. Keep changes small enough to implement and validate in one focused pull request.

## Branch and pull-request workflow

- AI-driven changes must follow `AGENTS.md` and `ai/workflows/development-loop.md`, including independent reviewer and verifier contexts.
- Use a short-lived branch from `main`.
- Name branches by task and purpose, for example `p1-t02/backend-bootstrap`.
- One pull request should normally satisfy one plan task or a clearly explained subtask.
- Complete the pull-request template, including acceptance criteria and exact validation evidence.
- Do not merge with failing required checks or unresolved high-severity review findings.
- Use expand/migrate/contract for database changes; destructive schema contraction is a separate release.

## Commit guidance

Use concise imperative messages with an optional conventional prefix:

- `docs: approve MVP product brief`
- `feat(catalog): add rights-aware series endpoint`
- `test(commerce): cover duplicate purchase webhook`
- `infra: provision staging artifact registry`

## Public-repository rules

Never commit:

- secrets, credentials, tokens, signing material, or usable environment files;
- licensed videos, subtitles, posters, promotion clips, or other copyrighted delivery assets;
- contracts, confidential pricing, royalty terms, or supplier personal data;
- production databases, logs, analytics exports, support attachments, or provider webhook payloads;
- App Store/Google/RevenueCat/AdMob private keys or service-account files.

Use generated, redacted, or self-owned fixtures. When a private resource is required, document its opaque reference and provisioning process without exposing its value.

## Definition of done

- Acceptance criteria are satisfied and linked to evidence.
- Appropriate unit, integration, contract, device, security, or recovery tests pass.
- Existing lint, type, test, build, migration, and generated-contract checks pass.
- Security, privacy, analytics, accessibility, localization, cost, and rollback impacts are addressed.
- Documentation and environment examples are current.
- No secrets or confidential/licensed material are present.

## Testing policy

- Write one test at the highest level that would catch the bug.
- Do not add client + screen + smoke coverage for the same outcome.
- Keep backend tests for auth, eligibility, playback authorize, production
  settings, and OpenAPI.
- Do not add tests for presentational fallbacks, ASCII strings, or framework
  defaults.

Validate AI governance changes with `python scripts/validate_ai_governance.py`. Use the area-specific commands in `AGENTS.md`; an unavailable required command is a blocker, not a pass.

Pull requests run always-on `Repository foundation` and `OpenAPI contract` checks plus the path-aware `Application CI` gate. Do not treat skipped `Backend`, `Mobile`, or `Container` jobs as missing required checks; the human ruleset should require the always-reporting `Application CI` job name documented in `docs/runbooks/repository-controls.md`. Extra local commands include `pnpm backend:test:coverage`, `pnpm mobile:bundle:check`, and `docker build -f backend/Dockerfile -t shortform-backend:ci .`.

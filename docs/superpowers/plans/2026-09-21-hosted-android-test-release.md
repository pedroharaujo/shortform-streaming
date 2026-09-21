# Hosted Android test release implementation plan

> **For agentic workers:** Use Superpowers subagent-driven-development for the bounded implementation tasks and independent review. Stay in this checkout; do not create worktrees.

**Goal:** Prepare an Android test build and a permanent Cloud Run API/callback address that work without the founder's computer, without activating public infrastructure or real payments.

**Architecture:** Reuse Django, Firebase identity, Supabase PostgreSQL and the existing deployment pipeline. Add an opt-in public consumer service alongside the unchanged private staff service. Its dedicated secure sandbox settings exclude staff URLs and accept only verified Android SANDBOX purchases. No load balancer, custom domain, migration of providers or ads.

**Tech stack:** Django, Expo/React Native, RevenueCat, Cloud Run, OpenTofu, GitHub Actions.

**Tracking:** P5-T05-F4 / #121 and Android journey #164. Delivered as two dependent PRs: app support (#164) followed by opt-in deployment (#121), because a hosted test release needs matching server, mobile and deployment boundaries. This does not close distributed edge protection or paid-launch readiness.

## Authorization and boundaries

The founder requested preparation using Cloud Run's generated HTTPS URL on 2026-09-21. Preparing code is authorized. Applying infrastructure, approving new costs, changing provider webhook destinations, publishing an Android build and activating real-money purchases remain separate actions. Existing private staging, prices, product registry, purchase verification and production purchase guards remain intact. Public direct Cloud Run has Google frontend protections but no configurable Cloud Armor rules; document that tradeoff before activation.

## Task 1 — Secure hosted sandbox backend

- [x] Extract shared secure settings from production; retain production coin prohibitions. Add `config.settings.hosted_sandbox` with DEBUG false, real Firebase verification, ads disabled, explicit SANDBOX purchase and spending gates. Do not permit synthetic fulfillment remotely.
- [x] Provide a consumer-only URL configuration that never includes Django Admin or staff upload endpoints. Preserve the private staff URL configuration.
- [x] Allow existing verified sandbox reconciliation/callback handling in this setting without weakening product/environment, HMAC/authentication, ownership or once-only credit checks.
- [x] Add focused tests proving hosted gates, staff URL exclusion, synthetic/production purchase rejection and unchanged production settings. Run backend lint, format, types, migrations and tests.

## Task 2 — Android staging purchase configuration

- [x] Permit RevenueCat SANDBOX checkout for staging HTTPS Android builds, including release builds; keep production checkout and synthetic staging checkout disabled.
- [x] Update runtime guards consistently and preserve recovery, balance and pricing logic. Keep preview local-only and label hosted sandbox purchases clearly.
- [x] Add a staging build configuration/example without secrets or invented application IDs. Test staging release acceptance and production/synthetic rejection; run mobile lint, types, tests and config checks.

## Task 3 — Opt-in public service and deployment

- [x] Add a default-off public sandbox service composition with separate settings, explicit bounded instance capacity, numeric secret-version references and consumer-only routes. Keep existing private Cloud Run service/IAM untouched.
- [x] Supply permanent callback settings using Secret Manager references, never values in source/state. Restrict the service to secure hosted sandbox settings; no generic insecure public-mode toggle.
- [x] Extend staging deployment only when its public service variable is configured: deploy candidate, check anonymous health plus admin denial and callback authentication before promotion. Leave production workflow unchanged.
- [x] Add mocked OpenTofu and deterministic deployment tests for defaults, opt-in configuration, secret validation and failure-before-promotion. Run repository gates and OpenTofu checks.

## Task 4 — Reviewable release handoff

- [x] Document the exact activation order, service URL/App Check/tester prerequisites, capacity/cost assumptions, permanent webhook setup and rollback. Distinguish code checks from unperformed live checks.
- [x] Obtain independent spec/security review and fix actionable findings. Run API contract generation/check and relevant final checks once.
- [ ] Publish the two focused unmerged PRs, attach them to this task, restore the unrelated cleanup checkout and report the concrete remaining activation decision. No repeated emulator purchase tests during preparation.

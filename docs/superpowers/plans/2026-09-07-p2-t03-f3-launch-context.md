# P2-T03-F3 Launch Context Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development with task-scoped implementation and review. The user requested orchestration and independent sub-agents; independent file ownership may run in parallel, with shared interfaces agreed first. Stay in this checkout; create no worktrees.

**Goal:** Resolve catalog launch scope on the server and enforce explicit rights through publication, discovery, playback, and ingestion.

**Architecture:** A validated immutable settings context feeds shared catalog admission/eligibility. Additive catalog fields preserve stable IDs and metadata, while one qualifying license grant supplies every required permission. Existing entitlement policy inherits the strengthened eligibility boundary.

**Tech stack:** Django/DRF, PostgreSQL, existing OpenAPI TypeScript generation; no new dependency.

## Global constraints

- Active defaults are FR/android/google_play/en; no new public market or audience activation.
- Client headers, queries, profile locale and targeting never widen eligibility.
- New licensed permissions default false; storefront and language-specific grants default empty.
- Keep self-owned provenance independent and restricted to explicitly recorded series distribution scope.
- Preserve opaque IDs, translation rows, financial dimensions, windows, takedown, DRM, age/content review, authorization, and entitlement checks.
- Synthetic fixtures only; no secrets, personal data, licensed media, contracts, rates, or provider payloads in public evidence.
- Expand/migrate only; no destructive contraction or new runtime dependencies.
- One behavior test at the highest useful level; no equivalent mobile/screen/smoke test stacks.
- Required checks must pass; agent review does not authorize a merge.

## Existing approval and task boundary

The founder approved the strategy and explicitly requested implementation of the
next plan task with sub-agents and review. D-031/D-034 and P2-T03-F3 already define
the product/architecture direction. The design records routine engineering choices
within that scope; no new product decision is needed. Per AGENTS.md, do not stop
to ask the founder to choose implementation details or now-versus-later sequencing.

Base revision: `ddfb3f568061d7b3c57e65057f3152be8a625a28`.

## Task 1: Catalog context, domain and admission

**Owner files:** `backend/apps/catalog/` (including migrations and seed command),
`backend/config/settings/base.py`, and `backend/tests/catalog/` except the
orchestrator's integration/migration evidence files.

**Interfaces:**

- Produce immutable `LaunchContext` and `resolve_launch_context()` in
  `apps.catalog.context`; invalid/disabled settings return `None`.
- Produce `series_is_admitted(series, *, now=None, captions_language=None) -> bool`
  in `apps.catalog.eligibility`, independent of publication/media readiness.
- Preserve existing eligibility and serializer call signatures where practical.

- [x] Add focused failing context/rights tests before implementing behavior.
- [x] Add server settings/resolver, series scope and segment associations, license
  permission/storefront/language fields, and additive migrations.
- [x] Apply same-grant effective rights to admission/publication/eligibility and
  activate supplemental metadata without reviving stale English translations.
- [x] Extend Admin and seed synthetic self-owned fixtures explicitly.
- [x] Run catalog tests, lint, format, types and migration drift checks; record
  exact evidence and any necessary compatibility fixture changes.
- [x] Independent task review: specification compliance and code quality.

Behavior anchors: missing any one required permission hides a licensed title;
split partial grants cannot jointly approve it; disabled or invalid context hides
self-owned and licensed titles; changing a request country never changes server
scope; an active synthetic alternate-language context requires explicit series
distribution, translated metadata, and matching language/media rights.

## Task 2: Ingestion and staff permission enforcement

**Owner files:** `backend/apps/playback/ingest.py`,
`backend/apps/playback/admin.py`, and focused playback ingestion/staff-upload tests.

**Consumes:** Task 1's `series_is_admitted` API. This task may write independent
files in parallel after that signature is fixed; final tests wait for Task 1.

- [x] Add failing tests proving denied rights make no provider/object-store call.
- [x] Guard direct upload, signed-upload start, completion and provider retry with
  fresh admission; apply the actual caption-language restriction to one grant.
- [x] Preserve cleanup/takedown and existing idempotent upload transitions.
- [x] Enforce MediaAsset add/change permissions on custom Admin upload routes.
- [x] Test rights revocation between start/completion, denied captions, and a
  staff user without the required model permission. Update old synthetic fixture
  provenance where the new admission boundary legitimately requires it.
- [x] Run ingestion/staff/Admin tests and applicable static checks.
- [x] Independent task review: specification compliance and code quality.

## Task 3: Integration, migration evidence and contract

**Owner:** Orchestrator; do not edit files owned by active implementers.

**Files:** Focused new API/migration tests as needed, existing callback revocation
test table, `backend/config/spectacular.py`, generated API files, task runbook,
and main plan completion/evidence.

- [x] Verify client context spoofing and localized response IDs at the API layer.
- [x] Verify current entitlement/reward paths recheck revoked rights/context.
- [x] Rehearse additive migrations on a dedicated empty synthetic PostgreSQL DB;
  prove old IDs/text remain and new unknown approvals remain false/empty.
- [x] Update stale API descriptions and regenerate OpenAPI/client together.
- [x] Run backend area checks and repository foundation; inspect every result.
- [x] Record deployment/reapproval/rollback instructions and actual evidence.

## Task 4: Final review and handoff

- [x] Create a complete diff review package from the recorded base revision.
- [x] Fresh independent reviewer checks whole-branch requirements, rights,
  migrations, authorization, maintainability, and validation evidence.
- [x] Resolve material findings and rerun the affected checks.
- [x] Open a reviewable PR with task reference and exact checks; preserve any
  external blocker as a blocker and do not merge automatically.

## Progress ledger

- Planning: repository/current plan confirmed; PR #138 merged. Two independent
  read-only audits identified ingestion/publication and stale-translation risks.
- Task 1: complete; catalog task review passed after shared assigned-ISO-code
  validation and UTF-8 corrections. 83 catalog tests passed; no migration drift.
- Task 2: complete; ingestion task review passed after using real licensed grants
  to verify revocation and split-caption denial before external calls. 25 scoped
  ingestion/staff/Admin tests passed.
- Task 3: complete. `pnpm check` passed: repository safety, 50 repository tests,
  AI governance, backend lint/format/mypy, migration drift, 323 backend tests,
  contract regeneration/drift, mobile lint/format/types, 177 mobile tests, and
  mobile configuration. The aggregate backend run reported only an unwritable
  optional pytest cache; a separate no-cache 323-test run was clean. No device or
  provider journey is claimed. Exact commands and safe deployment/rollback are in
  `docs/runbooks/catalog-launch-context.md`.
- Task 4: whole-branch review passed with no Critical/Important findings. Its
  optional endpoint-description correction passed 5 focused API tests and contract
  checks. The generated TypeScript comment activates mobile CI; Expo Doctor found
  two pre-existing patch mismatches, so a minimal Expo/router compatibility update
  passed Expo Doctor (21/21), `pnpm mobile:check` (177 tests), and Android production
  JavaScript bundle export. A separate read-only addendum review found no material
  issue or policy weakening. `pnpm install --frozen-lockfile` passed with unchanged
  supply-chain policy. Implementation revision: `04cecde99f18f9740d97c1e73d79869eecb97dda`.
  [PR #139](https://github.com/pedroharaujo/shortform-streaming/pull/139) contains
  the exact validation and final CI evidence; it requires human approval to merge.

# Catalog launch context and rights admission

**Plan task:** P2-T03-F3. No additional market, real audience, spend, or production
activation is approved by this implementation.

Implementation and review evidence:
[PR #139](https://github.com/pedroharaujo/shortform-streaming/pull/139).

## Server configuration

The backend resolves one immutable active context from Django's
`CATALOG_LAUNCH_CONTEXT` setting. The base setting reads these environment values:

| Environment variable | Default | Meaning |
|---|---|---|
| `CATALOG_LAUNCH_ENABLED` | `true` | Only the exact string `true` enables catalog admission |
| `CATALOG_LAUNCH_COUNTRY` | `FR` | Assigned uppercase ISO 3166-1 alpha-2 country code |
| `CATALOG_LAUNCH_PLATFORM` | `android` | Approved client platform |
| `CATALOG_LAUNCH_STOREFRONT` | `google_play` | Must match the platform; future iOS uses `app_store` |
| `CATALOG_LAUNCH_LANGUAGE` | `en` | Current lowercase ISO 639-1 presentation language |
| `CATALOG_LAUNCH_AUDIENCE_SEGMENT` | unset | Optional neutral content-segment slug; D-035 remains open |

Invalid or disabled context returns no eligible catalog, playback, or new ingestion.
The resolver, model validation, and eligibility queries share an assigned-code
registry; unknown two-letter values are invalid, even if repeated in grant data.
Request headers, query parameters, and account locale cannot override it. Changing
deployment scope requires a separately approved rollout and per-title review;
the synthetic alternate-context tests do not authorize another country or client.

## Title and language review

Every series has explicit distribution territory/platform/storefront/language
allowlists. Their legacy defaults preserve FR/android/google_play/en, including
the old self-owned provenance path. Empty or malformed scope denies admission.
An active content segment, when configured, also requires a series association.
No real segment is seeded or inferred from user data.

Direct Series/Episode title and synopsis remain the canonical English values.
Additional-language metadata uses existing translation rows; dormant English rows
cannot replace newer direct text. Content IDs and API response keys remain stable.
A translated title does not prove media language: playback requires a ready asset
with the active source language or the actual permitted caption track. Alternate
audio/dub delivery remains outside this task.

Self-owned content requires its private provenance reference and promotional
approval within recorded series distribution scope. It does not need a fabricated
license. Licensed content additionally needs one effective ContentRight containing
all applicable scope and all four explicit permissions:

- Free access, rewarded ads, coin access, and paid promotion.
- Storefront and original/subtitle grants matching the actual content/captions;
  legacy aggregate languages remain an additional restriction. Dub grants alone
  do not activate a dub that has not been delivered.
- Existing generic promotional permission, opaque contract/finance references,
  territory allow/deny, platform, effective window, takedown, and supported protection.

Separate incomplete grants cannot be combined into approval. New license flags
default false and new storefront/language grant arrays default empty. Private
contracts, supplier details, percentages, media, and provider data never belong
in repository fixtures or public review evidence.

## Staff publication and uploads

Review and complete the title's rights/provenance before ingestion. Approved drafts
can acquire media before publication; publication additionally checks required
metadata and episode media readiness. Complete license fields in the ContentRight
Admin before publishing its parent series.

Direct ingestion, signed-upload start/completion, and provider submission/retry
check current admission. Completion re-reads state so revocation after a signed
upload was issued prevents submission. Actual supplied caption language must fit
the same licensed grant. Denial occurs before external provider/object-store work.
Cleanup and takedown remain available after revocation.

Custom signed-upload routes require MediaAsset add/change permissions as well as
staff authentication and CSRF protection. Existing entitlement ownership and
verified reward handling remain unchanged; an entitlement does not override
revoked rights or disabled launch context. Age/content and private media review
remain release obligations; this task adds no anonymous age verification.

## Deployment and safe rollback

1. Apply the additive catalog migration before deploying code that reads its fields.
2. Existing IDs, text, translation rows, and license records remain intact. Only
   previously established narrow series scope receives defaults. New licensed
   permissions/storefront/language scopes remain unapproved until private review.
3. Review each licensed title privately, then explicitly fill the new fields.
   Previously published titles with incomplete grants remain unavailable.
4. Verify configured scope and synthetic catalog/ingestion/playback/reward tests
   before enabling an approved environment. Exact-candidate provider/device gates
   remain in the final validation runbook.

Prefer a forward fix. Keep additive fields/data when correcting code. Before any
rollback to older eligibility code, keep affected licensed titles draft or taken
down; the older binary does not enforce the new permissions or context switch.
Do not reverse catalog migrations or restore permissive old approvals to recover
availability. Destructive contraction is a separate release.

## Verification record

The task uses dedicated ephemeral PostgreSQL databases containing synthetic data
only. The following checks passed on 2026-09-07:

- `pnpm backend:lint`, `pnpm backend:format:check`, `pnpm backend:typecheck`, and
  `pnpm backend:migrations:check`: no errors or migration drift.
- `uv run pytest backend/tests --tb=short --maxfail=1 -q -p no:cacheprovider`:
  323 passed, including additive migration preservation, real upload-right
  revocation, split caption grants, client spoofing, and entitlement/reward denial.
- `python scripts/check_repository_foundation.py`: safety scan, 50 repository
  tests, and AI governance passed.
- `pnpm contract:check`: regenerated schema and TypeScript client with no drift.
  Response shapes and generated TypeScript types remain unchanged; schema and
  generated client descriptions now explain the configured scope.

The aggregate `pnpm check` passed, including 177 mobile tests. The endpoint
description also changed a generated client comment, activating mobile CI. Expo
Doctor required two existing patch mismatches to be corrected: Expo 57.0.20 and
expo-router ~57.0.19. After the update, Expo Doctor passed 21/21,
`pnpm mobile:check` passed all 177 tests, and `pnpm mobile:bundle:check` produced
the Android production JavaScript bundle. No native compilation is claimed.
`pnpm install --frozen-lockfile` also passed with the existing supply-chain policy.

Independent catalog and ingestion reviews passed after strict ISO membership and
real-grant integration corrections. Fresh whole-branch review and its compatibility
addendum found no Critical/Important issue. Final revision and CI results are
recorded in the implementation PR.
No device/provider journey or production activation is claimed by these tests.

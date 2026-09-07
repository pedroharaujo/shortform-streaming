# P2-T03-F3: Configurable launch context and rights admission

**Status:** Engineering design implementing the approved D-031/D-034 direction and P2-T03-F3 acceptance criteria. No new market, audience, commercial terms, or production activation is approved.

## Outcome and authority

One trusted server configuration selects the catalog country, platform, storefront,
language, and optional content segment. Defaults remain France, Android, Google
Play, and English. The audience stays unset until D-035. An inactive or malformed
configuration exposes no catalog or playable media. Client headers, query values,
profile preferences, and targeting never select this configuration.

The existing stable series/episode IDs, license records, translation rows, and
store monetary dimensions survive. This task does not implement coin transactions
or editorial episode offers; those follow in P3-T01-F1/P3-T02.

## Implementation choice

Use validated Django settings and an immutable context value rather than a new
market-management service or operator-editable active-market database. This keeps
deployment configuration authoritative without introducing rollout UX. Retain the
existing direct English metadata as the explicit legacy fallback and use the
existing translation tables for additional languages. Replacing those tables or
making dormant English rows authoritative would add migration risk.

### Context and catalog scope

`catalog.context.resolve_launch_context()` takes no request or profile and returns
a validated `LaunchContext` or `None`. Settings describe `enabled`, `country`,
`platform`, `storefront`, `language`, and optional `audience_segment`. Invalid types,
unknown platform/storefront pairs, or invalid codes fail closed. No context cache
may survive configuration overrides in tests.

Series distribution allowlists cover territories, platforms, storefronts, and
catalog languages independently of the license grant. Their legacy defaults are
FR/android/google_play/en, preserving the scope already approved for existing
self-owned provenance. Additional values require explicit operator review; an
English title or ownership flag alone cannot make an old series worldwide.
Licensed grants must also match that series scope. Empty/malformed scope denies.

`ContentSegment` has a stable neutral slug/name and a Series association. An unset
active segment applies no new audience restriction; a configured segment requires
a matching association. No real audience is selected, inferred from personal data,
or seeded by this change.

### Metadata and media language

Direct Series/Episode title and synopsis remain the legacy English authority.
Additional-language responses require a valid translation row; no silent fallback
to another language. Dormant English translation rows cannot override newer direct
copy. Response keys and opaque IDs remain unchanged. Batch translations where
needed to avoid a query per catalog card or episode.

Keep generalized language grants and record original/subtitle/dub permissions
separately. Existing aggregate `languages` remains a conservative additional bound,
not evidence of newly approved subtitle/dub rights. New language-specific grants
default empty. Actual source and uploaded caption languages must be permitted by
the same qualifying licensed grant. A translated title or a dub grant without
matching delivered media is not evidence of a playable translation. This task
does not add alternate audio selection or dub delivery.

### Rights and shared admission

Add explicit `free_access_permission`, `rewarded_ad_permission`,
`coin_access_permission`, and `paid_promotion_permission` fields to ContentRight,
all default false. Add storefront scope with an empty default. Preserve the
existing promotional-clip field and opaque private references; historic generic
promotion approval does not imply paid-creative approval.

A single qualifying grant must contain every required MVP permission and match
the country, denylist, platform, storefront, relevant languages, effective window,
non-takedown status, supported protection, and required private references. Never
combine partial permissions from separate grants. Missing or malformed values deny.

`catalog.eligibility.series_is_admitted(series, *, now=None,
captions_language=None)` is the shared admission boundary. It checks current
server context, series distribution scope, takedown, and provenance or effective
licensed rights. It intentionally does not require publication or ready media,
so approved drafts can be ingested. Passing a caption language further restricts
the same grant. Self-owned content retains its independent private provenance and
promotion approval path within explicitly recorded series distribution scope.

Publication additionally requires appropriate metadata. Consumer eligibility
additionally requires publication and, for an episode, a ready asset and open
episode window. Existing entitlement/account ownership and age/content review
remain in force. This work does not claim new anonymous age verification.

### Upload integration

Check admission before direct ingestion, minting a signed upload URL, completing
an upload, and new provider submission/retry. Re-fetch relevant state when a prior
upload is completed so rights revoked since upload start cannot proceed. Do not
call object storage or video providers after denied admission. Keep cleanup and
takedown available after expiry/revocation.

Signed-upload Admin endpoints require the corresponding MediaAsset add/change
permissions, in addition to the existing staff and CSRF boundary. Errors are
static and must not disclose contracts, provider data, signed URLs, or file bytes.

## Migration and deployment

Expand the schema only. Preserve IDs, direct text, translations, and historical
rights. Backfill only previously established narrow series distribution scope.
Do not backfill new licensed permissions, storefronts, or language-specific grants
as approved. Existing licensed rows therefore become unavailable until reviewed
privately and explicitly completed. This is a deliberate fail-closed transition.

Deploy additive migrations before the code that reads them. Verify synthetic
migration, catalog, publication, ingestion, playback, and reward cases before any
environment activation. Correct/revert application behavior through a reviewed
change; leave additive columns/data in place. Destructive contraction and further
market activation require separate releases and approvals.

## Verification

- Synthetic decision tables cover valid and inactive configurations, each missing
  permission, split grants, storefront/territory/language/segment mismatches,
  malformed arrays, denylist precedence, windows, takedown, and DRM.
- API tests prove client spoofing cannot widen context, metadata selection is
  explicit, and stable IDs/response shapes survive. Existing access/entitlement
  tests remain the authority for account and grant behavior.
- Upload tests prove denial before external calls, caption restrictions, revoked
  rights between upload start/completion, and model-level staff permissions.
- Migration evidence proves unknown grants stay unapproved and existing content
  IDs/text/translation rows survive.
- Run backend lint, format, types, migrations, tests, repository safety, and
  generated OpenAPI/client checks. Unavailable required checks remain blockers.
- Independent task reviews check specification and code quality; a fresh final
  review checks the complete change and rights/integrity boundaries.

# P3-T01-F1 Editorial Episode Access Design

## Approved task and outcome

P3-T01-F1 follows merged P2-T03-F3 / PR #139. Operators can configure an episode
as free, rewarded-ad, coin, or both ad and coin, with the existing series defaults
used when no override exists. This provides the policy boundary for P3-T02's
future atomic wallet debit. D-005/D-006/D-007/D-008/D-031 and the product brief
already approve this direction. The founder requested orchestration,
implementation, and independent review; no new product choice is required here.

Base: `283241f0f12027dce02eaa7320251cde05a8caa1`. Stay in this checkout on
`codex/p3-t01-f1-episode-access`; no worktrees or automatic merge.

## Global constraints

- Eligibility precedes every entitlement or free grant. Preserve the complete
  same-grant D-031 licensed admission, windows, takedown, protection, and language.
- Anonymous browsing/free playback remains available; monetized unlock requires
  an authenticated account. Client values never grant rights or set a price.
- Keep existing series free-window and ad-disable behavior for inherited rows.
  Dormant AccessPolicy and AccessPolicyRevision rows remain dormant and intact.
- Coin price is a configurable positive integer for coin/both overrides, with no
  commercial value or legal term selected. Coin spending and coin offers remain
  unavailable until P3-T02 supplies the transactional implementation; settings
  alone cannot activate an unimplemented capability. Subscriptions remain out.
- Unknown entitlement sources cannot grant access. Existing valid staff/ad grants
  remain permanent subject to current eligibility.
- Additive migrations only, synthetic fixtures only, no secrets, private payloads,
  licensed assets, contracts, confidential rates, or personal production data.
- Use one highest-level test per behavior; add focused migration, Admin, and true
  transaction-race evidence where a sequential decision table cannot prove it.
- No new mobile commerce screen, wallet, store integration, rollout, or production
  activation. Existing provider/device release obligations remain required.

## Episode configuration and migration

Add `Episode.access_mode`: `inherit` (default), `free`, `rewarded_ad`, `coin`,
or `both`. Add nullable `Episode.coin_price`. Model and database validation
require a positive price for coin/both and no price for other modes. Unknown
modes fail validation. No existing episode receives a price or explicit override.

Inherited behavior still uses `Series.free_episode_count` (per-season order) and
`rewarded_ads_enabled`. Explicit free overrides order; explicit ad/coin/both can
lock an episode inside the default free window. The series ad switch remains a
kill switch even for explicit ad/both. Coin-only remains locked without an
available method; both can expose an available ad.

Add a small catalog editorial revision record for changes to episode policy
inputs and inherited series defaults. Store bounded before/after policy fields,
actor, timestamp, series/episode association, and server policy version where
applicable. Admin can inspect revisions but cannot add, edit, or delete them.
These are configuration audit records, not financial ledger entries. Do not
repurpose dormant legacy policies or silently reinterpret their old overrides.

## Shared policy and offers

Centralize resolution in `apps.entitlements.policy`. A resolved immutable policy
contains effective mode, configured coin price, and a deterministic opaque
version derived from the episode identity and all policy inputs (including
inherited series defaults and episode order). The version changes when those
inputs change; it is not authorization and does not replace fresh rights checks.

Authorize order: current eligibility, explicitly recognized permanent entitlement,
configured free policy, then account/entitlement lock. Unknown source values do
not become staff grants.

Offers preserve the existing `decision`, `episode_id`, `methods`, and lock-reason
shape. Add `policy_version` and nullable `coin_price` server metadata to both
granted/locked responses. These describe current configuration, not a promise
that a coin debit exists. Only implemented and enabled methods appear in
`methods`. Ad availability requires the series switch and provider mode
`test`/`production`; account consent remains enforced before intent/grant so the
existing consent UX can still discover the ad option. No playback URL is returned.

The generated contract and TypeScript client change together. Existing mobile
consumers remain compatible; update their typed fixtures mechanically if needed
without adding duplicate screen tests or new commerce UI.

## Transaction boundary and operator changes

Use a shared catalog parent-lock helper. Mutating access operations acquire the
Series row before the Episode row and then the RewardIntent row, with explicit
`select_for_update(of=("self",))` to avoid implicit joined lock ordering. Preserve
the existing provider-transaction advisory lock and account-identity/profile
locks before catalog locks. Refresh the episode and series after acquiring locks.

All relevant catalog Admin writes participate in the Series parent lock: series
defaults/distribution/takedown, episode changes, rights standalone/inline changes,
and deletion/bulk deletion. Existing parent ownership for Episode, Season, and
ContentRight is immutable in Admin; moving ownership needs a separate reviewed
operation. Inlines acquire their owning series lock through their parent Admin.
Acquire locks before final validation/save and hold through audit writes.

Existing ContentSegment slugs are immutable in Admin, and segment deletion
(including bulk deletion) is unavailable. Slug changes or removal would revoke
active audience membership without a known Series parent; freezing these
operations keeps the transaction boundary simple. Display-name changes and new
segments remain available. Membership changes use the locked Series Admin.

The parent lock serializes cooperating writers. Document the same requirement
for future scripts, APIs, and P3-T02 debits; raw SQL writers are not protected by
an application convention. Callback eligibility is evaluated after lock waits,
using fresh time, so a committed revocation or expired window cannot be bypassed.

## Reward intents and stale state

Add `RewardIntent.policy_version`, blank for historical rows. New intents bind
the current resolved version. Add optional `expected_policy_version` to intent
creation: when supplied, mismatch returns the existing 409 unavailable response.
Old clients may omit it; the server still resolves and binds current policy.
No client price input is accepted. Future P3-T02 must require expected version
and price for debit and compare with fresh server configuration under these locks.

Creation, status, and verified grant recheck the current configured ad method,
provider availability, consent, and rights. A changed version invalidates an
ungranted intent. Historical blank pending intents become unavailable rather than
receiving inferred approval. Existing granted matching callback replays remain
idempotent acknowledgements and never mint another entitlement. Reused request
IDs return their original intent/current status, not a replacement authorization.

## Verification and deployment

One backend decision table covers inherited and explicit modes, guests, valid and
unknown entitlement sources, rights failure, provider disablement, series kill
switch, synthetic price, and version changes. Add focused real reward integration
tests for stale creation/callback versions and legacy pending intents. Preserve
existing duplicate-callback and account-deletion races; test operator revocation
versus callback in both lock orderings and expiry while a callback waits.

Migration rehearsal preserves IDs, old free/ad results, dormant policies/audit
rows, and granted reward evidence. Admin tests prove authorized edits, audit
snapshots, read-only history, and parent locking. Run the full repository gate,
contract regeneration, applicable mobile/bundle checks, and required CI.

Deploy additive migrations before this code. In-flight unversioned ad intents
will require a fresh attempt. Retain added schema and audits on rollback; older
code ignores overrides, so first keep affected episodes draft/taken down and
disable rewards when returning to an old binary. Prefer a forward fix. No
production enablement or destructive contraction is part of this task.

# Editorial episode access (P3-T01-F1)

**Updated 2026-09-07.** Episode overrides extend the existing series defaults.
`AccessPolicy` and its legacy revisions remain dormant and intact. Current
[server launch context and explicit rights admission](catalog-launch-context.md)
always precede access policy. The older operational record below is historical.

## Current operation

Staff use the Episode Admin to set `access_mode` and, for coin/both, a positive
integer `coin_price`. No commercial price is approved by the synthetic development
values. Existing Series Admin fields remain defaults and an ad kill switch:

| Episode mode | Current behavior without an existing entitlement |
|---|---|
| `inherit` | Existing series free count applies to each season; later episodes can offer an enabled ad |
| `free` | Eligible episode is free regardless of its order |
| `rewarded_ad` | Episode is locked, including inside the series free window; authenticated viewers can use an enabled ad |
| `coin` | Episode is locked; coin unlock is available only in explicitly enabled P3-T02 local synthetic tests |
| `both` | Episode is locked; enabled ad and local synthetic coin methods may be offered independently |

`coin_price` is required for coin/both and must be absent otherwise. The initial
series default remains five free episodes. The series ad kill switch and provider
mode both restrict ad offers, including explicit overrides. Anonymous locks return
`login_required` and no monetized methods. Consent is still required before an ad
intent or verified grant; seeing an offer does not create consent or entitlement.

Only recognized staff or verified rewarded-ad entitlements grant access. Every
request first checks current eligibility: a permanent entitlement never overrides
takedown, expiry, unsupported protection, or missing rights. Licensed titles still
need the complete same-grant D-031 free/ad/coin/promotion package even if their
episodes use only one method.

Do not put AdMob unit IDs, secrets, licensed media, contract terms or provider payloads on policy models or into public evidence.

## Versions and stale requests

Offers retain their existing decision, episode ID, methods, and lock reasons and
add `policy_version` plus nullable `coin_price`. The version is an opaque server
hash of the episode and policy inputs, including inherited defaults and order.
The price describes configuration; it is not an available debit or permission.
P3-T02 adds coin methods for explicit local synthetic tests only. Production
spending remains disabled; see [coin-wallet.md](coin-wallet.md).

New reward intents bind the current version. An optional
`expected_policy_version` on creation returns 409 when stale. Existing clients may
omit it; the server binds fresh current policy. Client prices are not accepted.
Changing policy or price makes an ungranted stale intent unavailable, even if an
ad remains configured. A repeated request ID returns the original intent and
current status. Matching already-granted callbacks remain idempotent and never
create another entitlement; playback still rechecks eligibility.

## Operator history and transaction order

Authorized Admin policy changes record bounded before/after values, actor,
timestamp, and version in read-only editorial history. An access change does not
edit or imply legal approval. Existing episode, season, and license ownership
cannot be reassigned through Admin.

Existing content-segment identifiers are also fixed and segment deletion is
unavailable, including bulk deletion. These operations could otherwise revoke
audience eligibility outside the Series lock. Display names remain editable;
new segments can be created and membership changed through the locked Series
Admin, subject to separately approved audience/launch scope.

Catalog Admin mutations and reward grants share a Series parent lock, then an
Episode lock, then a RewardIntent lock where applicable. Reward grants retain
provider-transaction and account/profile serialization before catalog locks.
Standalone edits, inlines, deletion, and bulk deletion participate. Eligibility
and time are refreshed after a lock wait, so a committed revocation takes effect
before a later grant.

Future scripts, APIs, and P3-T02 debits must use the same parent-lock convention
and recheck current rights/method/price inside their transaction. Raw SQL or other
writers that ignore the convention are not protected by these application locks.

## Deployment and remaining MVP work

Apply the additive catalog and advertising migrations before deploying this code.
Old episodes inherit their existing free/ad behavior, no prices are backfilled,
and dormant policies stay dormant. Existing unversioned pending reward intents
become unavailable and require a fresh attempt; granted evidence is retained.

Prefer a forward fix and keep added schema/history. Before rolling back to code
that ignores overrides or version checks, keep affected episodes draft/taken down
and disable rewards. Do not reverse schema as an availability shortcut; destructive
contraction requires a separate release. Historical rollback instructions below
are not current operational guidance.

P3-T02 implements the immutable wallet and atomic debit plus entitlement for
local synthetic tests, requiring current expected version/price under these locks.
P3-T03/T04/T06 still supply verified store funding, and P3-T08-F2 extends the
offer sheet to coin/both. Commercial values/terms remain unapproved under D-008;
production/provider/device release gates remain required. No subscription,
automatic cliffhanger detection, Remote Config experiment, or production activation
is added here. Exact automated evidence and independent review are recorded in
the P3-T01-F1 implementation PR.

## Historical P3-T01 runbook — superseded operation

The original text below records the earlier AccessPolicy implementation and its rollback assumptions. **Superseded by the 2026-09-02 Series configuration and the 2026-09-07 MVP direction; not executable current guidance.** Its P7 coin statement is historical, not current scope.

### Original P3-T01 record

Staff configure the D-006 free window and rewarded-ad availability in Django Admin.
Authorize and `GET /v1/offers/{episode_id}` read the same server policy. The mobile
client is never authoritative for free-window, entitlements, or offers.

**Do not put AdMob unit IDs, secrets, licensed media, or provider payloads on the model.**

## Defaults when the table is empty

No `AccessPolicy` row is required. Missing rows use D-006 defaults:

- First five episodes per season (`Episode.order` 1–5) are free.
- Rewarded ads are on.

Coin and subscription unlock columns exist for P7, stay `False`, and are rejected by
`clean()` and database checks. They never appear as offer method types.

## Changing policy

Saving an `AccessPolicy` in Admin is live on the next authorize or offers request.
There is no draft/publish two-phase. Each save appends an `AccessPolicyRevision`
with the acting staff user.

Clients must not cache `free_episode_order_max` as authority. Query or body
overrides are ignored.

Anonymous locked offers return `login_required` and an empty `methods` list
(D-005: login before a monetized unlock). Authenticated locked episodes include
`rewarded_ad` only when ads are enabled.

## Rollback

Revert the PR. Reverse `0003_accesspolicy_series_level_no_force_flags` first,
then `0002_accesspolicy`. `0002` drops `AccessPolicy` and `AccessPolicyRevision`
only. Neither migration alters `EpisodeEntitlement` or catalog tables.

After revert, authorize must still fail closed: never mint a playback URL on
lock. Do not weaken territory, rights, takedown, or age-rating checks as part of
rollback.

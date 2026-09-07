# Access policy (P3-T01 and planned P3-T01-F1)

**Updated 2026-09-07.** Current implementation uses `Series.free_episode_count` and `Series.rewarded_ads_enabled`; `AccessPolicy`/revision rows are dormant compatibility state after the 2026-09-02 change. P2-T03-F3 adds [server launch context and explicit rights admission](catalog-launch-context.md) before this policy. The older operational instructions below are historical only.

## Current operation

Staff configure the series free count and rewarded-ad availability in Django Admin. Authorize and `GET /v1/offers/{episode_id}` use the same server policy, after current eligibility. The initial default is the first five episodes per season; anonymous locked offers require login and return no ad method. Authenticated locked offers include `rewarded_ad` only when enabled. Clients never set policy or entitlement authority, and missing/ineligible rights never mint playback.

Do not put AdMob unit IDs, secrets, licensed media, contract terms or provider payloads on policy models or into public evidence.

## Planned MVP extension

D-006/D-007/D-008 (2026-09-07) require editorial per-episode **free, rewarded-ad, coin or both** choices. P2-T03-F3 makes France/Android/English active server launch configuration with generalized rights/language/segment dimensions; P3-T01-F1 adds policy and license-permission intersection. P3-T08-F2 extends the offer sheet. No automatic cliffhanger detection or Remote Config requirement.

Existing eligibility precedes entitlement/free access; locked methods intersect operator policy, license permissions and enabled verified provider capability. Revalidate at grant/debit, including stale prices, takedown and rights expiry. Android coins and persistent balances/reconciliation are MVP; subscriptions remain P7. Current code has no coin offers yet.

Use expand/migrate for new configuration and conservative rights backfills; unknown coin/promotion rights are not approval. Do not apply historical rollback instructions to the current schema. Roll back application traffic first and obtain a separately reviewed schema/data plan; destructive contraction remains a later release.

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

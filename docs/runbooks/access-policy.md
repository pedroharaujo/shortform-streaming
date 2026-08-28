# Access policy (P3-T01)

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

Revert the PR. Reverse migration `0002_accesspolicy` drops `AccessPolicy` and
`AccessPolicyRevision` only. It does not alter `EpisodeEntitlement` or catalog
tables.

After revert, authorize must still fail closed: never mint a playback URL on
lock. Do not weaken territory, rights, takedown, or age-rating checks as part of
rollback.

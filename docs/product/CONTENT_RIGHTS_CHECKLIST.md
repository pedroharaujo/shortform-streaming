# Content Rights and Media Delivery Checklist

**Plan task:** P0-T02  
**Status:** Draft for content/legal review

No series may be marked publishable until every mandatory item is recorded and the source contract is referenced outside the public repository. Store contracts, confidential rates, licensed masters, and personal data only in approved private systems.

## Rights package

### Parties and authority

- [ ] Legal licensor name, address, registration details, and authorized contact are verified.
- [ ] Licensor represents that it owns or controls the granted rights and can sublicense every included component.
- [ ] Chain of title and contributor/talent releases are available for audit.
- [ ] Contract identifier and secure storage location are recorded; the contract itself is not committed to Git.

### Grant

- [ ] Title/season/episode identifiers and all alternate/localized titles are enumerated.
- [ ] Rights include mobile application streaming on iOS and Android.
- [ ] Rights explicitly cover the intended countries/territories.
- [ ] Rights cover each required language, subtitle, dub, edit, and localization.
- [ ] Start date, end date, renewal, notice, and post-termination obligations are recorded.
- [ ] Exclusive/non-exclusive status and any platform, genre, audience, or competitor restriction are recorded.
- [ ] Download/offline, web, TV, social, and promotional rights are separately identified; absence means not granted.

### Monetization and promotion

- [ ] Subscription access is permitted.
- [ ] Transactional/coin-based episode access is permitted.
- [ ] Advertising-supported and rewarded-ad access are permitted.
- [ ] Free promotional episodes are permitted.
- [ ] Clips, frames, posters, trailers, and talent likeness may be used in paid acquisition on named networks.
- [ ] Revenue definition, store-fee treatment, taxes, refunds, chargebacks, ad revenue, minimum guarantees, royalties, and reporting cadence are recorded in the private finance system.

### Editorial, compliance, and protection

- [ ] Required age rating, warnings, censorship edits, and prohibited territories are known.
- [ ] Music, voice, likeness, trademarks, locations, stock assets, AI tools/models, and generated content have valid commercial rights.
- [ ] Required attribution, copyright notice, watermark, geoblocking, concurrency, DRM, or forensic watermarking is specified.
- [ ] The planned signed-HLS protection is accepted, or the contract explicitly requires a DRM/provider decision before ingestion.
- [ ] Privacy/personality rights and child-performer requirements are satisfied where applicable.

### Operations and takedown

- [ ] Delivery deadline, acceptance/rejection window, replacement process, and quality warranty are agreed.
- [ ] Rights expiry and renewal alerts have named owners.
- [ ] Takedown contact, valid request channel, response SLA, and emergency procedure are agreed.
- [ ] Treatment of already purchased/unlocked episodes after expiry or termination is explicit.
- [ ] Archive/deletion obligations for masters, renditions, subtitles, analytics, and backups are explicit.
- [ ] Audit, usage reporting, and royalty statement requirements are implementable.

## Required catalog metadata

- Licensor and secure contract reference.
- Canonical and localized title identifiers.
- Territory allowlist/denylist.
- Platform and monetization-method grants.
- Language/subtitle/dub grants.
- Rights start/end and takedown status.
- Exclusivity and promotional-clip permission.
- DRM/protection requirement.
- Revenue-share/reporting rule reference; no confidential rates in public source control.
- Age rating, content warnings, attribution, and editorial restrictions.

## Media delivery specification

### Per series

- [ ] Canonical metadata file with series synopsis, genres, cast/characters, credits, original language, production year, and episode order.
- [ ] Portrait poster and optional landscape/social artwork with documented dimensions and safe areas.
- [ ] Promotional clips and stills are clearly separated from full episodes.

### Per episode

- [ ] Stable external episode ID, season, sequence number, title, synopsis, and duration.
- [ ] 9:16 master at the best available quality, without unintended letterboxing or baked UI.
- [ ] Supported mezzanine codec/container, constant/known frame rate behavior, correct rotation metadata, and synchronized audio.
- [ ] Stereo master at an agreed loudness, with separate language tracks where licensed.
- [ ] WebVTT or approved caption source for every required language, correctly timed and encoded UTF-8.
- [ ] Cryptographic checksum, file size, duration, resolution, frame rate, audio layout, and language tags.
- [ ] No passwords, PII, hidden files, editor project caches, or unrelated assets in the delivery.

### Automated acceptance

- Checksum matches manifest.
- File is readable and duration is within declared tolerance.
- Video is portrait and meets minimum resolution/bitrate/codec rules.
- Audio exists, is synchronized, and passes silence/clipping thresholds.
- Caption files parse and remain within episode duration.
- Episode IDs/order are unique and complete.
- Malware scan passes.

### Human acceptance

- Content operator checks the beginning, midpoint, and ending of every episode.
- Content operator verifies crop, rotation, subtitles, audio language, loudness, and cliffhanger boundary.
- Legal/content owner confirms the delivered cut matches the licensed version.

## Sample-package validation record

Before P0-T02 is complete, evaluate one real or representative supplier package and record:

- Supplier/package identifier:
- Review date and reviewers:
- Rights gaps:
- Media gaps:
- Required contract amendments:
- Required transcoding/editorial work:
- DRM decision:
- Accepted / rejected / conditionally accepted:

# Content Rights and Media Delivery Checklist

**Plan task:** P0-T02  
**Status:** Required per-series publication gate for self-owned and licensed content

The France-only Android MVP may publish one or more English-language series that are either self-owned or properly licensed (D-001, D-004, D-023, D-031, 2026-09-02). Before publication, the founder/content owner must privately record ownership and component provenance or complete the licensed-content rights package, and every media package must pass the delivery checks below.

P2-T03-F2 must enforce the fixed France/Android/English grant for licensed series before this scope is considered implemented. Until that slice lands, licensed-master upload and publication remain blocked. Rights records in this public repository contain only synthetic fixtures or opaque references to private systems—never contracts, rates, production masters, confidential records, provider payloads, or personal data. Once enabled, missing, expired, mismatched, DRM-required, or taken-down grants must fail closed in catalog and playback authorization.

## MVP self-owned provenance

- [ ] Founder/content owner identifies the exact launch series and confirms the company/founder owns or controls every episode and promotional asset.
- [ ] Private provenance records cover scripts, music, voices, likenesses, trademarks, locations, stock assets, and AI tools/models used to create the series.
- [ ] France/Google Play promotional and advertising use is approved for the series, artwork, clips, and stills.
- [ ] Provisional age rating, warnings, credits, and required notices are recorded.
- [ ] The accepted master/caption/artwork package passes the automated and human media checks in this document.

Completion of this section and the media-delivery checks closes the self-owned path for a series. It does not approve any licensed series.

## Licensed-content package

Decision D-019 and every applicable licensor/territory/contract item below must be completed privately before that licensed series is ingested or published. They do not block unrelated self-owned titles or other independently approved licensed series.

### Rights package

### Parties and authority

- [ ] Legal licensor name, address, registration details, and authorized contact are verified.
- [ ] Licensor represents that it owns or controls the granted rights and can sublicense every included component.
- [ ] Chain of title and contributor/talent releases are available for audit.
- [ ] Contract identifier and secure storage location are recorded; the contract itself is not committed to Git.

### Grant

- [ ] Title/season/episode identifiers and all alternate/localized titles are enumerated.
- [ ] Rights include every intended client platform.
- [ ] Rights explicitly cover the intended countries/territories.
- [ ] Rights cover each required language, subtitle, dub, edit, and localization.
- [ ] Start date, end date, renewal, notice, and post-termination obligations are recorded.
- [ ] Exclusive/non-exclusive status and any platform, genre, audience, or competitor restriction are recorded.
- [ ] Download/offline, web, TV, social, and promotional rights are separately identified; absence means not granted.

### Monetization and promotion

- [ ] Advertising-supported and rewarded-ad access are permitted. **Mandatory** before ads-only publication.
- [ ] Subscription access is permitted. **Required before P7 IAP**, not before ads-only publication.
- [ ] Transactional/coin-based episode access is permitted. **Required before P7 IAP**, not before ads-only publication.
- [ ] Free promotional episodes are permitted.
- [ ] Clips, frames, posters, trailers, and talent likeness may be used in paid acquisition on named networks.
- [ ] Revenue definition, store-fee treatment, taxes, refunds, chargebacks, ad revenue, minimum guarantees, royalties, and reporting cadence are recorded in the private finance system.

### Editorial, compliance, and protection

- [ ] Required age rating, warnings, censorship edits, and prohibited territories are known.
- [ ] Music, voice, likeness, trademarks, locations, stock assets, AI tools/models, and generated content have valid commercial rights.
- [ ] Required attribution, copyright notice, watermark, geoblocking, concurrency, DRM, or forensic watermarking is specified.
- [ ] Bunny Stream tokenized HLS is accepted, or the contract explicitly requires certified DRM / a different provider before ingestion.
- [ ] Privacy/personality rights and child-performer requirements are satisfied where applicable.

### Operations and takedown

- [ ] Delivery deadline, acceptance/rejection window, replacement process, and quality warranty are agreed.
- [ ] Rights expiry and renewal alerts have named owners.
- [ ] Takedown contact, valid request channel, response SLA, and emergency procedure are agreed.
- [ ] Treatment of already purchased/unlocked episodes after expiry or termination is explicit.
- [ ] Archive/deletion obligations for masters, renditions, subtitles, analytics, and backups are explicit.
- [ ] Audit, usage reporting, and royalty statement requirements are implementable.

## Licensed catalog metadata

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
- For self-owned content, the founder/content owner confirms the delivered cut is the approved launch version.
- For licensed content, the legal/content owner confirms the delivered cut matches the licensed version.

## Sample-package validation record

Before admitting licensed content, evaluate the real supplier package in the approved private rights system. Keep only its opaque reference in the public repository; do not record the supplier identity, gaps, contract amendments, rates, provider payloads, personal data, or licensed media here.

- Supplier/package identifier:
- Review date and reviewers:
- Rights gaps:
- Media gaps:
- Required contract amendments:
- Required transcoding/editorial work:
- DRM decision:
- Accepted / rejected / conditionally accepted:

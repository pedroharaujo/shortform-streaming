# Self-Owned Content Provenance and Media Delivery Checklist

**Plan task:** P0-T02  
**Status:** MVP self-owned-content gate; third-party licensing section deferred beyond MVP

The France-only Android MVP publishes exactly one self-owned English-language series (D-001, D-004, D-023, 2026-09-01). It does not require a licensor, license agreement, royalty terms, contract-driven territorial rights, or custom DRM. Before publication, the founder/content owner must privately record ownership and component provenance and the media package must pass the delivery checks below.

Legacy rights/territory tables remain only as dormant database-compatibility state until a later destructive schema contraction. They are not used by the MVP API, Admin, or authorization path. MVP completion requires no multi-territory or licensed-content implementation. The public repository must contain only approved short self-owned/generated fixtures, never production masters, confidential records, or personal data.

## MVP self-owned provenance

- [ ] Founder/content owner identifies the exact launch series and confirms the company/founder owns or controls every episode and promotional asset.
- [ ] Private provenance records cover scripts, music, voices, likenesses, trademarks, locations, stock assets, and AI tools/models used to create the series.
- [ ] France/Google Play promotional and advertising use is approved for the series, artwork, clips, and stills.
- [ ] Provisional age rating, warnings, credits, and required notices are recorded.
- [ ] The accepted master/caption/artwork package passes the automated and human media checks in this document.

Completion of this section and the media-delivery checks closes the MVP portion of P0-T02. The licensing material below is retained for a later decision to admit third-party content and is **not an MVP gate**.

## Future licensed-content package (post-MVP)

Decision D-019 and every licensor/territory/contract item below apply only before future licensed-media ingestion. They do not block the self-owned MVP catalog or production video-provider configuration for that catalog.

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

## Future licensed catalog metadata (post-MVP)

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
- For the self-owned MVP, the founder/content owner confirms the delivered cut is the approved launch version.
- For future licensed content, the legal/content owner confirms the delivered cut matches the licensed version.

## Sample-package validation record

Before admitting future licensed content, evaluate one real or representative supplier package and record. This validation is post-MVP and does not block the self-owned launch:

- Supplier/package identifier:
- Review date and reviewers:
- Rights gaps:
- Media gaps:
- Required contract amendments:
- Required transcoding/editorial work:
- DRM decision:
- Accepted / rejected / conditionally accepted:

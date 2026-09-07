# Content Rights and Media Delivery Checklist

**Plan task:** P0-T02  
**Status:** Required per-series publication gate for self-owned and licensed content

The France-only Android MVP may publish approximately 3–5 independently approved English-language series that are either self-owned or properly licensed (D-001, D-004, D-023, D-031, updated 2026-09-07). Before publication, the founder/content owner must privately record ownership and component provenance or complete the licensed-content rights package, and every media package must pass the delivery checks below.

Implementation evidence: P2-T03-F2 enforces the current France/Android/English context in Admin, catalog and playback. D-034 makes these active launch configuration; P2-T03-F3 must preserve generalized market/language/segment and per-license monetization dimensions without widening client authority. The new coin/promotion scope is planned under P2-T03-F3/P3-T01-F1, not implemented by this documentation update. Rights records in this public repository contain only synthetic fixtures or opaque references to private systems—never contracts, rates, production masters, confidential records, provider payloads, or personal data. Missing, expired, mismatched, DRM-required, or taken-down grants fail closed in catalog and playback authorization; the private package and media review remain human gates before licensed-master ingestion.

## Commercial target (D-033, 2026-09-07)

Prefer €0 upfront license cost, €0 minimum guarantee where possible, revenue share and non-exclusive licenses where possible. This is a negotiation target, not a publication shortcut or technical restriction; other licensing structures remain supported. Revenue share and localization/delivery still create content cost even with zero upfront/MG. Store all actual terms, percentages, rates, supplier information and signed agreements privately, referenced only by opaque IDs here.

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
- [ ] Rights explicitly include Android / Google Play for MVP; other platforms remain separately scoped.
- [ ] Rights explicitly cover France for MVP; retain territory allow/deny scope for later markets.
- [ ] Rights cover required English originals/subtitles/dubs and every intended edit/localization; retain separate language grants.
- [ ] Start date, end date, renewal, notice, and post-termination obligations are recorded.
- [ ] Exclusive/non-exclusive status and any platform, genre, audience, or competitor restriction are recorded.
- [ ] Download/offline, web, TV, social, and promotional rights are separately identified; absence means not granted.

### Monetization and promotion

- [ ] Advertising-supported and rewarded-ad access are permitted. **Mandatory for each MVP licensed title**.
- [ ] Subscription access is separately recorded; permission is **required only before post-MVP subscription access**, not for MVP admission. Missing permission means no subscription rights.
- [ ] Transactional/coin-based episode access is permitted. **Mandatory for each MVP licensed title**, including operator-configured coin-only episodes.
- [ ] Free episodes are permitted. **Mandatory for MVP**.
- [ ] Paid advertising/user acquisition is permitted, including clips, trailers, posters, stills/frames and relevant talent likenesses on the intended networks, with edit, duration, window and audience restrictions recorded. **Mandatory for MVP licensed titles and before any creative is used**; without this grant the CAC experiment cannot use that title.
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

Every MVP licensed title needs the full free/rewarded-ad/coin/paid-promotion rights package even when an individual episode uses only one access method. Runtime offers and grant/debit checks must intersect operator policy with applicable license permissions; absence is not permission. Private commercial approval and runtime eligibility are separate gates.

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

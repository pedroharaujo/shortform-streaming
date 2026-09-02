# Development privacy setup: P6-T04/P6-T05A / #98

This is the execution checklist for the founder-authorized notice/consent work,
not production approval. D-028 (2026-08-31) defers this setup from P3-T07/PR #97
to release issue #98, superseding #96. It does not block subsequent MVP coding.
The notice remains a draft until the checks below pass; setup still precedes any
publisher-owned ad test. D-020, D-025, public testers and store disclosures remain
unresolved. Do not ask for operator/contact facts to continue unrelated coding.

## Decisions taken for the restricted test

Use one English notice with the temporary name Shortform Streaming (Development).
Do not wait for final branding or buy a domain. Keep source in the existing public
repository; use a rendered document URL only after the exact page passes Google's
policy-page requirements. A GitHub URL is a candidate, not guaranteed acceptance.
A plain static document is the fallback; no consumer web client is needed.

Use the founder-controlled Android emulator, a synthetic Google account in the
local Auth emulator/database, and generated media only. Do not use a real Google
account, onboard public testers, or activate production ads.

Select a manual cleanup deadline: close the experiment when complete or abandoned,
then clear its dedicated local state within seven days of its final attempt.
This is a new operational proposal, not proof of automatic cleanup or a change
to production retention. Do not silently extend an abandoned experiment.

## Before activating the notice

- [ ] Founder supplies the public operator name and a monitored contact. Use the
  actual individual if they operate the test; do not invent a registered company,
  address or DPO. Confirm any applicable representative/contact details.
- [ ] Check notice claims against the actual next run, including account/guest
  progress, deletion receipts, SDK version, Google partner disclosures and all
  external services. Confirm the stated purpose/bases for this restricted test;
  do not describe broader processing as approved.
- [ ] Confirm a workable closeout owner and scope. Record the final-attempt date
  in private test notes. At closeout, stop owned services; inventory only the
  dedicated DB/emulator/export paths; verify their exact identities and ownership
  before deletion. Do not delete shared databases, emulator data or media used by
  other tasks. Use a separately scoped cleanup action; no broad recursive command.
  Verify no test backups/exports survive, or document the exception before use.
- [ ] Recheck ngrok capture off, exports absent and metadata retention. Check
  relevant Google/Bunny service terms/settings and applicable international
  processing safeguards; do not substitute an EU company address for residency.
  If facts differ or cannot support the notice, revise it before activation.
- [ ] Complete all three notice markers and remove draft/proposed/review-only
  statements after validating them. Retain an honest account of limitations.
  Save a dated final version separately as `docs/privacy/DEVELOPMENT_PRIVACY_NOTICE.md`;
  never pass `DEVELOPMENT_PRIVACY_NOTICE_DRAFT.md` to AdMob.
- [ ] Confirm the public URL returns the final readable document without login
  on a mobile-sized view, uses HTTPS, contains working privacy links, and has no
  consent-requiring scripts or Funding Choices tag. Inspect the surrounding host
  page too. Do not assume a Markdown file controls GitHub's page scripts. If it
  fails, publish a plain static document instead and retest before using its URL.

## AdMob message settings

Privacy & messaging → European regulations → Create message:

1. Name: `Shortform development consent`.
2. Select only **Shortform Streaming (Development), Android**. Leave both unrelated
   SmartBite+ apps unselected and all-app/fallback deployment switches unchanged.
3. Privacy-policy URL: the checked final document URL, never a placeholder.
4. Default language: **English**. No additional languages for this English test.
5. **Do not consent: On**, everywhere this message appears. Consent and Manage
   options remain available. **Close (do not consent): Off**; a direct refusal
   choice is already present.
6. Target **EEA, UK and Switzerland**. The current test is in France. Do not move
   the test outside the regulated region to avoid consent, and do not add runtime
   debug-geography bypasses merely to make the request succeed.
7. Inspect the displayed partner/purpose list. The initial editor showed an
   account-level list, not a Google-only configuration. Do not silently change
   account-wide vendors, consent mode or purposes affecting other apps. If this
   scope requires changing them, prepare that separate change for review first.
8. Check the full preview, policy link and refusal/manage paths. Publish only the
   completed development message. A published message is not proof of compliance
   or of a successful rewarded-ad callback.

## Repeat the native observation

Open a fresh bounded callback-service window per `rewarded-ads.md`; retain all
emulator/build, consent, exact-unit and server-signature safeguards. Observe
accept/refusal/manage/withdrawal behavior; do not equate refusal with no network
traffic. Complete a labeled Test Ad and verify one genuine Google SSV, one
entitlement and fresh authorized generated-media playback. No manual grant.
Record redacted facts only. Stop services afterward. #98 stays open until its
full evidence requirements are met, including replay/expiry/revocation behavior.

## Sources and review scope

- [AdMob policy URL requirements](https://support.google.com/admob/answer/10113106)
- [AdMob message settings](https://support.google.com/admob/answer/10113207)
- [Account-level GDPR settings](https://support.google.com/admob/answer/10113004)
- [Google EU consent policy](https://www.google.com/about/company/user-consent-policy/)
- [Google SDK disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure):
  current page describes a newer SDK than installed 24.6.0; use as a category
  reference, not an audited list of fields emitted by this test binary.
- [CNIL transparency requirements](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence)

Independent fact/scope research completed using the CTO/founder skills. A separate
Superpowers reviewer checked the draft and checklist against the code and primary
guidance: no Critical/Important findings; approved as an inactive draft only.
`python scripts/check_repository_foundation.py` passed (safety scan, 49 tests,
AI governance); `git diff --check` passed. This engineering review is not a legal
opinion or a Google approval. Final completed text/settings still need the
publication checks above; no notice or consent message was activated here.

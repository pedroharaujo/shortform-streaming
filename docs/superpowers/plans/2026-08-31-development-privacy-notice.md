# Development privacy notice implementation plan

**Scope update, 2026-08-31 (D-028):** Task 1 is complete. Task 2 is deferred to
release issue #98 (P6-T04/P6-T05A), superseding #96. Missing operator/contact facts
do not block PR #97 or continued MVP coding. The draft stays inactive.

> **For agentic workers:** Use Superpowers executing-plans for this documentation
> slice, with the requesting-code-review reviewer template before publication.

**Goal:** Prepare an accurate notice and exact consent setup for P3-T07-F1 / #96.

**Architecture:** A versioned document and a separate operator checklist; no
consumer frontend, new infrastructure, SDK changes or production activation.

**Tech stack:** Markdown, existing repository gates, AdMob dashboard after the
publication prerequisites pass.

## Global constraints

- Only the development Android app, founder-controlled emulator, synthetic
  email/password accounts and generated media.
- Never invent operator/contact details, provider retention or transfer claims.
- No changes to D-020/D-025, account-wide AdMob settings or production gates.
- Never publish the draft as an active policy or merge automatically.

## Task 1: Draft and independently review the notice

Files: `docs/privacy/DEVELOPMENT_PRIVACY_NOTICE_DRAFT.md`,
`docs/runbooks/development-privacy-setup.md`, `docs/README.md`.

- [x] Read CTO/founder skills and authoritative project constraints; ask two
  independent agents for technical facts and minimal scope/provider guidance.
- [x] Draft the notice with explicit operator/contact/effective-date markers,
  actual data flows, privacy choices, retention/deletion limitations and links.
- [x] Write exact publication/CMP/cleanup steps and identify facts that cannot
  be established by agents. Do not turn future process decisions into completed
  implementation evidence.
- [x] Request read-only independent review against this design and actual code;
  fix important findings and repeat review if the material claims change.
- [x] Run `python scripts/check_repository_foundation.py` and `git diff --check`;
  record results, save on the existing P3-T07 branch and update #96 evidence.

Validation: repository safety scan, 49 repository tests and AI governance passed;
whitespace passed. Independent review found no Critical/Important issues and
approved the inactive draft only. It did not approve activation or production.

## Task 2: Activate only after the draft is complete

- [ ] Obtain operator identity and monitored public contact from the founder;
  complete the notice and validate the factual scope/retention procedure.
- [ ] Verify the exact public document URL and provider-setting checks described
  in the runbook; no sign-in requirement or consent-requiring document scripts.
- [ ] Publish the completed notice and the app-specific consent message using
  the runbook's settings; do not publish the draft markers or unrelated apps.
- [ ] Open a new bounded callback-service window and repeat the native test.
  Record consent/refusal, genuine SSV, one entitlement and fresh playback only
  when observed. Keep release issue #98 open until its required evidence is complete.

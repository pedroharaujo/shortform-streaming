# ADR 0001: Use a Public Monorepo

- **Status:** Accepted
- **Date:** 2026-08-23
- **Decision owner:** Founder/engineering

## Context

A small team will change Django, mobile, infrastructure, and API contracts together. Separate repositories would add coordination and versioning before those costs produce value. The repository has already been created publicly.

## Decision

Keep backend, mobile, generated API client, infrastructure, tests, and documentation in `pedroharaujo/shortform-streaming`.

Because the repository is public:

- never commit secrets, real environment files, licensed masters/renditions, confidential contracts/rates, store/provider payloads, or personal data;
- require secret/dependency/security scanning;
- protect `main` and use pull requests once repository protection is configured;
- keep private operational material in approved provider consoles or private storage and reference it by opaque ID only.

## Consequences

- Cross-client changes can be reviewed and tested atomically.
- CI must be path-aware to control runtime.
- Public-source hygiene becomes a release requirement.
- Deployments remain independent even though source is shared.

## Reconsider when

A team or component has independent access-control, release, compliance, or lifecycle requirements that cannot be safely enforced in this repository.

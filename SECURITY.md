# Security Policy

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected vulnerability, leaked secret, rights leak, or exposed personal/confidential data.

Until a private disclosure channel is configured, contact the repository owner directly through an authenticated private channel and include only the minimum information needed to reproduce the issue. Do not include real credentials or personal data in the first message.

Before public beta, replace this temporary process with a dedicated security contact or GitHub private vulnerability reporting and record the response SLA.

## Security priorities

Highest-priority reports include:

- unauthorized access to paid or territory-restricted content;
- forged/replayed purchase, coin, subscription, or rewarded-ad grants;
- account takeover, object-level authorization failure, or deletion failure;
- exposed credentials, signed media URLs, provider payloads, contracts, or personal data;
- admin access-control or audit-log bypass;
- supply-chain or deployment-identity compromise.

## Supported versions

The project is pre-release. Only the latest `main` and active release candidate are supported. A version policy will be published before public launch.

## Implemented request boundary

Consumer API commands under `/v1/` accept JSON bodies capped at 64 KiB. Oversized
or unsupported command bodies fail before view mutation with a static error
envelope; a bounded parser also covers streams without a trustworthy declared
length. Firebase Bearer credentials are rejected before verification when they
exceed 4 KiB or contain non-ASCII, non-printable, or whitespace characters.
Bodies and credentials are never reflected in errors.

These controls reduce parser and verifier exposure; they are not DDoS protection
or distributed rate limiting. Firebase App Check, edge abuse controls, Admin
MFA/SSO exposure restrictions, and the complete staging authorization matrix are
still required by P5-T05 before release.

## Implemented Admin boundary

Production Django Admin sessions use secure, HttpOnly, Lax SameSite cookies
scoped to `/admin/`, expire after one hour of inactivity or browser close, and
keep CSRF state in the server-side session. Built-in staff-password validation
requires at least 12 characters and rejects common, numeric-only, or
user-similar values. Django User and Group administration is superuser-only;
ordinary staff roles still use model-level view/add/change/delete permissions.

Cloud Run remains internal-only. These controls do not claim provider-backed
MFA/SSO, edge login abuse protection, or completion of the live staging
authorization matrix; all remain release requirements under P5-T05.

## Public-repository response

If a secret or confidential asset is committed:

1. Revoke/rotate it immediately; removing Git history is not sufficient.
2. Preserve required audit evidence privately.
3. Remove public access and assess forks/caches/artifacts.
4. Follow the incident runbook and notification obligations.
5. Add a prevention control and regression test.

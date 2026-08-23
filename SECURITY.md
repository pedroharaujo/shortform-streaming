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

## Public-repository response

If a secret or confidential asset is committed:

1. Revoke/rotate it immediately; removing Git history is not sufficient.
2. Preserve required audit evidence privately.
3. Remove public access and assess forks/caches/artifacts.
4. Follow the incident runbook and notification obligations.
5. Add a prevention control and regression test.

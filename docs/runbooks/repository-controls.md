# Repository Controls Runbook

P1-T01 combines versioned controls with GitHub settings. The repository files create the `Repository safety` workflow and its `Repository foundation` check; the remote settings below must be configured and independently verified by the orchestrator or repository owner.

## Required `main` ruleset

Configure a branch ruleset targeting the default branch, `main`, with:

- pull requests required before merge;
- at least one approval and dismissal of stale approvals after new commits;
- review from the owner in `CODEOWNERS` required for owned paths;
- all review conversations resolved;
- the `Repository foundation` status check required and the branch required to be current before merge;
- branch deletion and force pushes blocked, including for administrators where GitHub permits;
- bypass access limited to an explicitly documented emergency role.

Do not make the path-filtered `AI governance` workflow a required check by itself: GitHub may not create that check for unrelated changes. The always-running `Repository foundation` check executes the same governance validator on every pull request.

## Required repository security settings

Verify and record evidence that:

- repository visibility is public and the default branch is `main`;
- GitHub secret scanning and push protection are enabled;
- dependency graph, Dependabot alerts, and Dependabot security updates are enabled;
- Actions are limited to required read permissions by default;
- private vulnerability reporting replaces the temporary disclosure route before public beta.

The committed scanner is a fast local and CI backstop. GitHub secret scanning and push protection remain required because they cover additional credential providers and pushes that never reach the normal pull-request workflow.

## Evidence and recovery

Record the exact ruleset revision and a redacted screenshot or authenticated API response in the P1-T01 pull request. Never include tokens, repository secrets, provider payloads, or personal data in evidence.

If a workflow incident blocks urgent remediation, keep the pull-request requirement active, document the exception, and restore the required check immediately after a narrowly scoped fix. If an actual credential is exposed, follow `SECURITY.md`; deleting the commit is not a substitute for rotation.

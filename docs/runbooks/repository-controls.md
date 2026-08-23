# Repository Controls Runbook

P1-T01 combines versioned controls with GitHub settings. The repository files create the `Repository safety` workflow and its `Repository foundation` check; the remote settings below must be configured and independently verified by the orchestrator or repository owner.

## Required `main` ruleset

Configure a branch ruleset targeting the default branch, `main`, with:

- pull requests required before merge;
- all review conversations resolved;
- the `Repository foundation` status check required and the branch required to be current before merge;
- branch deletion and force pushes blocked, including for administrators where GitHub permits;
- no routinely usable bypass; any emergency role must be explicitly documented and limited to incident recovery.

### Solo-founder review mode

While the repository has only one human collaborator capable of reviewing, configure required approving reviews to `0` and do not require a `CODEOWNERS` review. GitHub does not permit the pull-request author to approve their own pull request, so requiring either control in this state would make every merge depend on a routine bypass. Pull requests, an up-to-date branch, the `Repository foundation` check, resolved conversations, and the deletion and force-push protections remain mandatory.

Independent implementer, reviewer, and verifier agent records remain required development evidence. They do not count as, and must not be represented as, a human GitHub approval.

As soon as a second trusted human reviewer is added, make the transition as one controlled change. First add that human or trusted team, with the repository access GitHub requires (including write access when required), to every applicable pattern in `CODEOWNERS`. Validate coverage, then confirm that a pull request from the founder and a pull request from the new collaborator would each have an independent, eligible human code owner and reviewer. Only after those checks pass, update the `main` ruleset to require at least one approving review, dismiss stale approvals after new commits, and require review from the applicable owner in `CODEOWNERS`. Do not enable a partial configuration that would leave either author without an eligible independent reviewer. This transition is also a mandatory gate before operating as a team or starting beta, when either milestone is applicable; reviewer capacity must be resolved first.

Do not make the path-filtered `AI governance` workflow a required check by itself: GitHub may not create that check for unrelated changes. The always-running `Repository foundation` check executes the same governance validator on every pull request.

## Required repository security settings

Verify and record evidence that:

- repository visibility is public and the default branch is `main`;
- GitHub secret scanning and push protection are enabled;
- dependency graph, Dependabot alerts, and Dependabot security updates are enabled;
- Actions are limited to required read permissions by default;
- private vulnerability reporting replaces the temporary disclosure route before public beta.

The committed scanner is a fast local and CI backstop. The workflow checks out complete history and scans the exact base-to-head range supplied by each pull-request or push event, so a credential cannot be hidden by deleting it in a later commit. Workflow Actions are pinned to verified full commit SHAs and run with read-only repository permission and a ten-minute timeout.

Before pushing, run:

```shell
git fetch origin main
python scripts/scan_secrets.py --history-range origin/main..HEAD
python scripts/check_repository_foundation.py
```

Do not use a shallow checkout for the history check. The scanner fails closed for missing revisions, symlinks, non-text content, prohibited delivery media, and files above 2 MiB. Any future generated/self-owned media fixture requires a narrow path allowlist plus provenance and a regression test; `git add --force` is not an exception.

GitHub secret scanning and push protection remain required because they cover additional credential providers and pushes that never reach the normal pull-request workflow.

## Evidence and recovery

Record the exact ruleset revision and a redacted screenshot or authenticated API response in the P1-T01 pull request. In solo-founder mode, the evidence must show zero required approving reviews, no required `CODEOWNERS` review, and the remaining mandatory protections. Record the date and responsible owner for rechecking the second-reviewer transition. At transition, record the effective `CODEOWNERS` revision, relevant collaborator or team access, pattern coverage, and the eligibility check for pull requests authored by either human before recording the hardened ruleset. Keep independent agent review and verification evidence separate from human GitHub approval evidence. Never include tokens, repository secrets, provider payloads, or personal data in evidence.

If a workflow incident blocks urgent remediation, keep the pull-request requirement active, document any emergency-role use, and restore the required check immediately after a narrowly scoped fix. Emergency access is not a routine substitute for the configured review mode. If an actual credential is exposed, follow `SECURITY.md`; deleting the commit is not a substitute for rotation.

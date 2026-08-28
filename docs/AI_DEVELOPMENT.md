# AI development workflow

Codex and Cursor both start from the root `AGENTS.md`. That file is the shared
project overlay: repository map, documentation authority, product invariants,
commands, and workflow routing.

Generic software-engineering methodology is provided by the **Superpowers**
plugin in each harness. It is not copied into this repository.

## Install Superpowers

Install Superpowers once per harness. Do not vendor, clone, or reproduce it
inside this application repository.

- **Cursor:** Agent chat `/add-plugin superpowers`, or search "Superpowers" in
  the plugin marketplace.
- **Codex app:** Plugins sidebar → Coding → Superpowers.
- **Codex CLI:** `/plugins`, search Superpowers, install.

After install, start a new session from the repository root so `AGENTS.md` and
the plugin skills reload.

Codex may keep `.codex/config.toml` for harness limits such as concurrent
subagent threads. Do not add duplicate project-agent role definitions there.

## Routing

`AGENTS.md` decides when to work directly and when to use Superpowers.

- Level 1 / trivial work: inspect, change, test. No Superpowers loop.
- Level 2 / normal features: lightweight plan; Superpowers only if useful.
- Level 3 / large or high-risk work: Superpowers plan → implement → review →
  verify.

The user's explicit "do this directly" or "use Superpowers" instruction always
wins. Project constraints in `AGENTS.md` override Superpowers defaults,
including: no extra git worktrees, and the testing policy in `CONTRIBUTING.md`.

## Optional GitHub labels

`.github/labels.yml` defines optional tracking labels (`ai-ready`,
`ai-in-progress`, `ai-review`, `ai-verified`). They are convenience markers,
not a required state machine and not a substitute for Superpowers.

Create or update them when repository administration is available:

```text
gh label create ai-ready --color 1D76DB --description "Bounded issue ready to implement" --force
gh label create ai-in-progress --color FBCA04 --description "Implementation is in progress" --force
gh label create ai-review --color D4C5F9 --description "Review or fix loop is active" --force
gh label create ai-verified --color 0E8A16 --description "Verification and required checks passed" --force
```

## Pull requests and verification

A draft PR may be opened during implementation. Mark it ready when acceptance
criteria map to evidence, blocking findings are resolved, required CI passes,
and deployment, rollback, documentation, and sensitive-data checks are complete.

Never merge automatically. Agent review is not a human GitHub approval.

Cursor Bugbot guidance is in `.cursor/BUGBOT.md`. Bugbot is an additional
reviewer, never a replacement for required checks.

## Repository gates

Run `python scripts/validate_ai_governance.py` after changing AI workflow
files. The `AI governance` workflow runs the same check and does not duplicate
application CI.

Application CI is the always-reporting `Application CI` GitHub Actions gate
(path-aware backend, mobile, container, and dependency review, with OpenAPI
contract remaining a separate always-on workflow). Local `pnpm check` remains
the aggregate developer command. CI maps the same backend and mobile scripts
plus coverage, `pnpm mobile:bundle:check`, and a credential-free `docker build`.

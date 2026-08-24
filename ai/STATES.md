# AI task states

The declarative label definitions live in `.github/labels.yml`.

| Label | Meaning | Entry gate | Exit gate |
| --- | --- | --- | --- |
| `ai-ready` | Approved and safe for an agent to start. | Acceptance criteria, dependencies, decisions, and validation plan are complete. | Orchestrator assigns an isolated branch in the existing checkout. |
| `ai-in-progress` | Implementer owns the bounded change. | `ai-ready` gate passed. | Implementation and self-check evidence are complete. |
| `ai-review` | Independent review/fix loop is active. | Implementer hand-off exists. | No BLOCKER/MAJOR findings remain. |
| `ai-verified` | Independent verification and required CI passed. | Review is clear and verifier tested the final revision. | PR is merged/closed or verification becomes stale. |

Only one state label should be present at a time. A blocked task keeps its current state and gains the normal `blocked` label; its issue comment must name the blocker.

Any implementation fix after `ai-verified` moves the task back to `ai-review` and requires fresh verification.

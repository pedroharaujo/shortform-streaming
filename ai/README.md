# AI development system

This directory is the tool-neutral source of truth for the repository's multiagent development process.

- `roles/` defines responsibilities, boundaries, inputs, and outputs. Core roles are orchestrator, planner, implementer, reviewer, and verifier.
- `workflows/development-loop.md` defines the state machine and hand-offs, including the serial `plan -> implement -> review -> fix -> verify -> PR` order.
- `STATES.md` defines the GitHub label contract.

Codex adapters live in `.codex/agents/`; Cursor adapters live in `.cursor/agents/`. If an adapter and this directory disagree, update the adapter to match this directory.

See `docs/AI_DEVELOPMENT.md` for operating instructions.

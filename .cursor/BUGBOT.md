# Bugbot review rules

Read `AGENTS.md`, the linked task/acceptance criteria, and applicable product documents/ADRs before reviewing.

Prioritize actionable correctness findings over style:

- reject behavior that depends on an unapproved decision-register entry;
- verify authentication, authorization, validation, error handling, rate/abuse controls, and negative tests for API changes;
- verify idempotency, transaction safety, reconciliation, and retry/duplicate handling for purchases, coins, rewards, entitlements, and webhooks;
- verify rights, territory, availability-window, takedown, and age-rating enforcement before playable content is returned;
- verify expand/migrate/contract safety and rollback for database changes;
- verify OpenAPI and generated client compatibility together;
- flag secrets, licensed assets, confidential data, provider payloads, or personal/production data in code and evidence;
- flag missing tests for acceptance criteria and failure paths.

Classify findings as BLOCKER, MAJOR, MINOR, or NIT. Do not approve while BLOCKER or MAJOR findings remain. Bugbot approval does not replace the independent verifier.

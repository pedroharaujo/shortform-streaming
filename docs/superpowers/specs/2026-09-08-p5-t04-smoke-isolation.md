# P5-T04 / #101: isolate the HTTP staging smoke job

This is the bounded engineering part of issue #101. The founder does not need
to supply credentials for implementation or local validation. Live access and
rotation evidence remain required before claiming P5-T04 complete.

The staging smoke script uses Python's standard library to fetch a metadata
identity token and call the candidate health endpoints. Its shared Django
identity and injected Django/database/provider secrets are unnecessary.

Give smoke a dedicated `shortform-smoke` service account with repository-scoped
Artifact Registry reader and service-scoped Cloud Run invoker only. Scope the
deploy account's additional `serviceAccountUser` grant to that account. Prevent
the configurable Django runtime account ID from colliding with the smoke ID.
Do not change ingress, token audience, image ownership, CI promotion or retries.

Add an explicit job-module option to disable all Django, database, Firebase and
optional video-provider environment injection. It defaults to enabled, preserving
service/migrate behavior. Smoke disables it and supplies no backend settings.
The disabled option must also suppress injection when a caller supplies Bunny
settings and numeric secret selectors. Secret-reference output must be empty.

Migration still loads production settings requiring Django/database/Firebase and,
when enabled, Bunny settings. Retain its existing configuration and shared service
identity in this slice. Consumer-specific migration privileges, secret-version
authorization, credential overlap and provider rotation are separate #101 work.
No live cloud changes, private state, secret reads, provider changes or deployment.

Acceptance: mocked resource plans render no smoke environment/secret references;
repository policy tests allow exactly the two scoped smoke grants and scoped
deploy actAs; default and pinned migration/service secret configuration remains
unchanged. Document effective-IAM checks, prior job execution drain, candidate
smoke and failure/no-promotion as required live gates.

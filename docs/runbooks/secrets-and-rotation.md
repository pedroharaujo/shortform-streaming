# Secrets, configuration, and rotation (P5-T04 foundation)

This is a **local code/configuration acceptance slice**, not evidence of a live
rotation. No credentials or secret values belong here. P5-T03's live WIF apply,
GitHub Environments, first deployment, failed-smoke/no-promotion, traffic rollback
and untrusted-fork proof remain required in [staging-deploy.md](staging-deploy.md).
Follow-up: [P5-T04 / #101](https://github.com/pedroharaujo/shortform-streaming/issues/101).
P5-T04 remains open until environment isolation, access restrictions, overlap,
actual staging rotation and old-value revocation are independently observed.

## Ownership and environment boundary

Engineering owns runtime references, deployment, access review and the evidence
record. The provider/account owner creates and revokes provider credentials; the
database owner handles database identities. The release owner approves the exact
staging drill and rollback window before any external action. Record named
operators privately; role names here do not assert that accounts are configured.

Development uses emulators/local dummy values. Staging and production must use
separate projects, databases/identities, provider libraries/accounts or isolated
apps, Secret Manager namespaces, WIF identities and build profiles. Identical
secret IDs in separate projects are fine; copying values between environments is
not. Production provisioning/activation still follows the existing release gates;
this runbook grants no legal, region, retention, provider-account or budget scope.

## Inventory (names only)

| Name / configuration | Purpose, storage and consumer | Owner; rotation / overlap / rollback |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` → `django-secret-key` | Secret Manager; Django service and migration settings; currently also injected into smoke. Signs Django material and staff-upload HMAC. | Engineering. **Do not rotate through this foundation alone.** No overlap implementation is added. Assess Django sessions/signatures and `upload_views.py` / `objectstore.py` HMAC compatibility together; old/new revisions may reject each other's material. Rollback to the old revision/key only while safe and enabled. |
| `DATABASE_URL` → `database-url` | Secret Manager; PostgreSQL connection for Django/migrate; currently also injected into smoke. Never put the password-bearing URL in tfvars or build args. | Database owner + engineering. Use independently valid old/new database identities only after privileges, pooling and migration ownership are reviewed. Verify both during overlap, adopt the new identity, drain old connections, then revoke old login. Resetting one user's password does **not** provide overlap. Rollback requires the old login to remain valid. |
| `BUNNY_STREAM_API_KEY` → `bunny-stream-api-key` (configurable name) | Secret Manager; Bunny ingestion/management through backend; service/jobs receive it only with `video_provider = "bunny"`. | Provider owner + engineering. Confirm provider-supported independent credentials/overlap before regenerating anything. Validate ingestion/status/takedown with generated media. If only immediate replacement is possible, stop the zero-downtime drill and prepare a separately approved procedure. Rollback needs an independently valid old credential. |
| `BUNNY_STREAM_TOKEN_KEY` → `bunny-stream-token-key` (configurable name) | Secret Manager; short-lived CDN authorization. Name is an explicit extra by default; no grant while Bunny is disabled. | Provider owner + engineering. Verify CDN acceptance of overlapping keys, cached manifests and outstanding URL expiry before rotation. Current backend config selects one signing key. No dual-key support is asserted. Reverting an app revision is insufficient if the provider invalidated its key. |
| `FIREBASE_PROJECT_ID`, native Firebase app config; optional server credential | Project/app config is public environment-specific configuration. Backend verifies tokens with Firebase Admin/ADC. Prefer runtime workload identity; an exceptional server private key belongs in an approved vault, never EAS/mobile. | Identity/provider owner. Verify project isolation and credential consumers first. Firebase public verification-key rollover is provider-managed, not rotation of `DJANGO_SECRET_KEY`. If a private key is used, stage a second valid credential, verify, revoke old; assess user-session revocation separately. No server key is provisioned here. |
| AdMob app/ad-unit identifiers and SSV public verification keys | Identifiers are public native config, **not shared secrets**. Google owns SSV signing keys; Django fetches public keys. Provider-account credentials stay in the provider vault and are not runtime env. | Ads/provider owner. Provider-managed SSV rollover must retain signature verification and bounded cache behavior. Rotate account access through its approved provider procedure; do not invent a webhook shared key. Production ads remain disabled; publisher testing/release prerequisites remain #98. |
| RevenueCat / store private keys and webhook authentication (P7) | Future provider vault/Secret Manager; no MVP runtime consumer or secret name/grant added. | Commerce/provider owner. Before P7, define actual env names, owners, duplicate-event-safe overlap and revocation tests. Do not provision or copy credentials now. |
| GitHub OIDC/WIF and runtime ADC | Short-lived identity tokens; no static GCP key in GitHub, container or repository. | Platform owner. Revoke federation/IAM when compromised; tokens expire. Trust changes need P5-T03 verification. Deploy identity has no direct Secret Accessor grant but can deploy code as runtime: it remains privileged. |
| `DJANGO_ALLOWED_HOSTS`, `DJANGO_SETTINGS_MODULE`, `VIDEO_PROVIDER`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_CDN_HOSTNAME` | Non-secret service/job config. Optional Bunny fields now pass through staging. | Engineering. Change with revision review and smoke; rollback the revision and saved job config. Production settings still reject missing/unsafe configuration. |
| `STAFF_UPLOAD_STORE`, `STAFF_UPLOAD_GCS_BUCKET`, `STAFF_UPLOAD_URL_TTL_SECONDS`; public API URL / Expo environment selection | Non-secret backend/build configuration; not added to this staging composition. GCS access uses runtime identity. GCP video fallback remains inactive. | Engineering/release owner. Keep environment selection explicit; no private signing material in JS, Remote Config, analytics or EAS updates. No upload, mobile or video-pipeline behavior changes in this slice. |

## Version and access contract

`secret_versions` maps the four supported runtime environment names to a positive
integer version string or `latest`. Unknown names, null/empty version values and
other aliases fail validation. Missing entries keep `latest` for compatibility.
The map is passed identically to service, migrate and smoke. Module
`secret_references` outputs contain **names and selectors only**.

Use explicit numeric versions for every active secret before adding a new
version. Cloud Run resolves environment secrets when instances start; `latest`
can therefore change what a cold start receives without changing the revision.
See [Cloud Run secret configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
An enabled old version must remain available for rollback cold starts.

Secret creation (`secret_ids` / `extra_secret_ids`) does not grant runtime access.
The grant set is Django + database, plus exactly the configured Bunny API/token
secret IDs when Bunny is enabled. Consumed IDs must exist in that creation set;
workloads depend on the resulting IAM grants. Optional extras remain ungranted.
Enabling Bunny also requires the real non-secret library ID and CDN hostname.
Before removing an existing grant or disabling Bunny, retire every old revision,
tag and job execution that still needs it; old revisions can cold-start later.

**Limit:** these are secret-level IAM grants. Numeric selection is not
authorization to only that version; the runtime can access other enabled versions
of a granted secret. The service/migrate/smoke still share one runtime identity,
and smoke currently receives Django/database secrets despite using only HTTP.
Per-consumer identities/injection and version conditions with an explicit
old/new overlap allowlist are a separate P5-T04 follow-up. Google documents
[version-aware IAM conditions](https://docs.cloud.google.com/secret-manager/docs/access-control);
do not mark the full “only needed secret versions” criterion complete here.

## Staging drill: prepare first, approve external actions last

This procedure is **not authorized to execute by this PR**. No live plan, cloud
inspection, secret read/add/disable, provider change, deploy or revocation has
been performed for this slice. Use only generated test data/media. Do not select
Django or a provider without proven overlap just to satisfy the test checkbox.

1. Complete P5-T03 live prerequisites. Prepare a private change record naming the
   staging environment, operator roles, exact secret/consumer set, current and
   proposed numeric versions, image digest, previous revision, job settings,
   expected provider operations, smoke criteria, rollback deadline and abort
   conditions. Metadata only; no values, state files, payloads or signed URLs.
2. Confirm independent old/new credential validity is supported. Define tests
   for **each** affected consumer, including authorized DB access/migrate or
   provider operations as applicable. Health endpoints alone do not prove CDN
   token acceptance, authentication or provider credentials work.
3. Prepare numeric pins for all active secrets while their values are unchanged.
   If any rollback revision still uses `latest`, prepare and verify a replacement
   pinned baseline **before creating a new version**. Record the reference map
   for service and both jobs. Do not claim an older `latest` revision is stable.
4. Review the exact infrastructure diff, IAM removals and deployment commands.
   Serialize with staging CI: block/hold queued automatic deploys under the
   approved maintenance procedure and wait for active deploy/jobs to finish.
   Do not let another image deploy adopt partially rotated job/service settings.
   Pin traffic to the known-good explicit revision, not `LATEST`.
5. Obtain the release owner's approval for this concrete record and the external
   operations below. Stop if privileges, overlap, rollback or P5-T03 evidence is
   unavailable; no public ingress, ads enablement or production action is needed.

After approval, the authorized operator performs these phases:

| Phase | Action and evidence | Abort / rollback |
| --- | --- | --- |
| Prepare | Establish/verify the pinned baseline from step 3; create the new independently valid provider credential and add its Secret Manager version using secure input, outside OpenTofu. Record version number/status only. | Leave old valid value and traffic intact. Never print secrets or put values in CLI arguments/history. |
| Stage service | Create a candidate with the same reviewed image and numeric secret selectors using the existing authenticated Cloud Run process and `--no-traffic --tag=candidate`. Keep the old revision at 100%. | If candidate startup or targeted functional checks fail, retain old traffic. Do not remove old access. |
| Stage jobs | Snapshot metadata-only migrate/smoke settings; update secret references and image digest consistently, then test the jobs in the approved order. A Job update changes future executions; **jobs do not have traffic rollback**. Keep old in-flight executions accounted for. | Restore saved job references/digest explicitly. Never reverse schema migrations as a key-rotation rollback. |
| Verify / promote | Run in-project candidate smoke with service-URL audience and tagged candidate base URL as in P5-T03. Exercise affected secret functionality, fail-smoke/no-promotion, cold start and old-revision rollback before final promotion. | Return traffic to the pinned baseline and restore jobs while old credentials remain valid. Keep IAM for both generations during overlap. |
| Reconcile | Record selected numeric versions in private tfvars; review a full OpenTofu plan for drift. Reconcile only when it preserves the reviewed image/traffic and approved job references. Resume serialized CI after settings are consistent. | Stop on an unexpected traffic, image, IAM, ingress or unrelated change. `ignore_changes` protects image only, not secret configuration. |
| Retire / revoke | After the approved observation/rollback window and max token/request/job lifetime, remove old tags/traffic and consumers, disable the old Secret Manager version, and revoke the **old provider value**. Verify new cold starts/jobs still work and old authentication is rejected using a private, redacted probe. | Disabling a vault version does not revoke an already loaded provider credential. After provider revocation the old revision is no longer a rollback option; forward-fix using a new valid credential. Never re-enable a compromised value. |

Do **not** use an unreviewed full `tofu apply` as the candidate staging step:
changing service template secrets creates a revision and existing traffic may
follow latest. This foundation does not add traffic ownership or automate the
rotation workflow. No new value should exist while a required cold-start or
rollback consumer still follows `latest`.

The evidence record must distinguish disabling a Secret Manager version,
revoking the upstream credential, and destroying a version. Destruction is not
part of this drill; retain only under approved policy (no new retention decision).

## Leakage controls and local verification

The scanner reports rule/path/line, never matched values. Regression fixtures are
generated in temporary ignored test repositories. Representative Django/Bunny,
database URL, Google API-key and private-key patterns are tested in env, log,
Dockerfile and mobile-config-shaped files; this is a prevention test, **not** a
proof that every arbitrary secret format can be detected.

Keep provider values out of build args/layers, shell tracing, exception messages,
analytics/crash payloads, EAS bundles/updates, PR logs and screenshots. Existing
container build-context checks, SSV request-query filtering and playback
diagnostic redaction remain in place. Their tests cover those paths only; there
is no universal log scrubber. Review a privately retained, redacted runtime
sample during the live drill; never paste raw logs into a public issue.

Credential-free gates (OpenTofu 1.11.14 for mocked tests):

```text
tofu fmt -check -recursive infra
tofu -chdir=infra/environments/staging init -backend=false -input=false -lockfile=readonly
tofu -chdir=infra/environments/staging validate -no-color
tofu -chdir=infra/environments/staging test -no-color
python scripts/check_repository_foundation.py
python scripts/validate_ai_governance.py
```

Mocked plans test configuration and grant membership, not effective live IAM,
provider overlap, credential validity, runtime redaction or zero downtime.
The explicit P5-T04 follow-up must cover those live checks, per-consumer identity
and version-access tightening, and Django/upload signing compatibility. P5-T05
general abuse controls, P7 commerce, and unrelated mobile work stay separate.

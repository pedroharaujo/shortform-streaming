# Stovio brand rollout

Tracking: [#187](https://github.com/pedroharaujo/stovio/issues/187).
Founder approval: 2026-09-21, D-038. Display names use **Stovio**; new technical
names use `stovio`. This is an in-place rebrand, not a replacement application.

## Source changes

- GitHub repository and local `origin`: `pedroharaujo/stovio`. Issues, pull
  requests, history, environments and access remain on the same repository.
- Root package `stovio`, Python package `stovio-backend`, workspace packages
  `@stovio/mobile` and `@stovio/api-client`; imports and lockfiles updated.
- App display name, Expo slug, catalog wordmark, support email subjects,
  Django Admin and generated OpenAPI title/description use Stovio.
- New links use `stovio://`; the app also registers `shortform://` so old
  links remain supported. Native changes require an app rebuild/install.
- Container builds and new deployment image paths use `stovio-backend` inside
  the existing registry repository. Old images remain available for rollback.
- New tooling variables: `STOVIO_BACKEND_IMAGE` and
  `STOVIO_METRO_PLAIN_ANDROID_BUNDLE`. The equivalent `SHORTFORM_*` names remain
  fallback aliases. An explicitly supplied Stovio variable takes precedence.
- Request logger becomes `stovio.request`. Existing metric IDs and filters
  remain compatible; filters use the request event fields, not logger names.
- Current documents, repository URLs, privacy draft links and architecture
  diagram renamed. The diagram is now `docs/architecture/stovio.drawio`.

No tracked app icon/splash/brand image assets exist to rename. Creating a new
visual identity is separate from replacing existing names.

## Connected-service changes verified

| Service | Applied change | Preservation/verification |
|---|---|---|
| GitHub | Repository renamed to `stovio`; local remote and links updated | Remote HEAD resolves; existing issues/environments retained |
| GCP deployment trust | Provider condition and deploy service-account principal now match `pedroharaujo/stovio` | Still exact `main` + `staging`; same role, no broader grants |
| GCP staging | Project display `Stovio staging`; runtime/deploy/smoke service-account display names updated | Project/resource identities retained |
| GCP resource labels | Existing secret, registry and private non-video bucket `product=stovio` | No secret versions or resource contents changed |
| Firebase/GCP Android project | Project and public-facing name `Stovio`; Android nickname `Stovio Android local` | Existing project, app ID, package and certificates retained |
| GCP credentials | Firebase Android/browser API-key display labels, OAuth Android label and backend-auth service-account display name updated | Key restrictions retained; no key values regenerated |
| Supabase | Organization and project display names `Stovio` | Same project reference/host; `ACTIVE_HEALTHY`; read-only `SELECT 1` succeeded |
| Bunny Stream | `stovio-spike-nonprod` and `stovio-production` library names | Same libraries, media, CDN endpoints and keys |
| RevenueCat | Project `Stovio Test`; app `Stovio Test (Play Store)` | Same project/app/product IDs; dashboard shows valid existing Play credentials. Secret-key label `Stovio local Android test verification`; key permissions/value preserved |
| Google Analytics | Property `Stovio`; Android stream `Stovio Android local` | Same property/stream IDs and Firebase linkage. Founder approved required business details: Arts & Entertainment, 1–10 employees, understanding user behavior (engagement/retention). Shared parent account remains untouched. |
| Google Play | Default English app-name draft saved as `Stovio` | Existing package/internal release retained; incomplete listing remains a draft |
| AdMob | Development app display `Stovio (Development)` | Same app/ad-unit identifiers; advertising remains disabled in MVP code |

Provider display updates are already live. Code and Terraform changes still
require the normal reviewed merge/deployment. No release or traffic promotion
was performed for this rebrand.

## Compatibility exceptions and migration requirements

| Retained identifier/name | Why it stays; what a migration would require |
|---|---|
| `com.shortformstreaming.app` | Permanent Play/Firebase identity. Changing it creates a separate app: new store record, Firebase registration, signing/integration setup, billing-product and purchase/account migration. Do not change for branding. |
| GCP `shortform-streaming-stg`, Firebase `throwaway-project-3d95c` | Project IDs are immutable. Replacing them requires moving IAM, data, auth users/configuration, billing and all integrations. Their display names are Stovio. |
| Supabase reference and provider-generated URLs | Project identity/credentials and database endpoint; retain while rebranding. New project or custom domain is separate provisioned infrastructure, not a string substitution. |
| GCP `shortform-api`, `shortform-migrate`, `shortform-smoke`, registry `shortform`, bucket names, service-account emails and custom-role IDs | Existing resource identities. Renaming often means replacement; requires planned state/data/IAM migration, endpoint cutover and rollback. Terraform defaults retain them intentionally. |
| `shortform_request_completed`, `shortform_request_duration_ms` | Stable monitoring metric IDs; keep time-series history and dashboard filters. Display names in Terraform now use Stovio. No dashboards/alert policies were returned by the staging API inventory. |
| Cloud Run revision labels and existing image references | Historical immutable revisions stay as deployed. Updating service labels can create a new revision; roll out Terraform `product=stovio` through normal deployment. |
| Compose project `shortform-streaming`, database/user `shortform` | Existing local database volume and login namespace. Changing defaults could start an empty database or break existing volumes. Back up and explicitly migrate before renaming. CI uses the same local database convention. |
| `demo-shortform-local` | Existing emulator authentication namespace. Preserve cached users/tokens and test configuration until an explicit emulator migration. |
| `shortform.*` secure-storage keys | Anonymous device ID, pending purchases/rewards and coin unlock journals. Keep for recovery and idempotency; migration needs backward-compatible reads and atomic recovery verification. |
| `shortform-purchase-v1`, `shortform-analytics-v1` | Versioned digest/deduplication protocols shared with existing attempts/events. Cosmetic changes would change identities and could duplicate work. |
| `__Secure-shortform_admin_session` | Existing signed Admin-session cookie. Changing it would sign out current staff; retain until a coordinated session transition. |
| Legacy URL scheme and `SHORTFORM_*` tooling aliases | Intentional backward compatibility; new documentation prefers Stovio. Remove only after known callers migrate. |
| Old private paths, signing aliases and historic artifact filenames | Existing private credentials/builds remain at their current locations. Rename with dependent tooling only; never recreate signing keys to change a label. |
| Current checkout directory `shortform-streaming` | Active tool/app/process paths. The Git remote is renamed; move the local directory only after closing dependent sessions. New clones use `stovio`. |
| Historical Git commits, issue/PR text, release artifacts and synthetic test identifiers | Audit history and reproduction evidence; not rewritten. Repository links redirect to the new name. |

Generic provider variable names (`DATABASE_URL`, `FIREBASE_PROJECT_ID`,
`BUNNY_STREAM_*`, `REVENUECAT_*`, `GCP_*`, `WIF_*`, `EXPO_PUBLIC_*`) contain no old
brand and remain unchanged. GitHub repository/staging secret-name inventories
were empty; environment variables point to the retained cloud resources. The
private Terraform repository input was updated without printing its other values.

The registered store name/header can remain **Shortform Streaming Test** until
the new draft listing is completed and submitted through the existing launch
gates. Descriptions and required graphic assets were missing before this task;
the rebrand does not fabricate them or publish an incomplete store listing.
Installed APK/AAB builds keep their prior launcher label until rebuilt and
distributed with the same package/signature. Device testing of both link
schemes and an in-place upgrade remains required before distribution.

AdMob currently has no European consent-message records to rename. No EAS project
configuration or tracked custom icon/splash files was found; native/EAS builds
were not invoked. Unrelated apps and the shared Analytics account were untouched.

No new domain, email address, store account, cloud project, billing plan or
production capability is approved by this rename. Existing URLs and support
email remain valid; no credentials, permissions, data or signing values were
rotated, copied to public evidence or deleted.

## Validation evidence

- `python scripts/check_repository_foundation.py`: repository safety scan,
  61 repository tests and governance passed as part of `pnpm check`.
- Backend lint, format, typecheck and migration checks passed; 769 backend tests
  passed. No migrations generated.
- `pnpm contract:check`: passed after staging the regenerated contract baseline.
- Mobile lint, formatting and typecheck passed. The parallel Jest run hit
  5-second timeouts while container work was active; a serial rerun with
  `pnpm --filter @stovio/mobile test --runInBand` passed all 52 suites/525 tests.
  No timeout thresholds or assertions were weakened.
- `pnpm mobile:config:check`: passed, including secret-leak/config guards.
- `pnpm mobile:bundle:check`: Android production JavaScript bundle passed.
- `docker build -f backend/Dockerfile -t stovio-backend:ci .`: passed.
- `tofu fmt -check -recursive infra`, isolated `init -backend=false`, `validate`
  and `test -no-color`: passed; 50 infrastructure tests. No infrastructure apply.
- Live staging HTTP smoke execution `shortform-smoke-hbmbp`: passed after
  supplying the normal per-execution `SMOKE_BASE_URL`, `SMOKE_AUDIENCE` and
  `FAIL_SMOKE=false` overrides. The first manual invocation omitted the required
  audience and failed closed; no deployment settings were changed to bypass it.
- Supabase read-only connectivity query and provider metadata readbacks passed.

These checks do not claim a rebuilt native app, a new store release, a new
purchase, or post-merge deployment authentication. Required rollout checks
remain open; no D-029 deferral is implied.

## Rollback and operating notes

Revert display labels independently if necessary. Keep credentials, IDs,
database volumes and purchase-recovery namespaces untouched. Reverting the
GitHub name requires changing the exact WIF condition, deployment principal,
private Terraform input and local remote together; never reuse the old GitHub
repository name for a different repository while relying on its redirect.

Keep old container digests available. Review the live Terraform plan before
applying any label updates: resource replacements are not part of this task.

Reference constraints: [GitHub repository renames](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository),
[Firebase project identity](https://firebase.google.com/docs/projects/learn-more),
[Play package permanence](https://support.google.com/googleplay/android-developer/answer/9859152),
[Cloud Run label revisions](https://docs.cloud.google.com/run/docs/configuring/services/labels).

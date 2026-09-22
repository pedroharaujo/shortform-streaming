# Mobile visual refresh — P6-T01

## Scope — 2026-09-22

The founder requested a visual-only refinement of the current Android app.
The earlier product proposal's navigation and capability changes are excluded:
episode selection remains a separate screen, and routes, callbacks, purchase
confirmation, prices, balances, unlock checks and recovery behavior are preserved.

The implementation is based on `673f621`, retaining the existing Stovio rebrand
and hosted test-build work already present in this checkout. That baseline is
ahead of `main`; this visual diff must be reviewed separately from those existing
changes. No merge, provider activation or new Android distribution is part of
this task.

## Presentation changes

- Shared near-black/charcoal surfaces, white main actions and restrained gold
  for coins; consistent spacing, heading sizes and rounded surfaces.
- Home uses a larger responsive hero, portrait poster proportions, compact card
  captions and stronger heading/action hierarchy. Full descriptions remain on
  the existing detail screens; the accessible card name retains the full title.
- Series and episode pages retain their content and actions with cleaner rows
  and typography. The player has smaller outer gutters and less framing, with
  its existing video controls, aspect handling and playback behavior intact.
- Coins measures its actual available width before choosing two columns. Below
  344 logical pixels or above 110% text scaling it uses the existing list layout.
  Selection, storefront values and the existing Best Value calculation are
  unchanged. Preview packs retain their existing no-charge labels and behavior.
- Account, sign-in and unlock screens inherit the shared styling and consistent
  page insets. All existing error, consent, support and recovery actions remain.

No new dependencies, server/API edits, analytics events, content, pricing rules,
memberships, rewards, navigation tabs or automatic spending were introduced.

## Verification

Existing behavior tests are retained without replacing assertions or adding
screenshot/style-only tests. The initial test run caught five exact-height
expectations; the existing 48dp minimum was retained and all mobile tests passed.

| Command / check | Final result |
| --- | --- |
| `pnpm check` | Passed: repository safety scan, 61 repository tests, AI governance, backend lint/format/types/migrations, 769 backend tests, OpenAPI regeneration/check, mobile lint/format/types, 53 suites / 531 mobile tests, Expo config checks |
| `pnpm mobile:bundle:check` | Passed: Android production JavaScript bundle; no native build, EAS submission or distribution |
| `git diff --check -- mobile docs/runbooks/mobile-visual-refresh.md docs/runbooks/final-validation.md` | Passed |
| TypeScript AST comparison of existing JSX interaction handlers against `HEAD` | All existing handlers preserved across the 12 changed mobile files; new layout-only `onLayout` measurement excluded |
| Diff of routes, configuration, API clients, checkout coordinator, offer-value calculation and generated API files | Unchanged |

The backend suite emitted 127 warnings and completed without failures. No
financial, authorization or eligibility test was skipped for this visual pass.

Independent review identified a narrow-container coin-grid risk. The grid now
measures its container rather than the window and constrains text width. The
targeted re-review found no remaining concrete regression. Artwork explicitly
uses cover sizing: wider frames crop rather than stretch images.

Native after-change verification is **not passed**. The existing local catalog
returned HTTP 500 before visual inspection; the only captured screen was the
pre-change catalog error. Automatic approval review rejected starting a separate
isolated preview bundle with the generic reason `blocked by policy`. The Android
emulator then became unavailable. The task-owned synthetic HTTP fixture server
was stopped; no preview configuration was written into the app or environment
files. No after-change screenshots or successful device journeys are claimed.

The manual layout checks are registered under D-029 in
[final-validation.md](final-validation.md#p6-t01--visual-only-refresh-2026-09-22).
This records a development-validation deferral, not a release approval. Existing
financial-integrity and access-control tests remain immediate requirements.

Follow-up on 2026-09-22 restored the real local catalog service and the intended
Stovio emulator. See [progressive testing and recovery evidence](android-first-journey.md#progressive-testing--current-stovio-sandbox).
The founder subsequently opened Stovio. Inspection found Metro was serving old
styles because CI mode disabled file watching. After clearing its cache and
removing CI mode, reloading the open app displayed the updated Home palette,
wordmark, rounded cards and larger hero. This populated Home state is now
visually verified on the emulator. Other screens, text scaling, TalkBack and
purchase/playback journeys remain unchecked for the visual refresh.

## Layout revision after founder feedback — 2026-09-22

The founder found the first pass visually too similar. The second pass changes
the composition: Home now overlays its title and existing Explore action on
artwork with a dark gradient, reducing the space before catalog rows. Coral
marks the wordmark and section headings, while coin values and selection remain
gold. The same presentation component gives series and episode pages a compact
artwork/title header. Episode rows use numbered tiles and dividers. The wallet
has a distinct gold balance panel and clearer pack selection/price styling.

The shared hero uses React Native's installed background-gradient support;
no native dependency, new content, API or route is introduced. Its height grows
with text rather than fixing the copy inside an absolute-positioned panel.
The existing generated catalog artwork remains unchanged. A sparse one-series
test catalog is not evidence of a full launch-content browsing experience.

Verification of this revision:

- `pnpm mobile:typecheck`, `pnpm mobile:lint`, `pnpm mobile:format:check`, and
  `pnpm mobile:bundle:check` passed.
- `pnpm --filter @stovio/mobile test --maxWorkers=2`: 53 suites / 538 tests
  passed. The unrestricted first run timed out in two tests while the emulator
  and other checks were active; no assertion or timeout was changed for the
  successful rerun.
- AST comparison against HEAD preserved every existing interaction callback in
  Home, series, episode selection, wallet and coin-pack presentation. The new
  hero component is presentation only. Concurrent checkout-coordinator edits
  in the shared checkout belong to separate work, not this visual revision.
- Direct emulator inspection verified the populated Home, series episode list
  and selected-episode page at normal text size, including navigation between
  them. Gradients render on the actual Android app. The original 1.0 text scale
  was restored after a 2.0 experiment; its persistent development refresh banner
  prevents treating the larger-text check as a complete pass.
- Signed-in wallet/checkout, TalkBack, small-screen and full large-text coverage
  remain in the final validation register. The recreated emulator is signed out;
  no account, purchase, balance or entitlement was modified for visual testing.

No native release or Play Store upload was performed.

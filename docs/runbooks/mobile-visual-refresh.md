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

## Full screen refactor towards the web reference — 2026-09-22

The founder asked for the Android app to adopt the composition of the web
reference client rather than isolated style tweaks, keeping every existing
data and navigation path. Screens were rebuilt as presentation around the
existing hooks, clients and route callbacks; no API, route parameter, purchase,
unlock or session behaviour changed.

Taken from the web reference:

- Persistent bottom tab bar (`src/ui/BottomNav.tsx`) on Browse, Coins and
  Account. Routes still stack through expo-router; the bar calls the same
  `router` targets the screens already used. It is hidden while a coin-unlock
  return flow (`returnEpisode`) is active so that flow keeps a single exit.
- Home header with brand mark, amber sign-in pill or coin pill plus profile
  circle; hero card with badge, large title, synopsis and two actions; each rail
  rendered as a two-column poster grid with a card body and a Play footer.
- Series page with banner header, episode-count and genre chips, amber "Start
  watching · Episode 1" action, uppercase section labels, genre tags and compact
  numbered episode cards.
- Wallet balance card with uppercase eyebrow and large balance; coin packs with
  floating Best Value badge, coin tile, coin count with unit and a price pill
  that fills gold when selected.

Deliberately kept from the current app instead of the reference:

- No "Library", saved-series, likes, view counts or ratings: the backend has no
  such data and the client must not invent it.
- No "FREE"/"locked"/coin-price badges on catalog cards or episode rows: access
  and price are decided by the server at selection time
  (`expectNoFreeOrLockedBadges` still passes).
- Two-step coin purchase (select pack, then Buy) instead of tap-to-buy cards.
- Accessibility roles, 48dp targets, localization keys and test IDs.

New message keys: `nav.*`, `catalog.featured`, `catalog.synopsis`,
`catalog.episodes`, `catalog.startWatching`, `catalog.seriesCount`.

Verification: `tsc --noEmit`, ESLint and Prettier passed;
`jest` 53 suites / 538 tests passed (two timeouts under full parallel load
passed on rerun in isolation; one assertion-visible copy change was reverted to
keep the "Best Value" text intact and apply uppercase through style only).
Emulator inspection (signed out) confirmed Home, series and Coins render with
the tab bar and navigate between each other.

## Founder feedback pass — 2026-09-22 (evening)

- Tab labels: Home / Wallet / Account. Unselected Wallet uses a muted outline
  coin; selected Wallet uses the gold coin.
- Theme tokens aligned to the web reference palette (amber-500, neutral-950/900/800,
  zinc-100 text, rose-500 / violet-600 logo stops from the removed web client).
- Home wordmark uses a white→amber letter gradient and an amber→rose→violet logo
  tile. Catalog cards show server `episode_count`, `free_episode_count` and
  genres; no invented views, ratings or per-episode FREE/LOCKED badges.
- Sign-in Google control follows Google dark-theme branding (fill #131314, stroke
  #8E918F, label #E3E3E3, multicolor G on white). Email/password unchanged.
- Catalog card OpenAPI fields expanded; Auth emulator on `127.0.0.1:9099` and API
  restarted with `FIREBASE_AUTH_MODE=admin` + `FIREBASE_AUTH_EMULATOR_HOST` so
  emulator ID tokens verify. Synthetic account credentials are shared in chat
  only and are never committed.

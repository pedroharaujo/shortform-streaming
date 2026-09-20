# Mobile design preview — P6-T01

The founder revised the design direction on 2026-09-19: neutral black and
charcoal, white primary actions, content-led discovery, and conventional profile
avatar access. This supersedes the earlier coral palette.

## Scope

- Home: branded header, featured eligible series, horizontal poster rails,
  guest sign-in or a round signed-in profile avatar. No redundant Account tab.
  The header subscribes to live sessions, including persisted session restoration.
- Series: artwork, prominent title, listed episode count, numbered episode cards
  and server-provided duration.
- Episode selection: abstract artwork, episode metadata and white Play action.
- Shared theme: neutral dark surfaces, white action colors, compact page headers
  and restrained card corners. Catalog loading and retry states use the same palette.
- Login: concise heading, labeled email/password form, primary sign-in,
  secondary account/Google actions, and an explicit Back action. Guest screens
  no longer show Sign out.
- Account: a menu for wallet, recent purchases, privacy and account management,
  with sign-out below. Privacy and deletion use separate panels with Back support.
  Returning from deletion clears its confirmation and password.
- Removed the country/language controls excluded by the MVP specification. Saving
  privacy preferences sends only analytics and ads consent; hidden locale/country
  metadata is never overwritten.
- Wallet, coin packs and purchase history: balance, offer and status cards using
  server/store values, with consistent primary, secondary and quiet actions.
- Episode unlock, reward sheet and player: matching panels, white actions and
  readable loading/error/locked states; player status content remains scrollable.

`ScreenElements.tsx` owns the shared introduction, action buttons and panel styles.
`useKeyboardScroll.ts` reveals the focused login/profile field after the keyboard
resizes the viewport, accounting for the safe-area offset. Native inspection
reproduced an obscured password field at 320 × 480 with 130% text and confirmed
the entire field is visible after the fix.

Original geometric illustrations use native views, with no downloads, new
dependencies or licensed assets. Catalog-provided posters still take precedence;
missing or failed images use the abstract fallback. Home features the first
series in the first nonempty server-provided rail. No sample titles are injected,
and no free/locked state is inferred from episode order.

This pass changes session-aware presentation and account navigation, while
preserving authentication, purchases, balances, eligibility, playback authorization
and production switches. The broader P6-T01 accessibility acceptance
and reward-copy localization remain open.

## Validation — 2026-09-19

| Command | Result |
| --- | --- |
| `pnpm mobile:lint` | Passed |
| `pnpm mobile:typecheck` | Passed |
| `pnpm mobile:format:check` | Passed |
| `pnpm mobile:test` | 48 suites / 454 tests passed |
| `pnpm mobile:config:check` | Passed |
| `pnpm mobile:bundle:check` | Android production JavaScript bundle passed; no native rebuild |
| `git diff --check` | Passed |
| `python scripts/check_repository_foundation.py` | Safety scan, 55 repository tests and AI governance passed |

Home route coverage checks guest sign-in, immediate login/logout header changes,
avatar navigation and persisted session restoration without remounting. Account
coverage checks menu navigation, deletion-confirmation cleanup, session guards
and consent-only PATCH bodies. Existing Home coverage checks hero/rail selection. Existing ineligible-content, compact-screen,
session, authorization and commerce coverage continues to pass.

Manual emulator inspection uses the existing synthetic Android playback catalog.
Home and series details were checked at 1080 × 2424 / 420 dpi. A temporary
840 × 1260 / 420 dpi setting (320 × 480 logical pixels) with 130% font size
checks wrapping and scrolling through Home, series episodes and episode selection.
The emulator's original size and font setting were restored after inspection.

The earlier remaining-screen pass also inspected login, loaded profile, loaded wallet,
and unavailable coin-pack/purchase-history states. Profile consent rows were
inspected at 320 × 480 with 130% text; login was checked with the keyboard open.
No credentials were entered, purchases started, consents saved or accounts deleted.
Loaded store offers, purchase records, reward outcomes and playback/entitlement
transitions are covered by existing component tests; this styling pass does not
claim a new live billing/ad-provider validation.

Independent review of the navigation revision found malformed arrow glyphs;
these were corrected and the Back arrow was verified on Android. No other
blocking regression was found in session subscriptions, partial preference writes,
account panel navigation or guest sign-out visibility. The final mobile suite
passed 48 suites / 454 tests.

Design references: Netflix separates discovery from personal controls in
[My Netflix](https://about.netflix.com/en/news/introducing-my-netflix-a-one-stop-shop-for-series-and-movies-you-want-to).
Its [profile guidance](https://help.netflix.com/en/node/322532375336036) distinguishes
mobile My Netflix from the web profile icon. This app uses the founder-requested
upper-right avatar, without copying Netflix assets or adding unsupported features.

To review: open Home, select **Explore series**, select an episode, and use **Play**
to enter the existing playback authorization flow. Catalog failures remain honest
error/retry states rather than being replaced by demo data. If Fast Refresh is
disabled in the development client, reload from the React Native development menu.

This is an emulator visual check, not completion of the physical-device,
TalkBack, screenshot-automation or store/provider checks for P6-T01/P6-T03.


## Native verification of the navigation revision

Home, guest Account and login were inspected on the Android emulator after
reloading the new bundle. The Back arrow renders correctly. Login was also
inspected at 320 x 480 logical pixels and 130% text, then simplified further to
remove its redundant form heading and long introductory paragraph. Device size
and font scale were restored.

The live manifest confirmed local Auth emulator mode. Synthetic local sign-in
attempts returned the app's generic authentication error, so the new signed-in
avatar, account menu and nested settings have automated coverage but are **not
yet verified natively** in this revision. A synthetic fixture was created only
in the local Auth emulator for this check; no personal credentials, consent
changes, purchases or account-deletion requests were used. No production
configuration or authentication safeguards were changed. Repeat Home -> sign-in
-> avatar -> wallet/purchases/privacy/management, including Android Back, when
local sign-in is available. This missing native check is not a pass or a merge
approval; no merge was attempted.


## Home wallet shortcut - P6-T01

The authenticated Home header now shows a native gold coin symbol and the real
server balance beside the avatar. Tapping it opens the existing wallet, where
coin purchases retain their current availability gates. Guest Home makes no
wallet request and has no coin shortcut. Compact/large-text headers use the
brand mark without the wordmark to retain room for both account controls.

The shortcut reloads on Home focus and app foreground, clears the prior value
while loading, and binds each result to its auth revision and latest request.
Logout/replacement unmounts the old shortcut. Errors display Wallet, never an
invented zero. A server-reported zero is shown normally. Full accessible balance
labels remain available even when long visual numbers need truncation.

Verification: `pnpm mobile:lint`, `pnpm mobile:typecheck`,
`pnpm mobile:format:check`, `pnpm mobile:test` (48 suites / 454 tests),
`pnpm mobile:bundle:check` and `git diff --check` pass. Route tests exercise
balance formatting, verified zero, navigation, focus/foreground refresh,
superseded requests, account replacement, logout, unreachable/401/thrown errors.
An independent review found no blockers.

A signed-in emulator session is now available. Native inspection verified the
Home header's server-reported zero, tapping the coin button into the loaded
wallet, and Android Back returning to Home with a refreshed balance. This closes
the earlier signed-in Home/wallet native-verification gap; it does not claim a
live purchase or provider validation. The older nested account-panel validation
gap remains separate. No purchase or balance mutation was performed.

The coin shortcut and avatar were also inspected at 320 x 480 logical pixels
with 130% text. Both remain fully visible and separate, and the original emulator
size/font settings were restored before leaving Home open.


## Coin purchase design preview - P6-T01

The founder explicitly requested a purchase preview without charges. Wallet now
exposes Buy coins in local Android development when the existing purchase mode
is disabled. The preview never overrides a configured RevenueCat sandbox; it
is unavailable on release, staging, production and iOS. No configuration value,
provider activation or commercial approval was changed.

The preview uses clearly marked example packs/prices (100 / 500 / 1200 coins),
a selectable gold-accented card list, confirmation sheet, cancel and simulated
completion. These fixtures are not approved commercial offers. Every stage says
no payment or wallet credit occurs. The separate preview component has no API or
provider dependency; the route returns before checkout construction. Android Back
closes the sheet, and the background is hidden from accessibility while it opens.

Validated with `pnpm mobile:lint`, `pnpm mobile:typecheck`,
`pnpm mobile:format:check`, `pnpm mobile:test` (49 suites / 461 tests),
`pnpm mobile:config:check`, `pnpm mobile:bundle:check` and `git diff --check`.
Six gate cases and route integration verify selection, cancellation, simulated
completion, preserved wallet/episode navigation and no checkout construction.
Independent review found no blockers. Native inspection followed Wallet ->
Buy coins -> choose example pack -> preview confirmation -> Android Back cancel
-> preview again -> simulate purchase -> Open wallet. This is design evidence,
not a Google Play purchase or a ledger credit.

Preview cards and the confirmation sheet were also inspected at 320 x 480
logical pixels with 130% text. Scrolling exposes both confirmation actions;
labels and prices remain readable. Original size/font settings were restored.

## Dedicated Coin Store - P6-T01

The founder requested a separate buying destination without substantial added
development complexity. The existing `/buy-coins` route now presents Coin Store,
with shared Back/Wallet navigation, a gold coin illustration, pack cards and a
selection summary in the design preview. Wallet retains balance/history and its
Buy coins entry. Home still opens Wallet. The same header and coin artwork are
used by configured checkout; no provider, backend, pricing approval or balance
logic changed.

Verification: `pnpm mobile:lint`, `pnpm mobile:typecheck`,
`pnpm mobile:format:check`, `pnpm mobile:test --runInBand` (49 suites / 461 tests),
`pnpm mobile:bundle:check` and `git diff --check` pass. Native inspection followed
Wallet -> Buy coins -> Coin Store -> select 500 example coins -> preview checkout
-> simulate -> Wallet, confirming the balance remained zero. Back/Wallet header,
cards, prices and the selection/checkout panel were inspected at 320 x 480 logical
pixels with 130% text. Original size/font settings were restored. This remains a
no-charge design preview, not provider purchase validation.

## Unified balance and packages - P6-T01 (supersedes separate Coin Store)

The founder's later request combines wallet and marketplace into `/coins`.
Home's balance button, Account and episode unlock links now open this destination.
The old `/wallet` and `/buy-coins` routes redirect while preserving episode return
context. Recent purchases remains a history screen and returns to Coins.

The real server balance sits above shared package cards. Ascending quantities,
larger numbers, aligned exact storefront price strings, restrained coin stacks,
and approximate coins-per-currency-unit copy support comparison. The unique best
ratio gets a gold Best Value badge and surface; selection uses a separate white
outline/radio and never defaults to the expensive pack. The existing catalog has
no separate bonus amounts, so none are invented. A single explicit action names
the selected quantity and price before the existing provider/preview confirmation.

RevenueCat's numeric price and currency are optional display metadata validated
through the existing provider/coordinator. Missing/invalid metadata, mixed currency,
single offers and equal-value ties suppress the badge. Localized price strings
are never parsed or altered. Floating-point-equivalent ratios count as ties.
No product amount, price, financial state transition, backend endpoint or ledger
write changed. Preview fixtures remain 100/EUR 0.99, 500/EUR 4.99 and 1200/EUR 9.99.

The existing session-bound queries, account invalidation, foreground/focus refresh,
pending unlock recovery and checkout recovery remain active. A verified purchase
triggers a fresh server balance query; historical credited coins are never added
locally. Pack loading, empty, unavailable, cancellation, pending, review and
verified feedback stay inline. Preview completion dismisses into the same screen.

Design reference: [Tapas's official Ink guidance](https://help.tapas.io/hc/en-us/articles/115005798107-What-is-Ink-How-do-I-get-some)
describes size-based packs and platform in-app checkout. This informed the direct
pack-selection approach; no Tapas commercial amounts, bonuses or policies were copied.

Automated verification: `pnpm mobile:test --runInBand` (50 suites / 488 tests),
`pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:format:check`,
`pnpm mobile:config:check`, `pnpm mobile:bundle:check`, `pnpm contract:check` pass.
Coverage includes canonical and legacy navigation, session replacement, no default
selection, duplicate submission prevention, pending/retry/empty/error feedback,
verified server balance refresh and truthful value comparison. Independent review
found no unresolved actionable findings after correcting floating-point ties.

Native inspection: Home coin button -> unified balance/packages -> 500 example
coins -> preview confirmation -> Android Back cancels -> preview again -> simulate
-> completion -> Done returns to the same screen, with balance still zero. The
native modal accessibility tree exposes confirmation actions and excludes the
background balance/history controls. This is not a full TalkBack/device pass or
real Google Play/provider purchase validation; existing release gates still apply.

The unified screen, pack comparison, wrapped checkout label and scrollable
confirmation actions were also inspected at 320 x 480 logical pixels and 130%
text. Labels/prices remained readable and actions reachable. Original emulator
size/font settings were restored. `git diff --check` passes.

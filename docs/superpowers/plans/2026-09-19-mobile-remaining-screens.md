# Remaining mobile screens — P6-T01 implementation plan

> Execution: continue in the existing isolated branch in this checkout. No worktrees or merge. User approved cinematic dark/coral styling and requested the remaining screens.

**Goal:** Apply the catalog design direction to login, profile, wallet, purchases, episode unlock, rewards and player states.

**Architecture:** Shared presentational `ScreenIntro`, `ActionButton` and panel styles in `mobile/src/ui/ScreenElements.tsx`; existing feature components retain their state, conditions and callbacks. New copy belongs in the typed message catalog.

**Constraints:** No new dependencies, mock balances, invented account identity, prices, store activation, authentication changes, entitlement changes or payment state-machine changes. Maintain disabled states, confirmation steps, live regions, test identifiers and minimum 48dp touch targets. Keep actions scrollable on compact screens. No new equivalent tests for styling.

## Implementation and verification

- [x] Add shared presentational elements and typed design copy; use semantic theme tokens.
- [x] Restyle `SignInScreen.tsx` and `AccountScreen.tsx`: visible field labels, primary/secondary actions, grouped preference/privacy/account sections. Preserve every existing condition and handler.
- [x] Restyle `WalletScreen.tsx`, `CoinPacksScreen.tsx`, `PurchaseHistoryScreen.tsx` and `EpisodeUnlockScreen.tsx`: distinct balance/offer/status cards; only server/store values. Share action styling.
- [x] Restyle `RewardScreen.tsx` and `PlayerScreen.tsx`: theme tokens, clear status surfaces and actions. Keep playback and ad logic unchanged.
- [x] Run `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:format:check`, `pnpm mobile:test`, `pnpm mobile:config:check`, `pnpm mobile:bundle:check`; require successful exits.
- [x] Review diff for preserved business behavior. Inspect available emulator screens and compact/large-text login; restore device settings. Record actual coverage and unavailable states in the design-preview runbook.


## Founder navigation and palette revision - P6-T01

The later request supersedes coral styling: use neutral black/charcoal and white
primary actions, a round profile avatar after login, and familiar account menus.
Official Netflix product/profile guidance informed discovery versus account
separation; follow the founder's avatar placement and the existing MVP scope.

- [x] Subscribe Home to the actual auth session; support login, logout and restored sessions.
- [x] Replace the redundant Account tab with avatar entry; keep guest Sign in.
- [x] Add direct wallet/purchase rows and separate privacy/management panels.
- [x] Remove country/language controls and PATCH consent fields only.
- [x] Simplify shared headings, corners and login hierarchy; remove pink surfaces/actions.
- [x] Verify menu/back/session transitions with focused tests and the full mobile suite.
- [x] Independently review session/navigation changes and fix malformed arrow glyphs.
- [x] Inspect available native states and record exact coverage and limitations.
- [ ] Repeat signed-in native avatar/account navigation after local authentication is available.

## Home wallet shortcut - P6-T01

User requested a small coin icon and current balance beside the profile avatar,
opening the existing wallet. Reuse the authenticated read-only wallet client;
leave billing availability and financial mutation paths unchanged.

- [x] Add a native gold coin icon and compact accessible wallet shortcut.
- [x] Fetch only when signed in; refresh on Home focus and app foreground.
- [x] Scope balances to the current session; reject late or superseded responses.
- [x] Distinguish loading/unavailable from a verified zero; preserve wallet access.
- [x] Test via the Home route, including failures, refresh races and session changes.
- [x] Run mobile lint, types, formatting, full suite and Android bundle check.
- [x] Independently review; verify signed-in balance and Home -> wallet -> Home on Android.

## Coin purchase design preview - P6-T01

Founder explicitly selected "Purchase preview - no charges" after finding the
emulator's checkout unavailable. The live manifest has purchase mode disabled
and no RevenueCat SDK identifier. This slice previews the UI only.

- [x] Expose Wallet -> Buy coins for local Android development with store mode disabled.
- [x] Render a separate labeled preview before creating any checkout coordinator.
- [x] Add illustrative packs/prices, selection, modal confirmation, cancellation and simulated completion.
- [x] Make no provider, purchase, ledger, entitlement or wallet-write calls.
- [x] Keep configured sandbox checkout unchanged and exclude preview from release/staging/production/iOS.
- [x] Test environment gates and navigation/preview completion without checkout construction.
- [x] Run full mobile checks and independently review the change.
- [x] Verify preview selection, Android Back cancellation and simulated completion on the emulator.

## Dedicated Coin Store - P6-T01

- [x] Give the existing Buy coins route a separate store identity and Back/Wallet navigation.
- [x] Reuse coin artwork, existing preview and configured checkout without new backend behavior.
- [x] Keep balance/history in Wallet and Home's coin shortcut pointing to Wallet.
- [x] Verify full mobile suite, Android bundle and native wallet/store/preview navigation.
- [x] Inspect narrow layouts with larger text and restore emulator settings.

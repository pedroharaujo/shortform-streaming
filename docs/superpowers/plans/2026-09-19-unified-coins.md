# Unified Coins Experience Implementation Plan

> **For agentic workers:** Use Superpowers execution, bounded implementation and independent review; preserve this checkout and existing work.

**Goal:** P6-T01: one destination for the authoritative balance and coin packages, with honest value comparison and clear purchase feedback.

**Architecture:** `/coins` is canonical. Legacy wallet/buy-coins links redirect while preserving episode context. Reuse wallet query/recovery and checkout coordinator safeguards; compose their UI within one scrollable screen. Numeric storefront price metadata is presentation-only.

**Tech Stack:** Expo Router, React Native, typed English messages, existing Jest integration tests.

## Global Constraints

- Preserve existing package prices, coin amounts, and purchase logic.
- No invented bonuses, discounts, popularity or production activation.
- Backend balances remain authoritative; preview never credits a balance or calls checkout.
- Best Value uses total configured coins / numeric price in the same currency; omit when data is missing, invalid, tied or incomparable.
- Use 48dp controls, readable large-text layouts, neutral dark surfaces and restrained gold.
- Preserve authentication/session races, pending unlock recovery and episode return context.
- Stay in this checkout; preserve all previous uncommitted changes; no merge.

## Task 1: Comparable offer metadata

Files: `mobile/src/features/purchases/{types,revenueCatProvider,checkoutCoordinator,offerValue}.ts` and relevant existing tests.

- [x] Pass optional numeric price and currency from the provider through validated presentation metadata; do not parse localized prices.
- [x] Implement `bestValueProductId(offers): string | null` using validated, same-currency positive prices and total coin quantities. Require at least two offers and a unique winner.
- [x] Test real metadata projection and invalid/missing/mixed currency/tied comparisons; keep checkout behavior unchanged.

## Task 2: Unified destination and package presentation

Files: `mobile/app/{coins,wallet,buy-coins,index,account,purchases}.tsx`, `mobile/app/unlock/[id].tsx`, wallet/store components and messages.

- [x] Make `/coins` canonical and replace old destinations with redirects preserving `returnEpisode`.
- [x] Compose the server balance, pack section, recovery actions and history in one scroll view; retain session guards and refresh after purchase verification.
- [x] Share pack cards across preview/checkout: ascending quantities, clear total and price, numeric value comparison, conditional Best Value, and explicit selection before one checkout action.
- [x] Keep preview clearly labeled and preserve its confirmation/completion behavior. Remove the redundant wallet hop.
- [x] Show loading, empty, unavailable, cancelled, pending and verified feedback with appropriate existing recovery controls.

## Task 3: Verification and documentation

- [x] Update route integration coverage for Home -> Coins, aliases, selection/feedback, balance refresh, account changes and episode/history recovery.
- [x] Run `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:format:check`, `pnpm mobile:test`, `pnpm mobile:config:check`, `pnpm mobile:bundle:check`, `pnpm contract:check`, `git diff --check`.
- [x] Obtain independent code review and address findings.
- [x] Inspect native Home -> Coins -> selection -> no-charge feedback, return navigation and compact/large-text layout; restore emulator settings.
- [x] Record evidence and design rationale in `docs/runbooks/mobile-design-preview.md`.

# Compatible Dependency Set Runbook

P1-T05A records the policy and the landed versions that Application CI, expo-doctor, and the Python type-check must keep green. Dependabot is allowed to open patch, minor, and security updates on this compatible line. It is not allowed to reopen known-incompatible majors.

Issue: [#31](https://github.com/pedroharaujo/shortform-streaming/issues/31). Original compatible-set PR: [#32](https://github.com/pedroharaujo/shortform-streaming/pull/32).

## Policy

Use the latest *compatible* versions, not the latest versions on the registry.

- **JavaScript / mobile:** stay on the Expo SDK 57 compatibility table. Do not move to Expo 58, React Native 0.87, ESLint 10, TypeScript 7, or Jest 30 until a human upgrades the SDK, expo-doctor, and this runbook together.
- **Python / backend:** keep Django 6.1 with matching stubs. ADR 0002 still says Django LTS; this task does not rewrite that ADR. The exception is recorded here: `main` already runs Django 6.1, so P1-T05A keeps 6.1 plus stubs that match it.
- **CI / Docker Python:** `requires-python` is `>=3.12,<3.15`. Keep the 3.14 image and GitHub Actions Python 3.14 line.

`expo install` (or an equivalent Expo SDK 57 install) is the source of the JavaScript pins. `uv lock` is the source of the Python pins. After either change, frozen installs must succeed: `pnpm install --frozen-lockfile` and `uv sync --locked`.

## Landed compatible set

These are the versions on `main` after PR #32, later compatible bumps that remain in scope (mypy 2.3.1, ruff 0.16.4, openapi-fetch ^0.17.0), and the Jest 29 restore after Dependabot PR #35.

| Area | Package | Compatible pin |
| --- | --- | --- |
| Mobile runtime | `expo` | 57.0.18 |
| Mobile runtime | `expo-constants` | ~57.0.16 |
| Mobile runtime | `expo-router` | ~57.0.17 |
| Mobile runtime | `expo-secure-store` | ~57.0.2 |
| Mobile runtime | `react` | 19.2.3 |
| Mobile runtime | `react-native` | 0.86.3 |
| Mobile runtime | `react-native-safe-area-context` | ~5.7.0 |
| Mobile runtime | `expo-video` | ~57.0.3 |
| Mobile runtime | `@react-native-firebase/app` | ^26.3.2 (Expo 57 / RN 0.86 `expo install`; Android Auth first) |
| Mobile runtime | `@react-native-firebase/auth` | ^26.3.2 (same pin as app; email/password + Auth emulator) |
| Mobile runtime | `react-native-worklets` | 0.10.1 (workspace override; SDK 57 table) |
| Mobile runtime | `react-native-reanimated` | 4.5.1 (workspace override; SDK 57 table) |
| Mobile runtime | `react-native-gesture-handler` | 2.32.0 (workspace override; SDK 57 table ~2.32.0) |
| Mobile tooling | `eslint` | ^9.39.5 (9.x only) |
| Mobile tooling | `eslint-config-expo` | ~57.0.2 |
| Mobile tooling | `typescript` | ~6.0.3 |
| Mobile test | `jest` | ~29.7.0 |
| Mobile test | `@types/jest` | 29.5.14 |
| Mobile test | `jest-expo` | ~57.0.5 |
| Mobile test | `react-test-renderer` | 19.2.3 |
| Workspace | `openapi-fetch` | ^0.17.0 |
| Backend | Django | 6.1 (`>=6.1,<6.2`) |
| Backend stubs | `django-stubs` | 6.1.x (`>=6.1,<6.2`) |
| Backend stubs | `djangorestframework-stubs` | 3.18.x (matches DRF 3.18) |
| Backend tooling | mypy | 2.3.1 |
| Backend tooling | ruff | 0.16.4 |
| CI / Docker | Python | 3.14 |

`pnpm-workspace.yaml` overrides `react`, `react-native` (0.86.3), `react-test-renderer`, and `@react-native/metro-config` (0.86.3) so transitives cannot pull RN 0.87 or React 19.2.8. It also overrides `react-native-worklets` to `0.10.1`, `react-native-reanimated` to `4.5.1`, and `react-native-gesture-handler` to `2.32.0`. Without those pins, Expo 57 transitives resolve worklets `0.12.1`, reanimated `4.6.0`, and gesture-handler `3.2.1`. Worklets 0.12 renamed `WorkletRuntime::executeSync` to `runSync`; SDK 57 `expo-modules-core@57.0.13` still calls `executeSync`, so Android native compile fails (`WorkletJSCallInvoker.cpp`: no member named `executeSync`). This is expo/expo#49225. Reanimated 4.6.x requires worklets 0.12.x, so both packages must pin together. Gesture Handler 3.x CMake-links `libworklets.so` from a worklets 0.12 layout; with worklets 0.10.1 the `.so` is missing and ninja fails (`:react-native-gesture-handler:buildCMakeDebug`). Pin RNGH to the SDK 57 table (`~2.32.0`). Do not patch `node_modules`. 0.10.x still exposes `executeSync`; Dependabot may open 0.10.x patches but not `>=0.11.0`. RNGH 2.32.x patches may still open; ignore `>=2.33.0`.

`allowBuilds` stays minimal (`unrs-resolver: true`). `@react-native-firebase` pulls `@firebase/util` and `protobufjs` lifecycle scripts; those are recorded as `false` so frozen installs do not fail with `ERR_PNPM_IGNORED_BUILDS`. Do not set `@firebase/util` to `true`: its postinstall can write `FIREBASE_WEBAPP_CONFIG` (including api keys) into package dist.

## Dependabot ignore majors

Ignore rules live in `.github/dependabot.yml`. They block only known-incompatible majors. Patch, minor, and security updates on the compatible line still open.

**npm**

- `react-native` `>=0.87.0`
- `eslint` `>=10.0.0`
- `react` `>19.2.3`
- `react-test-renderer` `>19.2.3`
- `expo` `>=58.0.0`
- `expo-router` `>=58.0.0`
- `expo-constants` `>=58.0.0`
- `jest-expo` `>=58.0.0`
- `eslint-config-expo` `>=58.0.0`
- `typescript` `>=7.0.0`
- `jest` `>=30.0.0` — Expo SDK 57 / jest-expo 57 expect Jest 29
- `@types/jest` `>=30.0.0` — keep types on the Jest 29 line
- `react-native-screens` `>=4.27.0` — expo-doctor expects `~4.26.0` (SDK 57 table); Dependabot PR #38 is an expected failure
- `react-native-safe-area-context` `>=5.8.0` — expo-doctor expects `~5.7.0` (SDK 57 table); Dependabot PR #39 is an expected failure
- `expo-video` `>=58.0.0` — stay on the Expo SDK 57 table; do not jump to Expo 58
- `react-native-worklets` `>=0.11.0` — SDK 57 table is 0.10.1; 0.10.x still has `executeSync`. 0.12 renamed it to `runSync` and breaks `expo-modules-core` Android compile (expo/expo#49225). Ignore 0.11+ so Dependabot cannot leave the 0.10 line.
- `react-native-reanimated` `>=4.6.0` — 4.6.x requires worklets 0.12.x; stay on 4.5.1 (SDK 57 table)
- `react-native-gesture-handler` `>=2.33.0` — SDK 57 table is `~2.32.0`; 3.x CMake-links `libworklets.so` from a worklets 0.12 layout and Android ninja fails against worklets 0.10.1. Ignore 2.33+ so Dependabot cannot leave the 2.32 line; 2.32.x patches still open.

**uv**

- `django` `>=6.2`
- `django-stubs` `>=6.2`

**docker** (`/backend`)

- `python` `>=3.15`

`tests/repository/test_foundation.py` asserts these ignore ranges. If expo-doctor starts accepting a new major, remove the matching ignore in the same change that upgrades the SDK table and this runbook.

## Issue #31 compared with PR #32 and this close-out

Issue #31 asked for one mutually compatible set, matching lockfiles, green CI, and Dependabot ignores so Expo/RN/ESLint-incompatible bumps would not reopen immediately.

| Criterion | PR #32 (`0878da1`, merged) | This close-out |
| --- | --- | --- |
| Expo SDK 57 table: RN 0.86.x, React 19.2.3, Expo-pinned screens/safe-area | Landed | Unchanged |
| ESLint 9.x with `eslint-config-expo` 57 | Landed | Unchanged |
| TypeScript 6.x accepted by expo-doctor | Landed | Unchanged |
| Django 6.1 + django-stubs 6.1 + djangorestframework-stubs 3.18 | Landed | Unchanged |
| CI Python 3.14 matches the Docker image | Landed | Unchanged |
| Frozen installs; Application CI / OpenAPI / Repository foundation | Landed on `0878da1` | Re-checked after the Jest restore |
| Dependabot ignores for RN, ESLint, React, Expo, TypeScript, Django, Docker Python | Landed | Unchanged |
| `jest` ~29.7.0 and `@types/jest` 29.5.14 | Landed in PR #32 | Restored after Dependabot PR #35 merged Jest 30.4.2 / `@types/jest` 30.0.0 and broke Application CI Mobile (`expo-doctor` expected Jest 29) |
| Dependabot ignore for `jest` / `@types/jest` `>=30.0.0` | Missing (so #35 could open) | Added |
| Compatible-set runbook and P1-T05A in the implementation plan | Not in #32 | Added so a later PR can use `Closes #31` |
| README version alignment; ADR 0002 not rewritten | Landed | Unchanged |

Later compatible bumps that stay: mypy 2.3.1, ruff 0.16.4, openapi-fetch ^0.17.0. Out of scope: Expo 58, RN 0.87, ESLint 10, TypeScript 7, Django 6.2, pinning expo-doctor, emulator/EAS, catalog/auth/commerce.

## Issue #31 comment record

Short operational record of the GitHub issue thread (no tokens, secrets, or personal data):

1. **Orchestrator start.** The orchestrator started P1-T05A from `4673dcad1172f8a5f23eb85a5d808ccaa38dfb73` on branch `deps/align-compatible-latest`, moving the issue `ai-ready` → `ai-in-progress`.
2. **Implementer hand-off.** Implementation landed at `0878da1bdee6e47ff3b40985a906c415b7ddce13`. State moved `ai-in-progress` → `ai-review`. The implementer did not approve.
3. **Independent VERIFIED.** Verification of `0878da1` / PR #32 returned VERIFIED. Repository foundation, OpenAPI contract, Application CI (including expo-doctor 21/21), and Dependency review passed on that SHA. State moved `ai-review` → `ai-verified`. PR #32 merged.
4. **Jest 30 regression.** Dependabot PR #35 then merged `jest` 30.4.2 and `@types/jest` 30.0.0. Application CI Mobile failed expo-doctor (`@types/jest` expected 29.5.14, found 30.0.0; `jest` expected ~29.7.0, found 30.4.2). Issue #31 remained open. This close-out restores the Jest 29 pins and adds the missing ignore rules.

## Recovery

If Application CI Mobile fails expo-doctor on SDK 57 **patch** pins (`expo` 57.0.x, `react-native` 0.86.x, matching router/constants/video/jest-expo/eslint-config-expo), bump with `pnpm --filter @shortform/mobile exec expo install` for those packages, keep the `react-native` / `@react-native/metro-config` workspace overrides on the same 0.86.x patch, add only new exact versions to `minimumReleaseAgeExclude`, regenerate `pnpm-lock.yaml`, and confirm frozen install plus `npx --yes expo-doctor`. Do not move to Expo 58 or RN 0.87.

If Application CI Mobile fails expo-doctor on `jest` or `@types/jest`, restore `jest@~29.7.0` and `@types/jest@29.5.14` with `npx expo install` from `mobile/`, regenerate `pnpm-lock.yaml` from the repository root, and confirm `pnpm install --frozen-lockfile` plus `npx --yes expo-doctor` from `mobile/`. Do not bump Jest 30 while the repository remains on Expo SDK 57.

If a human later upgrades Expo SDK, Django, or Python together, update this runbook, `.github/dependabot.yml`, and `tests/repository/test_foundation.py` in the same change. Never include tokens, repository secrets, provider payloads, or personal data in evidence.

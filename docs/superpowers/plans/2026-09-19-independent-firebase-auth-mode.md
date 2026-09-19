# Independent Android Firebase Auth Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #175 / D-036 / P2-T08 so the Android development app can use genuine Firebase Google sign-in with its local API and separately gated Play sandbox checkout, without silently retaining a native Auth emulator across JavaScript reloads.

**Architecture:** Add a public Firebase auth mode independent of the API environment. Resolve it through the existing Expo configuration/runtime boundary and enforce it at the existing shared native authentication entry point. A synchronized process-lived latch in the existing AndroidGoogleWebClient Expo module claims one mode for the process before authentication operations; a conflicting claim is rejected for the life of that process. This app reads embedded APK configuration, so selecting another configured mode also requires rebuilding and installing the APK.

**Tech Stack:** Existing Expo/React Native TypeScript, React Native Firebase 26.4.0, existing Kotlin Expo module, existing Jest/config checks. No dependency additions.

## Global Constraints

- Issue: https://github.com/pedroharaujo/shortform-streaming/issues/175; parent journey: #164, decision D-036.
- One bounded task and one PR; no extra worktree. Use the short-lived `codex/firebase-auth-mode` branch in the existing checkout. The earlier baseline ARM64 AAB attempt produced no artifact and is stopped, so source work and sequential checks may proceed. Build the store-registration AAB from the verified updated code later, with purchases, ads, analytics and App Check disabled. Do not overlap source mutations or heavy Jest work with native compilation.
- Preserve defaults: local API uses the Auth emulator; staging/production APIs use cloud Auth. An explicitly selected local cloud mode is supported. An explicitly selected nonlocal emulator mode is rejected.
- Never infer an auth mode from a purchase setting; preserve every purchase, analytics, ads, App Check and backend authorization gate.
- Preserve Firebase Admin `check_revoked=True`. No backend code, database schema, generated API or production activation changes are required.
- No credentials, actual Firebase project/account identifiers, provider payloads or signed media URLs in tracked files or PR evidence. Configuration examples use placeholders and existing example-only values.
- One test at the highest layer that catches each behavior. Configuration parsing and the native-call boundary have distinct responsibilities; do not add duplicate screen/smoke assertions. Actual native process-lifetime behavior must be verified on Android, not claimed from mocked Jest tests.
- Missing old-manifest auth configuration may use historical defaults; a present malformed auth configuration must throw. Do not treat `null`, arrays, empty objects or invalid modes as an absent setting.

## Root cause and evidence

- `mobile/src/auth/nativeFirebaseAuth.ts:63` currently attaches the Auth emulator whenever `getApiConfiguration().environment === 'local'`.
- `mobile/src/auth/nativeSessionLifecycle.ts` uses that same function before observing or reading the native user. Keep this shared boundary.
- `mobile/app.config.ts:230` deliberately restricts sandbox checkout to local development builds, so changing API environment to staging is not an acceptable auth workaround.
- Installed `node_modules/@react-native-firebase/auth/lib/index.ts:198` initializes `_emulatorConfig = null`; its getter at line 279 returns only that JS field. A full JS reload loses this evidence.
- Installed `node_modules/@react-native-firebase/auth/android/src/main/java/io/invertase/firebase/auth/NativeRNFBTurboAuth.java:108` keeps its own private static emulator map; `useEmulator` around line 2307 sets it once. Exported constants around line 2803 include only language and user, not emulator state. Do not access private SDK internals or patch node_modules.
- This app has no `expo-dev-client` or Expo Updates integration. Expo Constants reads the APK asset `assets/app.config`; restarting Metro or the app cannot change its embedded auth mode. Gradle regenerates the `extra` settings when building the APK, so an auth-mode-only change does not itself require Expo prebuild.
- Therefore a JS-only `getAuth().emulatorConfig` check cannot prove safety after reload. The new native process latch is necessary. It is a guard on this application's auth entry point, not a claim to introspect arbitrary external SDK mutations.
- Root has separately provisioned a private backend credential with the custom permission `firebaseauth.users.get`, and a live lookup of a generated nonexistent UID returned `UserNotFoundError`. This proves that credential's lookup authorization without retrieving a real account. Local environment/runtime activation and genuine signed-token validation remain separate operational work.

### Task 1: Implement and verify one checked Android auth mode

**Files:**

- Modify: `mobile/app.config.ts` — type, resolver, and `extra.auth`.
- Modify: `mobile/src/config/appConfiguration.ts` — manifest reader and runtime getter.
- Modify/test: `mobile/src/config/appConfiguration.test.ts` — mode/default/manifest-boundary cases.
- Modify: `mobile/src/auth/nativeFirebaseAuth.ts` — checked native mode claim before auth SDK access and cached emulator return.
- Modify/test: `mobile/src/auth/nativeFirebaseAuth.test.ts` — native guard and attachment behavior in existing suite.
- Modify: `mobile/modules/android-google-web-client/android/src/main/java/expo/modules/androidgooglewebclient/AndroidGoogleWebClientModule.kt` — synchronized process mode latch.
- Modify: `mobile/scripts/check-expo-config.mjs` — public manifest wiring and local cloud plus sandbox coexistence.
- Modify: `.env.example`, `mobile/README.md`, `docs/runbooks/android-first-journey.md` — exact local modes, rebuild/install requirement and private backend setup.
- Inspect without changing unless genuinely needed: `mobile/src/auth/nativeSessionLifecycle.ts`; both callers must still use the shared boundary.
- No new production files, packages, Gradle dependencies, screens, API endpoints or schema changes.

**Interfaces:**

```typescript
export type FirebaseAuthMode = 'emulator' | 'cloud';
export interface FirebaseAuthConfiguration { readonly mode: FirebaseAuthMode }
export function resolveFirebaseAuthConfiguration(
  source: Readonly<Record<string, string | undefined>>,
  environment: ApiEnvironment,
): FirebaseAuthConfiguration;
export function readFirebaseAuthConfiguration(
  extra: ExtraShape | null | undefined,
  environment: ApiEnvironment,
): FirebaseAuthConfiguration;
export function getFirebaseAuthConfiguration(): FirebaseAuthConfiguration;
```

Native synchronous method on existing `AndroidGoogleWebClient` module:

```typescript
claimFirebaseAuthMode(mode: FirebaseAuthMode): boolean;
```

Returns true for the first valid mode or repeated same-mode claim; false for an invalid mode or attempted mode change. No account/project/token data crosses this method.

- [x] **Step 1: Add failing configuration tests to the existing suite.** Import `readFirebaseAuthConfiguration` and `resolveFirebaseAuthConfiguration` alongside existing readers/resolvers. Include these concrete cases:

```typescript
describe('Firebase auth configuration', () => {
  it.each([
    ['local', 'emulator'], ['staging', 'cloud'], ['production', 'cloud'],
  ] as const)('preserves the %s default', (environment, mode) => {
    expect(resolveFirebaseAuthConfiguration({}, environment)).toEqual({ mode });
    for (const extra of [undefined, null, {}]) {
      expect(readFirebaseAuthConfiguration(extra, environment)).toEqual({ mode });
    }
  });

  it('allows cloud Auth with the local API', () => {
    expect(resolveFirebaseAuthConfiguration(
      { EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'cloud' }, 'local',
    )).toEqual({ mode: 'cloud' });
    expect(readFirebaseAuthConfiguration({ auth: { mode: 'cloud' } }, 'local'))
      .toEqual({ mode: 'cloud' });
  });

  it.each(['staging', 'production'] as const)('rejects emulator Auth in %s', environment => {
    expect(() => resolveFirebaseAuthConfiguration(
      { EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'emulator' }, environment,
    )).toThrow('local');
    expect(() => readFirebaseAuthConfiguration({ auth: { mode: 'emulator' } }, environment))
      .toThrow('local');
  });

  it.each(['', 'invalid', 'Cloud', 'cloud ', ' emulator'])('rejects explicit invalid mode %j', mode => {
    expect(() => resolveFirebaseAuthConfiguration(
      { EXPO_PUBLIC_FIREBASE_AUTH_MODE: mode }, 'local',
    )).toThrow('EXPO_PUBLIC_FIREBASE_AUTH_MODE');
  });

  it.each([undefined, null, [], 'cloud', {}, { mode: null }, { mode: true }, { mode: 'invalid' }])
    ('rejects a present malformed manifest auth field %j', auth => {
      expect(() => readFirebaseAuthConfiguration({ auth }, 'local')).toThrow();
    });
});
```

Run from repo root, only after the build is clear:

```powershell
pnpm --filter @shortform/mobile test --runInBand src/config/appConfiguration.test.ts
```

Expected RED: the new reader/resolver is missing. If only unrelated tooling fails, resolve the test invocation before claiming the failure demonstrates this behavior.

- [x] **Step 2: Implement the resolver and runtime reader.** Add the types above near the existing configuration types in `app.config.ts`, followed by this resolver near the other resolvers:

```typescript
export function resolveFirebaseAuthConfiguration(
  source: Readonly<Record<string, string | undefined>>,
  environment: ApiEnvironment,
): FirebaseAuthConfiguration {
  const mode = source.EXPO_PUBLIC_FIREBASE_AUTH_MODE ??
    (environment === 'local' ? 'emulator' : 'cloud');
  if (mode !== 'emulator' && mode !== 'cloud') {
    throw new EnvironmentConfigurationError(
      'EXPO_PUBLIC_FIREBASE_AUTH_MODE must be emulator or cloud.',
    );
  }
  if (mode === 'emulator' && environment !== 'local') {
    throw new EnvironmentConfigurationError('Firebase Auth emulator mode is allowed only with a local API.');
  }
  return { mode };
}
```

In the Expo config factory, after resolving `api`, resolve `const auth = resolveFirebaseAuthConfiguration(process.env, api.environment);` and add `auth` to the existing `extra` object. Keep all other fields/resolvers intact.

In `appConfiguration.ts`, import the new resolver/type; add `readonly auth?: unknown` to `ExtraShape`; add:

```typescript
export function readFirebaseAuthConfiguration(
  extra: ExtraShape | null | undefined,
  environment: ApiEnvironment,
): FirebaseAuthConfiguration {
  if (extra === null || extra === undefined || !Object.prototype.hasOwnProperty.call(extra, 'auth')) {
    return resolveFirebaseAuthConfiguration({}, environment);
  }
  const candidate = extra.auth;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new EnvironmentConfigurationError('Expo manifest extra.auth must contain a valid Firebase auth mode.');
  }
  const mode = (candidate as { mode?: unknown }).mode;
  if (typeof mode !== 'string') {
    throw new EnvironmentConfigurationError('Expo manifest extra.auth.mode must be emulator or cloud.');
  }
  return resolveFirebaseAuthConfiguration({ EXPO_PUBLIC_FIREBASE_AUTH_MODE: mode }, environment);
}

export function getFirebaseAuthConfiguration(): FirebaseAuthConfiguration {
  return readFirebaseAuthConfiguration(
    Constants.expoConfig?.extra as ExtraShape | undefined,
    getApiConfiguration().environment,
  );
}
```

Repeat the focused configuration command. Expected GREEN; format through the repository's existing Prettier conventions.

- [x] **Step 3: Add failing native boundary tests in the existing adapter suite.** Change the existing config mock to a mutable `mockAuthMode` returned by `getFirebaseAuthConfiguration`. Extend the existing native module mock with `mockClaimFirebaseAuthMode`, defaulting to true, and the Firebase SDK mock with `mockConnectAuthEmulator`. Type `mockAuth.emulatorConfig` explicitly as `{ protocol: string; host: string; port: number } | null`. Reset mode to cloud, emulatorConfig to null and native mock implementations in `beforeEach`. Keep existing auth tests intact.

```typescript
let mockAuthMode: 'emulator' | 'cloud' = 'cloud';
const mockClaimFirebaseAuthMode = jest.fn((_mode: string) => true);
const mockConnectAuthEmulator = jest.fn((_auth: unknown, _origin: string) => undefined);
const mockNativeModule = {
  getDefaultWebClientId: () => 'synthetic-client-id',
  claimFirebaseAuthMode: mockClaimFirebaseAuthMode,
};
```

Use `jest.isolateModules` when loading the adapter for the new attachment tests so module-level caches cannot leak between tests; existing mocks remain the same. Do not add a test-only reset method to production code.

```typescript
function isolatedAttach(): () => void {
  let attach!: () => void;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolate native adapter cache
    attach = require('./nativeFirebaseAuth').attachLocalAuthEmulator as () => void;
  });
  return attach;
}

it('uses cloud Auth without attaching the local emulator', () => {
  isolatedAttach()();
  expect(mockClaimFirebaseAuthMode).toHaveBeenCalledWith('cloud');
  expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
});

it('claims emulator mode before attaching once', () => {
  mockAuthMode = 'emulator';
  const attach = isolatedAttach();
  attach();
  attach();
  expect(mockConnectAuthEmulator).toHaveBeenCalledTimes(1);
  expect(mockConnectAuthEmulator).toHaveBeenCalledWith(mockAuth, 'http://10.0.2.2:9099');
  expect(mockClaimFirebaseAuthMode.mock.invocationCallOrder[0])
    .toBeLessThan(mockConnectAuthEmulator.mock.invocationCallOrder[0]!);
});

it('rejects native mode conflict even when the JS emulator cache is empty', () => {
  mockClaimFirebaseAuthMode.mockReturnValue(false);
  expect(isolatedAttach()).toThrow('Restart');
  expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
});

it('checks the native guard before the already-attached JS cache can return', () => {
  mockAuthMode = 'emulator';
  const attach = isolatedAttach();
  attach();
  mockAuthMode = 'cloud';
  mockClaimFirebaseAuthMode.mockReturnValue(false);
  expect(attach).toThrow('Restart');
  expect(mockClaimFirebaseAuthMode).toHaveBeenLastCalledWith('cloud');
  expect(mockConnectAuthEmulator).toHaveBeenCalledTimes(1);
});

it('rejects a visible stale emulator in cloud mode', () => {
  mockAuth.emulatorConfig = { protocol: 'http', host: '10.0.2.2', port: 9099 };
  expect(isolatedAttach()).toThrow('Restart');
  expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
});
```

Also add one case where `requireOptionalNativeModule` returns the old module shape without `claimFirebaseAuthMode`; expect a rebuild error and no SDK attachment. Use a mutable mock module variable rather than deleting an inferred required TypeScript property. Add a failing `mockConnectAuthEmulator` test: the thrown original error propagates and a later opposite-mode claim remains rejected by native guard; do not roll back the native claim after failure. The latter test verifies the JS respects a native rejection, not the native latch implementation itself.

Run:

```powershell
pnpm --filter @shortform/mobile test --runInBand src/auth/nativeFirebaseAuth.test.ts
```

Expected RED: no native mode guard is called; local cloud mode cannot yet bypass the old API-coupled attachment.

- [x] **Step 4: Add the native process latch and use it at the shared boundary.** Extend the existing Kotlin module in place; preserve `getDefaultWebClientId` unchanged:

```kotlin
companion object {
  private var processAuthMode: String? = null

  @Synchronized
  private fun claimAuthMode(mode: String): Boolean {
    if (mode != "emulator" && mode != "cloud") return false
    val existing = processAuthMode
    if (existing != null) return existing == mode
    processAuthMode = mode
    return true
  }
}
```

Inside its existing `ModuleDefinition`, after `Name`:

```kotlin
Function("claimFirebaseAuthMode") { mode: String ->
  claimAuthMode(mode)
}
```

The state belongs to the JVM class, not an Expo module instance. Synchronization makes first claim atomic. Invalid values do not bind; once a valid mode binds, later SDK errors do not clear it. No reset/unclaim/exported state method is added. Both transition directions require a new OS process. This does not inspect the SDK's private emulator map; new application code must claim before any auth operation.

In `nativeFirebaseAuth.ts`, replace the `getApiConfiguration` import with `getFirebaseAuthConfiguration`, import the `FirebaseAuthMode` type, and extend `AndroidGoogleWebClientNative` with optional `readonly claimFirebaseAuthMode?: (mode: FirebaseAuthMode) => boolean` to model an older installed APK. Replace the shared attachment function with:

```typescript
export function attachLocalAuthEmulator(): void {
  const { mode } = getFirebaseAuthConfiguration();
  if (Platform.OS === 'android') {
    const native = requireOptionalNativeModule<AndroidGoogleWebClientNative>('AndroidGoogleWebClient');
    if (typeof native?.claimFirebaseAuthMode !== 'function') {
      throw new Error('Rebuild the Android development client to select Firebase authentication safely.');
    }
    if (native.claimFirebaseAuthMode(mode) !== true) {
      throw new Error('Restart the Android app completely before changing Firebase authentication mode.');
    }
  }
  if (mode === 'cloud') {
    if (getAuth().emulatorConfig !== null) {
      throw new Error('Restart the Android app completely before changing Firebase authentication mode.');
    }
    return;
  }
  if (emulatorAttached || isAttachedToExpectedAuthEmulator()) {
    emulatorAttached = true;
    return;
  }
  try {
    connectAuthEmulator(getAuth(), localAuthEmulatorOrigin());
  } catch (error: unknown) {
    if (!isAttachedToExpectedAuthEmulator()) throw error;
  }
  emulatorAttached = true;
}
```

Keep this function called by `createNativeFirebaseAuth` and `nativeSessionLifecycle` before the app requests/observes native auth. The process guard applies to Android, the only shipping MVP platform. Do not claim an iOS process guard exists. Require the new native method for both Android modes: an older APK cannot safely participate in this mode transition protocol, even if its old manifest remains compatible after rebuilding.

Repeat the native test command. Expected GREEN. No JVM test dependency is added; process lifetime is proved in the actual Android verification step.

- [x] **Step 5: Extend the existing Expo configuration gate to prove wiring.** In `checkResolvedConfiguration`, assert `resolved.extra?.auth?.mode === 'emulator'`. Add `EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'cloud'` to the existing `localPurchases` fixture and assert `purchaseConfig.extra?.auth?.mode === 'cloud'` alongside its purchase fields. This reuses its sensitive-value scan and proves local cloud Auth and local sandbox checkout coexist without another large fixture suite. Add `productionConfig.extra?.auth?.mode === 'cloud'` to the existing production config assertion. Add the following small matrix after the existing invalid-mode checks:

```javascript
for (const environment of ['staging', 'production']) {
  const result = runExpoConfig({
    ...REQUIRED_ENVIRONMENT,
    EXPO_PUBLIC_API_ENVIRONMENT: environment,
    EXPO_PUBLIC_API_BASE_URL: 'https://api.example.invalid',
    EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'emulator',
  });
  if (result.status === 0) fail('Firebase Auth emulator must reject nonlocal API environments');
}
const invalidAuthResult = runExpoConfig({
  ...REQUIRED_ENVIRONMENT,
  EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'invalid',
});
if (invalidAuthResult.status === 0) fail('an explicit malformed Firebase auth mode must fail');
```

Run `pnpm mobile:config:check`. Expected PASS, with the new mode public and no credential material introduced. Avoid expanding these into screen tests.

- [x] **Step 6: Document the two exact setups and rollout boundary.** Add near the public API examples in `.env.example`:

```dotenv
# Auth is independent of the API location. Omit for local=emulator, nonlocal=cloud.
# Opt in to cloud for genuine Google sign-in only after private backend setup.
# Auth mode is embedded in the APK: rebuild and install it for every mode change.
# Metro reloads and app restarts alone cannot change the installed mode.
# EXPO_PUBLIC_FIREBASE_AUTH_MODE=cloud
```

In `mobile/README.md` Identity and `docs/runbooks/android-first-journey.md` genuine sign-in section, give these exact engineering examples:

```dotenv
# mobile/.env: generated local accounts, historical default
EXPO_PUBLIC_API_ENVIRONMENT=local
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_FIREBASE_AUTH_MODE=emulator

# Backend .env for the generated-account Auth emulator
FIREBASE_AUTH_MODE=admin
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

```dotenv
# mobile/.env: genuine Firebase Google login against the same local API
EXPO_PUBLIC_API_ENVIRONMENT=local
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_FIREBASE_AUTH_MODE=cloud

# Backend .env: use the same non-production Firebase project as google-services.json
FIREBASE_AUTH_MODE=admin
FIREBASE_PROJECT_ID=replace-with-test-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/private/shortform/firebase-auth-verifier.json
# FIREBASE_AUTH_EMULATOR_HOST must be absent, including inherited process environment.
```

Explain in prose: this credential is a private server-only file outside the public repository and is separate from the RevenueCat Play credential; `EXPO_PUBLIC_*` never carries it. The example path is fictional. Keep `check_revoked=True`; a normal gcloud ADC login is not sufficient Firebase Auth setup. A scoped credential can be checked with a generated nonexistent-UID lookup returning `UserNotFoundError`, with only category-level evidence. The app reads `assets/app.config` embedded in the APK and has no `expo-dev-client` or Expo Updates integration. Rebuild and install the Android development APK for every auth mode change, preserving the existing debug certificate and app data, then start a fresh process. Metro reloads and process restarts alone cannot change this configuration. Gradle regenerates `extra` settings during the build; an auth-mode-only change does not itself require Expo prebuild. A full JS reload must retain the prior native claim; validate it directly before the application reclaims its installed mode, as described in Step 8. No public production activation follows from selecting cloud against this test project.

Do not mark completed Google login, authenticated wallet, provider purchase or process death as passed until observed. Keep other feature flags unchanged. Link official setup and lookup docs if the private server credential explanation needs a source:

- https://firebase.google.com/docs/admin/setup#testing_with_gcloud_end_user_credentials
- https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup

- [x] **Step 7: Run relevant gates sequentially after the native build resource constraint is clear.** Record exact commands/results in the PR, and stop repeating passing gates unless code changes:

```powershell
pnpm mobile:lint
pnpm mobile:format:check
pnpm mobile:typecheck
pnpm mobile:test --runInBand
pnpm mobile:config:check
pnpm mobile:bundle:check
pnpm contract:check
python scripts/check_repository_foundation.py
git diff --check
```

The focused suites in prior steps give RED/GREEN evidence; the full mobile suite protects the existing session/auth behavior. Contract/repository checks remain required even though no API change is intended. Any generated contract diff is unexpected and must be investigated, not bundled casually. Apply formatting only to changed files. No unrelated backend test expansion is required for this mobile-only change.

- [x] **Step 8: Build the x86_64 development APK and prove the native boundary on Android.** Build the development APK from the updated code; the store-registration AAB is separate, with purchases, ads, analytics and App Check disabled. Use the existing local JDK/build wrapper and known private google-services configuration, with purchases/ads/analytics/App Check at their existing disabled settings while validating auth. Build with one Gradle worker and the known low-memory limits; do not run the emulator or Docker concurrently with resource-heavy compilation. The concrete native build target is `:app:assembleDebug -PreactNativeArchitectures=x86_64 --max-workers=1 --no-parallel`. Use `scripts/android_jdk.py` to select the existing JDK rather than overriding system configuration. Preserve the EXISTING debug signing certificate; verify the resulting certificate matches the installed development APK before installing it as an update without clearing application data. Do not use the private release Gradle home `C:/g` or its injected upload-signing properties for this debug build: the registration AAB intentionally has a different private upload certificate. The ignored `.tmp/build_checkout_android.py` helper and normal debug caches may be reused only after inspecting their current configuration for the existing debug signing/build behavior.

Required device procedure (completed observations recorded below):

1. Build and install the emulator-mode APK with the existing debug certificate and without clearing app data. In a fresh process, let the app claim its installed mode and verify account entry/generated-account behavior; repeated calls must not reconnect or reset the account. Record the process ID without account/provider data.
2. In React Native DevTools, set a breakpoint on the first statement of `attachLocalAuthEmulator`. Perform a full JavaScript reload and confirm the OS process ID is unchanged. At the **first post-reload invocation**, before the application claims again, evaluate these native-only calls in order:

   ```javascript
   globalThis.expo.modules.AndroidGoogleWebClient.claimFirebaseAuthMode('cloud'); // must be false
   globalThis.expo.modules.AndroidGoogleWebClient.claimFirebaseAuthMode('emulator'); // must be true
   ```

   Resume only if both results match. Otherwise stop and record the failed guard check. Do not inspect account data, invoke credential exchange or change Firebase SDK configuration in the debugger. This checks whether the native claim survived the reload before application code can repopulate it; it does not change or test a new Metro manifest.
3. Rebuild and install a cloud-mode APK through the authorized install/start workflow, preserving the debug certificate and app data, and start a fresh process. Gradle regenerates the embedded `assets/app.config`; no Expo prebuild is needed solely for this `extra` setting. Let the app claim cloud mode. Complete Google sign-in using the authorized test account and genuine-verification backend; Account and Coin wallet must resolve successfully.
4. With the cloud-mode process still alive, repeat the breakpoint/full-JS-reload procedure and verify the same OS process ID. Before the application's **first post-reload claim**, evaluate the reverse calls:

   ```javascript
   globalThis.expo.modules.AndroidGoogleWebClient.claimFirebaseAuthMode('emulator'); // must be false
   globalThis.expo.modules.AndroidGoogleWebClient.claimFirebaseAuthMode('cloud'); // must be true
   ```

   Resume only on the expected results. Together these native observations prove claim persistence in both directions and complement the adapter tests that reject conflicts before SDK/cache access. Restore any intended configuration using rebuild/install/start, not a Metro reload or process restart alone.
5. Guard claims remain sticky after an attach/login failure; a network/provider failure must not unlock the opposite mode in the same process. Do not create destructive faults or expose credentials just to simulate this; the synchronized claim code is reviewed and the adapter failure-path test supplies deterministic coverage.

The native reload check does not prove process death, a changed installed manifest, or genuine provider login; record those outcomes separately. Do not bypass a prior approval-review denial of `adb` force-stop/start through another route. If an authorized install/start workflow cannot establish the required process state, record that blocker and leave this step unchecked.

No new debug UI, secret-bearing logs or screenshots are needed. If tools cannot perform a required native check, record the actual blocker; this auth boundary is not eligible for a fictional pass or silent deferral. Respect any existing approval-review rejection rather than retrying the denied OS action through another route.

- [x] **Step 9: Review, commit and PR.** Independently review auth safety and conformance after implementation: mode guard precedes SDK reads and all cached returns; missing/malformed manifests differ; both native transitions reject; no branch of sign-in or restore bypasses the boundary; no credential/purchase gate changes. Fix findings and rerun only affected checks. Commit only this task's code/tests/docs, reference `Closes #175` and D-036 in one PR, attach it to the task, and apply the founder's existing conditional review/merge authorization only when required checks and real native guard evidence pass. Preserve honest unchecked provider/device outcomes in #164.

## Implementation verification (2026-09-19)

- Configuration RED: all 19 new cases failed because the reader/resolver was absent. Malformed-manifest assertions require `EnvironmentConfigurationError`, avoiding false positives from a missing function. GREEN: all 33 configuration tests passed.
- Native boundary RED: all 9 new cases failed because the mode guard was absent. GREEN: all 21 adapter tests passed, including both rejected modes before SDK access, old-APK rejection, cached-return ordering and attach-failure propagation.
- `pnpm mobile:config:check` passed with local cloud Auth plus sandbox checkout and the nonlocal/malformed-mode rejection matrix.
- Native compilation and Step 8 observations were pending during the initial unit-test pass; their completed evidence is recorded below. Mocked adapter tests are not native device evidence.
- P2 documentation correction: auth mode is embedded in `assets/app.config`; changing it requires rebuild/install. Step 8 now probes the retained native latch at the first post-reload breakpoint under the same OS process ID, then repeats with the opposite-mode APK. No device outcome is newly claimed.

Exact local commands and final outcomes:

| Command | Result |
| --- | --- |
| `pnpm --filter @shortform/mobile test --runInBand src/config/appConfiguration.test.ts` | RED: 19 new cases failed; GREEN: 33 tests passed. |
| `pnpm --filter @shortform/mobile test --runInBand src/auth/nativeFirebaseAuth.test.ts` | RED: 9 new cases failed; GREEN: 21 tests passed. |
| `pnpm mobile:lint` | Passed after replacing the plan's loose null comparison with explicit null/undefined checks. |
| `pnpm mobile:format:check` | Passed after formatting the changed runtime configuration file. |
| `pnpm mobile:typecheck` | Passed. |
| `pnpm mobile:test --runInBand` | Passed: 47 suites, 446 tests. |
| `pnpm mobile:config:check` | Passed, including cloud Auth with local sandbox checkout. |
| `pnpm mobile:bundle:check` | Passed: Android production JavaScript bundle; no native compilation. |
| `pnpm contract:check` | Passed; no generated OpenAPI/client diff. |
| `python scripts/check_repository_foundation.py` | Passed: safety scan (581 files), 55 repository tests and AI governance. |
| `git diff --check` | Passed. |

### Verification after Expo SDK patch alignment (2026-09-19)

Root aligned Expo to 57.0.24, expo-build-properties to 57.0.21, expo-constants to
57.0.19 and expo-router to 57.0.22, then deduplicated expo-constants. With that
updated dependency tree, the following commands ran sequentially and passed:

- `pnpm mobile:lint`
- `pnpm mobile:format:check`
- `pnpm mobile:typecheck`
- `pnpm mobile:test --runInBand` — 47 suites, 446 tests, 21.23 seconds.
- `pnpm mobile:config:check` — public manifest and fail-closed configuration checks.
- `pnpm mobile:bundle:check` — Android production JavaScript bundle; no native compile.
- `pnpm contract:check` — no generated OpenAPI/client diff.
- `python scripts/check_repository_foundation.py` — safety scan of 581 files,
  55 repository tests, and AI governance passed.
- `git diff --check`

No source/dependency changes were made during this verification pass. Native
compilation and Step 8 observations followed separately below.

### Native and genuine Google verification (2026-09-19)

The tested application source and dependencies are revision `7d9eeed`; subsequent
plan updates only record these results.

- Both x86_64 debug APKs compiled using the normal debug Gradle home and one
  worker. Archive inspection confirmed the expected embedded auth mode, native
  guard, package and BILLING permission, disabled optional features, and the
  same debug signing certificate as the preserved baseline. Each installed with
  `adb install -r` without clearing app data. The founder opened each updated app.
- The separately signed ARM64 registration AAB also compiled. Its release
  signature, nondebuggable manifest, disabled optional features, archive secret
  scan and at least 16 KiB ELF LOAD alignment passed. It is not an x86_64 device
  artifact or evidence of a Play upload/purchase.
- Emulator mode started cleanly. A fresh generated test account signed in,
  loaded Account and the server's Coin wallet, survived a full JavaScript reload,
  and signed out successfully.
- In emulator mode, before the first application claim after a full JavaScript
  reload, native `claimFirebaseAuthMode('cloud')` returned `false` and
  `claimFirebaseAuthMode('emulator')` returned `true`. `adb shell pidof
  com.shortformstreaming.app` confirmed the same Android process before/after.
- In cloud mode, the corresponding first-call observation returned `false` for
  emulator and `true` for cloud, also with an unchanged Android process.
- Source-map breakpoint binding missed early startup on one attempt. A temporary
  first-statement `debugger` line therefore supplied an unambiguous pause before
  the application reclaimed its mode. It was removed after each check; a clean
  `git diff --exit-code -- mobile/src/auth/nativeFirebaseAuth.ts` and a full reload
  restored the exact committed source before normal account tests. No credential
  exchange, account-data inspection or SDK reconfiguration ran in the debugger.
- With the private backend using Firebase Admin verification and no Auth
  emulator host, the founder completed genuine Google sign-in. Account and Coin
  wallet loaded successfully. After another full JavaScript reload, both loaded
  again without requesting sign-in. Purchases, rewarded ads and sandbox webhooks
  remained disabled.
- Independent implementation/dependency review found no remaining code blockers;
  the embedded-configuration documentation finding was fixed before these builds.
  PR #176 records the required CI results and final merge status.

These results complete this auth-mode follow-up. Genuine Play purchase/credit,
refunds, full reinstall, second-device behavior and OS process-death validation
remain separate unchecked journey items in #164. No launch-readiness claim is made.

## Plan self-review

- Scope covers issue #175 in one independently reviewable deliverable.
- All code lives at existing configuration/auth/native-module boundaries; no new dependency or subsystem.
- New SDK evidence corrects the earlier JS-only assumption. The native process latch requires a new development APK.
- Test layers are config parsing/wiring, JS-to-native boundary and actual native process lifetime; no duplicate client/screen/smoke suite.
- Implementation is scoped to issue #175. Native build/device checks and independent review passed; unrelated provider journey checks remain tracked in #164.

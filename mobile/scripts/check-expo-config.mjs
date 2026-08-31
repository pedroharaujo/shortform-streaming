/**
 * Validate that the Expo configuration resolves and that only explicit,
 * non-sensitive public values reach the client manifest.
 *
 * This runs `expo config --type public`, which is exactly the configuration
 * embedded in the JavaScript bundle, and then asserts:
 *   1. required environment handling produced `extra.api`;
 *   2. a missing or invalid environment fails the build instead of defaulting;
 *   3. no resolved key or value looks like a secret.
 *
 * Written in plain JavaScript on purpose: it must run with bare Node before any
 * TypeScript build step exists.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MOBILE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXPO_CLI = createRequire(import.meta.url).resolve('expo/bin/cli');

const REQUIRED_ENVIRONMENT = {
  EXPO_PUBLIC_API_ENVIRONMENT: 'local',
  EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8000',
  EXPO_PUBLIC_CATALOG_TERRITORY: 'FR',
};

const SENSITIVE_NAME = new RegExp(
  ['secret', 'password', 'passwd', 'token', 'credential', 'private.?key', 'api.?key'].join('|'),
  'i',
);

const SENSITIVE_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
  /\b[rs]k_live_[0-9A-Za-z]{16,}\b/,
];

function runExpoConfig(environment) {
  return spawnSync(process.execPath, [EXPO_CLI, 'config', '--type', 'public', '--json'], {
    cwd: MOBILE_ROOT,
    encoding: 'utf8',
    env: { ...baseEnvironment(), EXPO_NO_DOTENV: '1', ...environment },
  });
}

/** Strip inherited EXPO_PUBLIC_* values so the check is deterministic. */
function baseEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_')),
  );
}

function fail(message) {
  process.stderr.write(`Expo configuration check failed: ${message}\n`);
  process.exitCode = 1;
}

function walk(value, keyPath, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${keyPath}[${index}]`, visit));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      visit(key, nested, keyPath === '' ? key : `${keyPath}.${key}`);
      walk(nested, keyPath === '' ? key : `${keyPath}.${key}`, visit);
    }
  }
}

function checkResolvedConfiguration() {
  const result = runExpoConfig(REQUIRED_ENVIRONMENT);
  if (result.status !== 0) {
    fail(`expo config exited with ${result.status}.\n${result.stderr ?? ''}`);
    return;
  }

  let resolved;
  try {
    resolved = JSON.parse(result.stdout);
  } catch (error) {
    fail(`expo config did not return JSON (${error.message}).`);
    return;
  }

  const api = resolved?.extra?.api;
  if (
    api?.environment !== 'local' ||
    api?.baseUrl !== REQUIRED_ENVIRONMENT.EXPO_PUBLIC_API_BASE_URL ||
    api?.catalogTerritory !== REQUIRED_ENVIRONMENT.EXPO_PUBLIC_CATALOG_TERRITORY
  ) {
    fail(`extra.api was not resolved from the environment: ${JSON.stringify(api)}`);
    return;
  }

  const offenders = [];
  const adsPlugin = resolved.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads',
  );
  if (
    resolved.extra?.ads?.androidAppId !== 'ca-app-pub-3940256099942544~3347511713' ||
    resolved.extra?.ads?.rewardedUnitId !== 'ca-app-pub-3940256099942544/5224354917' ||
    adsPlugin?.[1]?.androidAppId !== 'ca-app-pub-3940256099942544~3347511713' ||
    adsPlugin?.[1]?.delayAppMeasurementInit !== true
  ) {
    fail('rewarded ads must use the Google demo app and delay native measurement initialization.');
    return;
  }
  walk(resolved, '', (key, value, keyPath) => {
    if (SENSITIVE_NAME.test(key)) {
      offenders.push(`${keyPath} (sensitive key name)`);
    }
    if (typeof value === 'string' && SENSITIVE_VALUE_PATTERNS.some((p) => p.test(value))) {
      offenders.push(`${keyPath} (credential-shaped value)`);
    }
  });

  if (offenders.length > 0) {
    fail(`public Expo config contains sensitive material: ${offenders.join(', ')}`);
    return;
  }

  process.stdout.write(
    `Expo public config resolved for environment "${api.environment}" -> ${api.baseUrl} ` +
      `(catalog territory ${api.catalogTerritory}); ` +
      'no sensitive keys or credential-shaped values present.\n',
  );
}

function checkMissingEnvironmentFails() {
  const result = runExpoConfig({});
  if (result.status === 0) {
    fail('expo config succeeded without EXPO_PUBLIC_API_ENVIRONMENT; it must fail loudly.');
    return;
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!output.includes('EXPO_PUBLIC_API_ENVIRONMENT')) {
    fail('missing-environment failure did not name EXPO_PUBLIC_API_ENVIRONMENT.');
    return;
  }
  process.stdout.write('Missing environment configuration fails the Expo config as required.\n');
}

function checkInvalidEnvironmentFails() {
  const result = runExpoConfig({
    ...REQUIRED_ENVIRONMENT,
    EXPO_PUBLIC_API_ENVIRONMENT: 'prod',
  });
  if (result.status === 0) {
    fail('expo config accepted an unknown environment name.');
    return;
  }
  process.stdout.write('Invalid environment name fails the Expo config as required.\n');
}

function checkMissingTerritoryFails() {
  const result = runExpoConfig({
    EXPO_PUBLIC_API_ENVIRONMENT: 'local',
    EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8000',
  });
  if (result.status === 0) {
    fail('expo config succeeded without EXPO_PUBLIC_CATALOG_TERRITORY; it must fail loudly.');
    return;
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!output.includes('EXPO_PUBLIC_CATALOG_TERRITORY')) {
    fail('missing-territory failure did not name EXPO_PUBLIC_CATALOG_TERRITORY.');
    return;
  }
  process.stdout.write(
    'Missing catalog territory configuration fails the Expo config as required.\n',
  );
}

function checkInvalidTerritoryFails() {
  const result = runExpoConfig({
    ...REQUIRED_ENVIRONMENT,
    EXPO_PUBLIC_CATALOG_TERRITORY: 'FRA',
  });
  if (result.status === 0) {
    fail('expo config accepted a catalog territory that is not ISO 3166-1 alpha-2.');
    return;
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!output.includes('EXPO_PUBLIC_CATALOG_TERRITORY')) {
    fail('invalid-territory failure did not name EXPO_PUBLIC_CATALOG_TERRITORY.');
    return;
  }
  process.stdout.write('Invalid catalog territory fails the Expo config as required.\n');
}

checkResolvedConfiguration();
checkMissingEnvironmentFails();
checkInvalidEnvironmentFails();
checkMissingTerritoryFails();
checkInvalidTerritoryFails();

const publisher = {
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1111111111111111~3333333333',
  EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: 'ca-app-pub-1111111111111111/2222222222',
};
const publisherResult = runExpoConfig({ ...REQUIRED_ENVIRONMENT, ...publisher });
if (publisherResult.status !== 0) {
  fail('local publisher test config must resolve');
} else {
  const config = JSON.parse(publisherResult.stdout);
  const plugin = config.plugins.find(
    (item) => Array.isArray(item) && item[0] === 'react-native-google-mobile-ads',
  );
  if (
    config.extra?.ads?.androidAppId !== publisher.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
    config.extra?.ads?.rewardedUnitId !== publisher.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID ||
    plugin?.[1]?.androidAppId !== publisher.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
    plugin?.[1]?.delayAppMeasurementInit !== true
  )
    fail('publisher IDs must be frozen in extra.ads and the native plugin');
}
for (const overrides of [
  { ...publisher, EXPO_PUBLIC_API_ENVIRONMENT: 'staging' },
  { ...publisher, EXPO_PUBLIC_API_ENVIRONMENT: 'production' },
  { EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: publisher.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID },
  { EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: publisher.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID },
  {
    ...publisher,
    EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: publisher.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID + '\n',
  },
  { ...publisher, EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: '' },
  { ...publisher, EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: '' },
  { ...publisher, EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'malformed' },
  { ...publisher, EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: 'malformed' },
  { ...publisher, EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: 'ca-app-pub-9999999999999999/2222222222' },
  { ...publisher, EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: ' ca-app-pub-1111111111111111~3333333333' },
  { EXPO_PUBLIC_API_ENVIRONMENT: 'staging', EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: '' },
]) {
  const result = runExpoConfig({
    ...REQUIRED_ENVIRONMENT,
    EXPO_PUBLIC_API_BASE_URL: 'https://api.example.invalid',
    ...overrides,
  });
  if (result.status === 0 || !`${result.stdout}${result.stderr}`.includes('EXPO_PUBLIC_ADMOB'))
    fail('invalid publisher scope/pair must fail with an AdMob configuration error');
}

if (!process.exitCode)
  process.stdout.write(
    'Publisher test config embeds paired IDs; invalid pairs and nonlocal overrides fail closed.\n',
  );

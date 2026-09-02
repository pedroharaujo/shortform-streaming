import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Typed Expo configuration and the single implementation of environment
 * selection for the mobile application.
 *
 * The resolver lives in this file because the Expo configuration loader
 * transpiles only the configuration file itself and cannot require another
 * TypeScript module. Application code re-exports it through
 * `src/config/environment.ts`, so there is exactly one implementation.
 *
 * Only `EXPO_PUBLIC_*` variables are read, and everything placed in `extra`
 * ships inside the public JavaScript bundle. Never add a secret, key, token, or
 * credential here; put server-side material behind the backend instead.
 *
 * There is deliberately no default: an absent or malformed configuration fails
 * the build instead of silently selecting an environment.
 */

export const API_ENVIRONMENTS = ['local', 'staging', 'production'] as const;

export type ApiEnvironment = (typeof API_ENVIRONMENTS)[number];

export interface ApiConfiguration {
  readonly environment: ApiEnvironment;
  readonly baseUrl: string;
}

export const REWARDED_ADS_MODES = ['disabled', 'test', 'production'] as const;
export type RewardedAdsMode = (typeof REWARDED_ADS_MODES)[number];

export interface AdsConfiguration {
  readonly mode: RewardedAdsMode;
  readonly androidAppId: string;
  readonly rewardedUnitId: string;
}

export const APP_CHECK_MODES = ['disabled', 'enforce'] as const;
export type AppCheckMode = (typeof APP_CHECK_MODES)[number];

export interface AppCheckConfiguration {
  readonly mode: AppCheckMode;
}

export const API_ENVIRONMENT_VARIABLE = 'EXPO_PUBLIC_API_ENVIRONMENT';
export const API_BASE_URL_VARIABLE = 'EXPO_PUBLIC_API_BASE_URL';

export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentConfigurationError';
  }
}

const SENSITIVE_NAME_PATTERN = new RegExp(
  ['secret', 'password', 'passwd', 'token', 'credential', 'private.?key', 'api.?key'].join('|'),
  'i',
);

function isApiEnvironment(value: string): value is ApiEnvironment {
  return (API_ENVIRONMENTS as readonly string[]).includes(value);
}

function requireValue(source: Readonly<Record<string, string | undefined>>, name: string): string {
  const raw = source[name];
  if (raw === undefined || raw.trim() === '') {
    throw new EnvironmentConfigurationError(
      `${name} is required. Set it explicitly (see .env.example and mobile/README.md); ` +
        'the mobile app never falls back to a default environment.',
    );
  }
  return raw.trim();
}

function parseBaseUrl(rawValue: string, environment: ApiEnvironment): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new EnvironmentConfigurationError(
      `${API_BASE_URL_VARIABLE} must be an absolute URL, for example http://10.0.2.2:8000.`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new EnvironmentConfigurationError(
      `${API_BASE_URL_VARIABLE} must use http or https, not ${parsed.protocol.replace(':', '')}.`,
    );
  }

  if (parsed.protocol === 'http:' && environment !== 'local') {
    throw new EnvironmentConfigurationError(
      `${API_BASE_URL_VARIABLE} must use https when ${API_ENVIRONMENT_VARIABLE} is ${environment}.`,
    );
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    throw new EnvironmentConfigurationError(
      `${API_BASE_URL_VARIABLE} must not contain a query string or fragment.`,
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new EnvironmentConfigurationError(
      `${API_BASE_URL_VARIABLE} must not embed credentials; the bundle is public.`,
    );
  }

  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

/**
 * Reject any `EXPO_PUBLIC_*` variable whose name suggests a secret, because
 * every such value is inlined into the client bundle.
 */
function rejectPublicSecrets(source: Readonly<Record<string, string | undefined>>): void {
  const offenders = Object.keys(source)
    .filter((name) => name.startsWith('EXPO_PUBLIC_'))
    .filter((name) => SENSITIVE_NAME_PATTERN.test(name))
    .sort();

  if (offenders.length > 0) {
    throw new EnvironmentConfigurationError(
      `Refusing to build: ${offenders.join(', ')} would be embedded in the public JavaScript ` +
        'bundle. Move the value behind the backend, or use a build-time-only variable without ' +
        'the EXPO_PUBLIC_ prefix.',
    );
  }
}

export function resolveApiConfiguration(
  source: Readonly<Record<string, string | undefined>>,
): ApiConfiguration {
  rejectPublicSecrets(source);

  const rawEnvironment = requireValue(source, API_ENVIRONMENT_VARIABLE);
  if (!isApiEnvironment(rawEnvironment)) {
    throw new EnvironmentConfigurationError(
      `${API_ENVIRONMENT_VARIABLE} must be one of ${API_ENVIRONMENTS.join(', ')}, ` +
        `received ${JSON.stringify(rawEnvironment)}.`,
    );
  }

  const baseUrl = parseBaseUrl(requireValue(source, API_BASE_URL_VARIABLE), rawEnvironment);
  return { environment: rawEnvironment, baseUrl };
}

export const DEMO_REWARDED_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const DEMO_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

export function resolveAdsConfiguration(
  source: Readonly<Record<string, string | undefined>>,
  environment: ApiEnvironment,
): AdsConfiguration {
  const rawMode =
    source.EXPO_PUBLIC_REWARDED_ADS_MODE ?? (environment === 'production' ? 'disabled' : 'test');
  if (!(REWARDED_ADS_MODES as readonly string[]).includes(rawMode)) {
    throw new EnvironmentConfigurationError(
      `EXPO_PUBLIC_REWARDED_ADS_MODE must be one of ${REWARDED_ADS_MODES.join(', ')}.`,
    );
  }
  const mode = rawMode as RewardedAdsMode;
  if (mode === 'production' && environment !== 'production') {
    throw new EnvironmentConfigurationError(
      'Production rewarded ads require EXPO_PUBLIC_API_ENVIRONMENT=production.',
    );
  }
  if (mode === 'test' && environment === 'production') {
    throw new EnvironmentConfigurationError('Production builds cannot use rewarded-ad test mode.');
  }
  const androidAppId = source.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
  const rewardedUnitId = source.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID;
  if (androidAppId === undefined && rewardedUnitId === undefined) {
    if (mode === 'production') {
      throw new EnvironmentConfigurationError(
        'Production rewarded ads require publisher-owned AdMob app and rewarded-unit IDs.',
      );
    }
    return { mode, androidAppId: DEMO_ANDROID_APP_ID, rewardedUnitId: DEMO_REWARDED_UNIT_ID };
  }
  const appPublisher = /^ca-app-pub-(\d{16})~\d{10}$/.exec(androidAppId ?? '');
  const unitPublisher = /^ca-app-pub-(\d{16})\/\d{10}$/.exec(rewardedUnitId ?? '');
  if (!appPublisher || !unitPublisher || appPublisher[1] !== unitPublisher[1]) {
    throw new EnvironmentConfigurationError(
      'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID and EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID must be a complete, valid same-publisher pair.',
    );
  }
  const isDemoPair =
    androidAppId === DEMO_ANDROID_APP_ID && rewardedUnitId === DEMO_REWARDED_UNIT_ID;
  if (mode === 'production' && isDemoPair) {
    throw new EnvironmentConfigurationError('Production rewarded ads cannot use Google demo IDs.');
  }
  if (mode === 'test' && environment !== 'local' && !isDemoPair) {
    throw new EnvironmentConfigurationError(
      'Publisher-owned rewarded-ad test IDs are allowed only in local emulator builds.',
    );
  }
  return { mode, androidAppId: androidAppId!, rewardedUnitId: rewardedUnitId! };
}

export function resolveAnalyticsConfiguration(
  source: Readonly<Record<string, string | undefined>>,
  environment: ApiEnvironment,
): { readonly enabled: boolean } {
  const raw = source.EXPO_PUBLIC_ANALYTICS_ENABLED;
  if (raw === undefined) return { enabled: environment !== 'production' };
  if (raw !== 'true' && raw !== 'false') {
    throw new EnvironmentConfigurationError('EXPO_PUBLIC_ANALYTICS_ENABLED must be true or false.');
  }
  return { enabled: raw === 'true' };
}

export function resolveAppCheckConfiguration(
  source: Readonly<Record<string, string | undefined>>,
): AppCheckConfiguration {
  const mode = source.EXPO_PUBLIC_FIREBASE_APP_CHECK_MODE ?? 'disabled';
  if (!(APP_CHECK_MODES as readonly string[]).includes(mode)) {
    throw new EnvironmentConfigurationError(
      `EXPO_PUBLIC_FIREBASE_APP_CHECK_MODE must be one of ${APP_CHECK_MODES.join(', ')}.`,
    );
  }
  return { mode: mode as AppCheckMode };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const api = resolveApiConfiguration(process.env);
  const ads = resolveAdsConfiguration(process.env, api.environment);
  const analytics = resolveAnalyticsConfiguration(process.env, api.environment);
  const appCheck = resolveAppCheckConfiguration(process.env);

  return {
    ...config,
    name: 'Shortform',
    slug: 'shortform-streaming',
    scheme: 'shortform',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    android: {
      package: 'com.shortformstreaming.app',
      // Path only; Expo JS export does not read the gitignored file. Prebuild
      // copies it when present. The MVP ships Android only.
      googleServicesFile: './google-services.json',
    },
    plugins: [
      'expo-router',
      'expo-video',
      'expo-secure-store',
      '@react-native-firebase/app',
      '@react-native-firebase/app-check',
      '@react-native-firebase/analytics',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: ads.androidAppId,
          delayAppMeasurementInit: true,
        },
      ],
    ],
    experiments: { typedRoutes: true },
    extra: { api, ads, analytics, appCheck },
  };
};

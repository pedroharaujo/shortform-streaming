/**
 * Runtime access to the configuration frozen into the Expo manifest by
 * `app.config.ts`. The values are public by construction; see
 * `src/config/environment.ts` for the secret-safety rule.
 */

import Constants from 'expo-constants';
import {
  resolveAdsConfiguration,
  type AdsConfiguration,
  type AppCheckConfiguration,
} from '../../app.config';

import {
  API_ENVIRONMENTS,
  EnvironmentConfigurationError,
  type ApiConfiguration,
  type ApiEnvironment,
} from './environment';

interface ExtraShape {
  readonly api?: unknown;
  readonly ads?: unknown;
  readonly analytics?: unknown;
  readonly appCheck?: unknown;
}

function isApiEnvironment(value: unknown): value is ApiEnvironment {
  return typeof value === 'string' && (API_ENVIRONMENTS as readonly string[]).includes(value);
}

export function readApiConfiguration(extra: ExtraShape | null | undefined): ApiConfiguration {
  const candidate = extra?.api;
  if (typeof candidate !== 'object' || candidate === null) {
    throw new EnvironmentConfigurationError(
      'Expo manifest is missing extra.api. Rebuild the development client with the required ' +
        'EXPO_PUBLIC_* variables set.',
    );
  }

  const { environment, baseUrl } = candidate as {
    environment?: unknown;
    baseUrl?: unknown;
  };
  if (!isApiEnvironment(environment)) {
    throw new EnvironmentConfigurationError(
      `Expo manifest extra.api.environment must be one of ${API_ENVIRONMENTS.join(', ')}.`,
    );
  }
  if (typeof baseUrl !== 'string' || baseUrl === '') {
    throw new EnvironmentConfigurationError(
      'Expo manifest extra.api.baseUrl must be a non-empty absolute URL.',
    );
  }
  return { environment, baseUrl };
}

export function getApiConfiguration(): ApiConfiguration {
  return readApiConfiguration(Constants.expoConfig?.extra as ExtraShape | null | undefined);
}

export function readAdsConfiguration(
  extra: ExtraShape | null | undefined,
  environment: ApiEnvironment,
): AdsConfiguration {
  const ads = extra?.ads as
    { mode?: unknown; androidAppId?: unknown; rewardedUnitId?: unknown } | undefined;
  if (typeof ads?.androidAppId !== 'string' || typeof ads?.rewardedUnitId !== 'string') {
    throw new EnvironmentConfigurationError(
      'Expo manifest is missing extra.ads. Rebuild the development client.',
    );
  }
  // Manifest values are frozen with the native app ID, never read from process.env at runtime.
  // The default demo pair is valid in staging as well as local builds.
  return resolveAdsConfiguration(
    {
      EXPO_PUBLIC_REWARDED_ADS_MODE: typeof ads.mode === 'string' ? ads.mode : undefined,
      EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: ads.androidAppId,
      EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: ads.rewardedUnitId,
    },
    environment,
  );
}

export function getAdsConfiguration(): AdsConfiguration {
  const extra = Constants.expoConfig?.extra as ExtraShape | undefined;
  return readAdsConfiguration(extra, getApiConfiguration().environment);
}

export function readAnalyticsEnabled(extra: ExtraShape | null | undefined): boolean {
  const enabled = (extra?.analytics as { enabled?: unknown } | undefined)?.enabled;
  if (typeof enabled !== 'boolean') {
    throw new EnvironmentConfigurationError(
      'Expo manifest is missing extra.analytics.enabled. Rebuild the development client.',
    );
  }
  return enabled;
}

export function isAnalyticsEnabled(): boolean {
  return readAnalyticsEnabled(Constants.expoConfig?.extra as ExtraShape | undefined);
}

export function readAppCheckConfiguration(
  extra: ExtraShape | null | undefined,
): AppCheckConfiguration {
  const mode = (extra?.appCheck as { mode?: unknown } | undefined)?.mode;
  if (mode !== 'disabled' && mode !== 'enforce') {
    throw new EnvironmentConfigurationError(
      'Expo manifest is missing a valid extra.appCheck.mode. Rebuild the development client.',
    );
  }
  return { mode };
}

export function getAppCheckConfiguration(): AppCheckConfiguration {
  return readAppCheckConfiguration(Constants.expoConfig?.extra as ExtraShape | undefined);
}

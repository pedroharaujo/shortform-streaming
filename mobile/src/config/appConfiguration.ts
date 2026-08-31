/**
 * Runtime access to the configuration frozen into the Expo manifest by
 * `app.config.ts`. The values are public by construction; see
 * `src/config/environment.ts` for the secret-safety rule.
 */

import Constants from 'expo-constants';
import { resolveAdsConfiguration } from '../../app.config';

import {
  API_ENVIRONMENTS,
  EnvironmentConfigurationError,
  type ApiConfiguration,
  type ApiEnvironment,
} from './environment';

interface ExtraShape {
  readonly api?: unknown;
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

  const { environment, baseUrl, catalogTerritory } = candidate as {
    environment?: unknown;
    baseUrl?: unknown;
    catalogTerritory?: unknown;
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
  if (typeof catalogTerritory !== 'string' || !/^[A-Z]{2}$/.test(catalogTerritory)) {
    throw new EnvironmentConfigurationError(
      'Expo manifest extra.api.catalogTerritory must be ISO 3166-1 alpha-2, for example FR.',
    );
  }

  return { environment, baseUrl, catalogTerritory };
}

export function getApiConfiguration(): ApiConfiguration {
  return readApiConfiguration(Constants.expoConfig?.extra as ExtraShape | null | undefined);
}

export function getRewardedAdUnitId(): string {
  const ads = Constants.expoConfig?.extra?.ads as
    { androidAppId?: unknown; rewardedUnitId?: unknown } | undefined;
  if (typeof ads?.androidAppId !== 'string' || typeof ads?.rewardedUnitId !== 'string') {
    throw new EnvironmentConfigurationError(
      'Expo manifest is missing extra.ads. Rebuild the development client.',
    );
  }
  // Manifest values are frozen with the native app ID, never read from process.env at runtime.
  // The default demo pair is valid in staging as well as local builds.
  const validated = resolveAdsConfiguration(
    {
      EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: ads.androidAppId,
      EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: ads.rewardedUnitId,
    },
    'local',
  );
  return validated.rewardedUnitId;
}

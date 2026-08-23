/**
 * Runtime access to the configuration frozen into the Expo manifest by
 * `app.config.ts`. The values are public by construction; see
 * `src/config/environment.ts` for the secret-safety rule.
 */

import Constants from 'expo-constants';

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

  const { environment, baseUrl } = candidate as { environment?: unknown; baseUrl?: unknown };
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

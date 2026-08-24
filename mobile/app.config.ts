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
  readonly catalogTerritory: string;
}

export const API_ENVIRONMENT_VARIABLE = 'EXPO_PUBLIC_API_ENVIRONMENT';
export const API_BASE_URL_VARIABLE = 'EXPO_PUBLIC_API_BASE_URL';
export const CATALOG_TERRITORY_VARIABLE = 'EXPO_PUBLIC_CATALOG_TERRITORY';

const ISO_3166_1_ALPHA_2 = /^[A-Za-z]{2}$/;

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

function parseCatalogTerritory(rawValue: string): string {
  if (!ISO_3166_1_ALPHA_2.test(rawValue)) {
    throw new EnvironmentConfigurationError(
      `${CATALOG_TERRITORY_VARIABLE} must be ISO 3166-1 alpha-2, for example FR. ` +
        'It is never inferred from device locale or Accept-Language.',
    );
  }
  return rawValue.toUpperCase();
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
  const catalogTerritory = parseCatalogTerritory(requireValue(source, CATALOG_TERRITORY_VARIABLE));

  return { environment: rawEnvironment, baseUrl, catalogTerritory };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const api = resolveApiConfiguration(process.env);

  return {
    ...config,
    name: 'Shortform',
    slug: 'shortform-streaming',
    scheme: 'shortform',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    android: { package: 'com.shortformstreaming.app' },
    ios: { bundleIdentifier: 'com.shortformstreaming.app', supportsTablet: false },
    plugins: ['expo-router'],
    experiments: { typedRoutes: true },
    extra: { api },
  };
};

/**
 * Application-facing entry point for environment selection.
 *
 * The implementation lives in `app.config.ts` because the Expo configuration
 * loader cannot require another TypeScript module; this module keeps a single
 * import path for application code and tests.
 */

export {
  API_BASE_URL_VARIABLE,
  API_ENVIRONMENTS,
  API_ENVIRONMENT_VARIABLE,
  CATALOG_TERRITORY_VARIABLE,
  EnvironmentConfigurationError,
  resolveApiConfiguration,
} from '../../app.config';
export type { ApiConfiguration, ApiEnvironment } from '../../app.config';

/**
 * Process-wide analytics consent controller.
 *
 * Expo routes are mounted independently, but Firebase Analytics state is
 * process-wide. Sharing one controller serializes account replacement,
 * consent withdrawal, sign-out, and deletion cleanup across those routes.
 */

import { getAuthSessionRevision, getSessionCredential } from '../auth/session';
import { getApiConfiguration } from '../config/appConfiguration';
import type { ApiEnvironment } from '../config/environment';
import {
  createAnalyticsConsentController,
  type AnalyticsConsentAdapter,
  type AnalyticsConsentController,
} from './consentController';

let appController: AnalyticsConsentController | null = null;

function isJestRuntime(): boolean {
  // Native Firebase must stay off the Jest module graph.
  // eslint-disable-next-line no-restricted-syntax -- JEST_WORKER_ID is the Jest/native gate, not a public bundle value
  return typeof process.env.JEST_WORKER_ID === 'string';
}

function createNoopAdapter(): AnalyticsConsentAdapter {
  return {
    setCollectionEnabled: async () => undefined,
    setConsent: async () => undefined,
    setUserId: async () => undefined,
    resetData: async () => undefined,
  };
}

export function selectAnalyticsConsentAdapter(options: {
  readonly environment: ApiEnvironment;
  readonly createNativeAdapter: () => AnalyticsConsentAdapter;
}): AnalyticsConsentAdapter {
  if (options.environment === 'production') return createNoopAdapter();
  return options.createNativeAdapter();
}

function createAdapter(): AnalyticsConsentAdapter {
  if (isJestRuntime()) return createNoopAdapter();
  return selectAnalyticsConsentAdapter({
    environment: getApiConfiguration().environment,
    createNativeAdapter: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load keeps the native SDK out of Jest and disabled production
      const loaded = require('./nativeAnalyticsConsent') as {
        createNativeAnalyticsConsentAdapter: () => AnalyticsConsentAdapter;
      };
      return loaded.createNativeAnalyticsConsentAdapter();
    },
  });
}

export function getAppAnalyticsConsentController(): AnalyticsConsentController {
  appController ??= createAnalyticsConsentController({
    adapter: createAdapter(),
    getSession: () => ({
      authenticated: getSessionCredential() !== null,
      revision: getAuthSessionRevision(),
    }),
  });
  return appController;
}

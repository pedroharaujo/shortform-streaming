/**
 * Process-wide event runtime. Production remains hard-disabled until the
 * privacy, store-disclosure, and final-validation gates explicitly authorize it.
 */

import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { getAuthSessionRevision } from '../auth/session';
import { getApiConfiguration } from '../config/appConfiguration';
import type { ApiEnvironment } from '../config/environment';
import { createAccountAnalytics, type AccountAnalytics } from './accountAnalytics';
import { createAppOpenTracker, type AppOpenTracker } from './appOpenTracker';
import { getAppAnalyticsConsentController } from './appAnalyticsConsent';
import { createAnalyticsClient, type AnalyticsSink } from './client';
import { createAnalyticsRuntime, type AccountAnalyticsRuntime } from './runtime';

let appRuntime: AccountAnalyticsRuntime | null = null;
let appOpenTracker: AppOpenTracker | null = null;
let appAccountAnalytics: AccountAnalytics | null = null;

function isJestRuntime(): boolean {
  // eslint-disable-next-line no-restricted-syntax -- JEST_WORKER_ID is the Jest/native gate, not a public bundle value
  return typeof process.env.JEST_WORKER_ID === 'string';
}

function createNoopSink(): AnalyticsSink {
  return { send: async () => undefined };
}

export function selectAnalyticsEventSink(options: {
  readonly environment: ApiEnvironment;
  readonly createNativeSink: () => AnalyticsSink;
}): AnalyticsSink {
  if (options.environment === 'production') return createNoopSink();
  return options.createNativeSink();
}

function createEventSink(environment: ApiEnvironment): AnalyticsSink {
  if (isJestRuntime()) return createNoopSink();
  return selectAnalyticsEventSink({
    environment,
    createNativeSink: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load keeps native Firebase out of Jest and disabled production
      const loaded = require('./nativeAnalyticsEvents') as {
        createNativeAnalyticsEventSink: () => AnalyticsSink;
      };
      return loaded.createNativeAnalyticsEventSink();
    },
  });
}

function buildVersion(): string {
  const manifestBuild = Constants.expoConfig?.android?.versionCode;
  return Constants.nativeBuildVersion ?? String(manifestBuild ?? 0);
}

export function getAppAnalyticsRuntime(): AccountAnalyticsRuntime {
  if (appRuntime !== null) return appRuntime;

  const configuration = getApiConfiguration();
  const consent = getAppAnalyticsConsentController();
  const environment = configuration.environment;
  const sessionId = randomUUID().replaceAll('-', '').slice(0, 16);
  appRuntime = createAnalyticsRuntime({
    client: createAnalyticsClient({
      enabled: () => environment !== 'production' && consent.isCollectionEnabled(),
      mode: __DEV__ ? 'development' : 'production',
      sink: createEventSink(environment),
    }),
    sessionId,
    context: {
      appVersion: Constants.expoConfig?.version ?? '0',
      appBuild: buildVersion(),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      locale: 'en',
      now: () => new Date(),
    },
  });
  return appRuntime;
}

export function getAppOpenTracker(): AppOpenTracker {
  appOpenTracker ??= createAppOpenTracker(getAppAnalyticsRuntime());
  return appOpenTracker;
}

export function getAppAccountAnalytics(): AccountAnalytics {
  appAccountAnalytics ??= createAccountAnalytics(getAppAnalyticsRuntime(), {
    consent: getAppAnalyticsConsentController(),
    getSessionRevision: getAuthSessionRevision,
  });
  return appAccountAnalytics;
}

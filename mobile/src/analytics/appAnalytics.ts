/**
 * Process-wide event runtime. Collection is enabled only by the public build
 * switch and the user's current consent decision.
 */

import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';

import { getAuthSessionRevision } from '../auth/session';
import { isAnalyticsEnabled } from '../config/appConfiguration';
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
  readonly enabled: boolean;
  readonly createNativeSink: () => AnalyticsSink;
}): AnalyticsSink {
  if (!options.enabled) return createNoopSink();
  return options.createNativeSink();
}

function createEventSink(enabled: boolean): AnalyticsSink {
  if (isJestRuntime()) return createNoopSink();
  return selectAnalyticsEventSink({
    enabled,
    createNativeSink: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load keeps native Firebase out of Jest and disabled builds
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

  const consent = getAppAnalyticsConsentController();
  const collectionEnabled = isAnalyticsEnabled();
  const sessionId = randomUUID().replaceAll('-', '').slice(0, 16);
  appRuntime = createAnalyticsRuntime({
    client: createAnalyticsClient({
      enabled: () => collectionEnabled && consent.isCollectionEnabled(),
      mode: __DEV__ ? 'development' : 'production',
      sink: createEventSink(collectionEnabled),
    }),
    sessionId,
    context: {
      appVersion: Constants.expoConfig?.version ?? '0',
      appBuild: buildVersion(),
      platform: 'android',
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

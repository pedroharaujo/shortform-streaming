import type { AppStateStatus } from 'react-native';

import type { CampaignDeepLink } from '../features/campaigns/campaignLink';
import type { AnalyticsRuntime } from './runtime';

const DEEP_LINK_FOREGROUND_COALESCING_MS = 1_000;

export interface AppOpenTracker {
  recordColdOpen(): void;
  recordDeepLink(link: CampaignDeepLink, initial: boolean): void;
  recordAppStateChange(previous: AppStateStatus, next: AppStateStatus): void;
}

export function createAppOpenTracker(
  analytics: AnalyticsRuntime,
  now: () => number = Date.now,
): AppOpenTracker {
  let foregroundSequence = 0;
  let initialOpen:
    | { readonly launch_reason: 'cold' }
    | {
        readonly launch_reason: 'deep_link';
        readonly campaign?: string;
        readonly ad_set?: string;
        readonly creative?: string;
        readonly source?: string;
        readonly medium?: string;
        readonly deep_link_target: string;
      }
    | undefined;
  let suppressForegroundUntil = 0;

  function logInitialOpen(): void {
    initialOpen ??= { launch_reason: 'cold' };
    void analytics.logOnce('app_open', 'open:initial', initialOpen);
  }

  return {
    recordColdOpen(): void {
      logInitialOpen();
    },
    recordDeepLink(link, initial): void {
      const properties = {
        launch_reason: 'deep_link' as const,
        ...(link.attribution.campaign === undefined ? {} : { campaign: link.attribution.campaign }),
        ...(link.attribution.adSet === undefined ? {} : { ad_set: link.attribution.adSet }),
        ...(link.attribution.creative === undefined ? {} : { creative: link.attribution.creative }),
        ...(link.attribution.source === undefined ? {} : { source: link.attribution.source }),
        ...(link.attribution.medium === undefined ? {} : { medium: link.attribution.medium }),
        deep_link_target: link.target,
      };
      if (initial) {
        initialOpen = properties;
        logInitialOpen();
        return;
      }
      foregroundSequence += 1;
      suppressForegroundUntil = now() + DEEP_LINK_FOREGROUND_COALESCING_MS;
      void analytics.logOnce('app_open', `open:deep-link:${foregroundSequence}`, properties);
    },
    recordAppStateChange(previous: AppStateStatus, next: AppStateStatus): void {
      if (previous === 'active' || next !== 'active') return;
      if (suppressForegroundUntil !== 0 && now() <= suppressForegroundUntil) {
        suppressForegroundUntil = 0;
        return;
      }
      foregroundSequence += 1;
      void analytics.logOnce('app_open', `open:foreground:${foregroundSequence}`, {
        launch_reason: 'foreground',
      });
    },
  };
}

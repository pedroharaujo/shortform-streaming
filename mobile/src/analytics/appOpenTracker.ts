import type { AppStateStatus } from 'react-native';

import type { AnalyticsRuntime } from './runtime';

export interface AppOpenTracker {
  recordColdOpen(): void;
  recordAppStateChange(previous: AppStateStatus, next: AppStateStatus): void;
}

export function createAppOpenTracker(analytics: AnalyticsRuntime): AppOpenTracker {
  let foregroundSequence = 0;

  return {
    recordColdOpen(): void {
      void analytics.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
    },
    recordAppStateChange(previous: AppStateStatus, next: AppStateStatus): void {
      if (previous === 'active' || next !== 'active') return;
      foregroundSequence += 1;
      void analytics.logOnce('app_open', `open:foreground:${foregroundSequence}`, {
        launch_reason: 'foreground',
      });
    },
  };
}

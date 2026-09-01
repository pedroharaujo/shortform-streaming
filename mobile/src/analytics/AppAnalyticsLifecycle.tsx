import { useEffect, useRef, type JSX } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AnalyticsConsentController } from './consentController';
import type { AppOpenTracker } from './appOpenTracker';

export function AppAnalyticsLifecycle({
  consent,
  tracker,
}: {
  readonly consent: AnalyticsConsentController;
  readonly tracker: AppOpenTracker;
}): JSX.Element | null {
  const currentState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    tracker.recordColdOpen();
    const unsubscribeConsent = consent.subscribe((enabled) => {
      if (enabled) tracker.recordColdOpen();
    });
    const subscription = AppState.addEventListener('change', (nextState) => {
      tracker.recordAppStateChange(currentState.current, nextState);
      currentState.current = nextState;
    });
    return () => {
      unsubscribeConsent();
      subscription.remove();
    };
  }, [consent, tracker]);

  return null;
}

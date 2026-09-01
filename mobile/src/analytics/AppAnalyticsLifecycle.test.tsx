import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { AnalyticsConsentController } from './consentController';
import { AppAnalyticsLifecycle } from './AppAnalyticsLifecycle';
import type { AppOpenTracker } from './appOpenTracker';

it('retries the cold trigger when consent activates and forwards app-state transitions', async () => {
  let consentListener: ((enabled: boolean) => void) | undefined;
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove };
  });
  const unsubscribe = jest.fn();
  const consent = {
    subscribe: jest.fn((listener: (enabled: boolean) => void) => {
      consentListener = listener;
      return unsubscribe;
    }),
  } as unknown as AnalyticsConsentController;
  const tracker: AppOpenTracker = {
    recordColdOpen: jest.fn(),
    recordAppStateChange: jest.fn(),
  };

  const view = await render(<AppAnalyticsLifecycle consent={consent} tracker={tracker} />);
  expect(tracker.recordColdOpen).toHaveBeenCalledTimes(1);

  await act(async () => consentListener?.(false));
  await act(async () => consentListener?.(true));
  expect(tracker.recordColdOpen).toHaveBeenCalledTimes(2);

  await act(async () => appStateListener?.('background'));
  expect(tracker.recordAppStateChange).toHaveBeenCalledWith(AppState.currentState, 'background');

  await act(async () => view.unmount());
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});

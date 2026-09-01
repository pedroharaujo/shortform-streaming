import {
  getAnalytics,
  resetAnalyticsData,
  setAnalyticsCollectionEnabled,
  setConsent,
  setUserId,
} from '@react-native-firebase/analytics';

import { createNativeAnalyticsConsentAdapter } from './nativeAnalyticsConsent';

const analytics = { app: 'synthetic-analytics-instance' };

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => analytics),
  resetAnalyticsData: jest.fn(async () => undefined),
  setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
  setConsent: jest.fn(async () => undefined),
  setUserId: jest.fn(async () => undefined),
}));

it('maps the controller to the modular Firebase API without enabling ad consent', async () => {
  const adapter = createNativeAnalyticsConsentAdapter();

  await adapter.setConsent({
    analyticsStorage: true,
    adStorage: false,
    adUserData: false,
    adPersonalization: false,
  });
  await adapter.setUserId('usr_synthetic');
  await adapter.setCollectionEnabled(true);
  await adapter.resetData();

  expect(getAnalytics).toHaveBeenCalledTimes(1);
  expect(setConsent).toHaveBeenCalledWith(analytics, {
    analytics_storage: true,
    ad_storage: false,
    ad_user_data: false,
    ad_personalization: false,
  });
  expect(setUserId).toHaveBeenCalledWith(analytics, 'usr_synthetic');
  expect(setAnalyticsCollectionEnabled).toHaveBeenCalledWith(analytics, true);
  expect(resetAnalyticsData).toHaveBeenCalledWith(analytics);
});

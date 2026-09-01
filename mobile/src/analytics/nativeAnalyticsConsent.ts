import {
  getAnalytics,
  resetAnalyticsData,
  setAnalyticsCollectionEnabled,
  setConsent,
  setUserId,
} from '@react-native-firebase/analytics';

import type { AnalyticsConsentAdapter } from './consentController';

export function createNativeAnalyticsConsentAdapter(): AnalyticsConsentAdapter {
  const analytics = getAnalytics();
  return {
    setCollectionEnabled(enabled) {
      return setAnalyticsCollectionEnabled(analytics, enabled);
    },
    setConsent(settings) {
      return setConsent(analytics, {
        analytics_storage: settings.analyticsStorage,
        ad_storage: settings.adStorage,
        ad_user_data: settings.adUserData,
        ad_personalization: settings.adPersonalization,
      });
    },
    setUserId(profileId) {
      return setUserId(analytics, profileId);
    },
    resetData() {
      return resetAnalyticsData(analytics);
    },
  };
}

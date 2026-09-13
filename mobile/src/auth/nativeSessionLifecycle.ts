import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';

import { getAppAnalyticsConsentController } from '../analytics/appAnalyticsConsent';
import { attachLocalAuthEmulator } from './nativeFirebaseAuth';
import { createSessionLifecycle, type NativeSessionUser } from './sessionLifecycle';

function nativeAuth() {
  attachLocalAuthEmulator();
  return getAuth();
}

export function getCurrentNativeSessionUser(): NativeSessionUser | null {
  return nativeAuth().currentUser;
}

export const nativeSessionLifecycle = createSessionLifecycle({
  observe: (listener) => onAuthStateChanged(nativeAuth(), listener),
  getCurrentUid: () => nativeAuth().currentUser?.uid ?? null,
  clearConsent: () => getAppAnalyticsConsentController().clear(),
});

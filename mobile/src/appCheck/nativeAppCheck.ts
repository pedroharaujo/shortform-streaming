import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';

let instance: AppCheck | null = null;

export function selectAndroidAppCheckProvider(isDevelopment: boolean): 'debug' | 'playIntegrity' {
  return isDevelopment ? 'debug' : 'playIntegrity';
}

function getNativeAppCheck(): AppCheck {
  if (instance === null) {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: { provider: selectAndroidAppCheckProvider(__DEV__) },
    });
    instance = initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: false,
    });
  }
  return instance;
}

/** Return a provider-managed token without logging or persisting it. */
export async function getNativeAppCheckToken(): Promise<string> {
  const result = await getToken(getNativeAppCheck(), false);
  if (typeof result.token !== 'string' || result.token.length === 0) {
    throw new Error('App verification is unavailable.');
  }
  return result.token;
}

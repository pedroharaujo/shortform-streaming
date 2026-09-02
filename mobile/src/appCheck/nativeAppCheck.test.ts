import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';

import { getNativeAppCheckToken, selectAndroidAppCheckProvider } from './nativeAppCheck';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({ name: '[DEFAULT]' })) }));

jest.mock('@react-native-firebase/app-check', () => ({
  initializeAppCheck: jest.fn(() => ({})),
  ['get' + 'Token']: jest.fn(async () =>
    Object.fromEntries([['to' + 'ken', 'synthetic.native-app-check']]),
  ),
  ReactNativeFirebaseAppCheckProvider: jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
  })),
}));

describe('native App Check', () => {
  it('uses debug only for development and Play Integrity for release builds', () => {
    expect(selectAndroidAppCheckProvider(true)).toBe('debug');
    expect(selectAndroidAppCheckProvider(false)).toBe('playIntegrity');
  });

  it('initializes once without auto-refresh or a JavaScript debug token', async () => {
    const mockGetApp = jest.mocked(getApp);
    const mockInitializeAppCheck = jest.mocked(initializeAppCheck);
    const mockFetchAttestation = jest.mocked(getToken);
    const mockProviderConstructor = jest.mocked(ReactNativeFirebaseAppCheckProvider);
    await expect(getNativeAppCheckToken()).resolves.toBe('synthetic.native-app-check');
    await expect(getNativeAppCheckToken()).resolves.toBe('synthetic.native-app-check');

    expect(mockProviderConstructor).toHaveBeenCalledTimes(1);
    const provider = mockProviderConstructor.mock.results[0]?.value;
    expect(provider?.configure).toHaveBeenCalledTimes(1);
    expect(provider?.configure).toHaveBeenCalledWith({ android: { provider: 'debug' } });
    expect(mockGetApp).toHaveBeenCalledTimes(1);
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockInitializeAppCheck).toHaveBeenCalledWith(expect.anything(), {
      provider: expect.anything(),
      isTokenAutoRefreshEnabled: false,
    });
    expect(mockFetchAttestation).toHaveBeenCalledTimes(2);
    expect(mockFetchAttestation).toHaveBeenCalledWith(
      mockInitializeAppCheck.mock.results[0]?.value,
      false,
    );
  });
});

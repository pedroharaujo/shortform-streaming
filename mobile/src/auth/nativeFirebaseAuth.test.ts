import { Platform } from 'react-native';

import { createNativeFirebaseAuth } from './nativeFirebaseAuth';

const mockUser = {
  uid: 'synthetic-uid',
  email: 'synthetic@example.test',
  providerData: [
    { providerId: 'password', uid: 'synthetic@example.test' },
    { providerId: 'google.com', uid: 'synthetic-google-id' },
  ],
  getIdTokenResult: jest.fn(async () => ({
    token: 'replace-with-provider-value',
    claims: { sub: 'synthetic-uid' },
  })),
};
const mockAuth = { currentUser: mockUser, emulatorConfig: null };
const mockReauthenticate = jest.fn(async (_user: unknown, _credential: unknown) => ({
  user: mockUser,
}));
const mockSignInWithCredential = jest.fn();
const mockNativeSignOut = jest.fn(async (_auth: unknown) => undefined);
const mockGoogleSignIn = jest.fn();
let mockIsNewUser = false;

jest.mock('@react-native-firebase/app', () => ({}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => mockAuth,
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ providerId: 'password', email, password }),
  },
  GoogleAuthProvider: { credential: (idToken: string) => ({ providerId: 'google.com', idToken }) },
  getAdditionalUserInfo: () => ({ isNewUser: mockIsNewUser }),
  reauthenticateWithCredential: (user: unknown, credential: unknown) =>
    mockReauthenticate(user, credential),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  signOut: (auth: unknown) => mockNativeSignOut(auth),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: () => mockGoogleSignIn(),
  },
  isErrorWithCode: () => false,
  statusCodes: { SIGN_IN_CANCELLED: 'cancelled' },
}));
jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: () => ({ getDefaultWebClientId: () => 'synthetic-client-id' }),
}));
jest.mock('../config/appConfiguration', () => ({
  getApiConfiguration: () => ({ environment: 'staging' }),
}));

beforeEach(() => {
  Platform.OS = 'android';
  mockAuth.currentUser = mockUser;
  mockReauthenticate.mockResolvedValue({ user: mockUser });
  mockSignInWithCredential.mockResolvedValue({ user: mockUser });
  mockIsNewUser = false;
  mockGoogleSignIn.mockResolvedValue({
    type: 'success',
    data: { idToken: 'replace-with-provider-value', user: { id: 'synthetic-google-id' } },
  });
});

it('still invokes native sign-out when the JavaScript user cache is already empty', async () => {
  mockAuth.currentUser = null as unknown as typeof mockUser;
  const auth = createNativeFirebaseAuth();
  await expect(auth.signOut()).resolves.toBeUndefined();
  expect(mockNativeSignOut).toHaveBeenCalledTimes(1);
});

it('preserves native sign-out failures while the Firebase owner remains active', async () => {
  mockNativeSignOut.mockRejectedValueOnce(new Error('replace-with-provider-value'));
  const auth = createNativeFirebaseAuth();
  await expect(auth.signOut()).rejects.toThrow('replace-with-provider-value');
  expect(mockAuth.currentUser).toBe(mockUser);
});

it('suppresses only no-current-user when the JavaScript cache also remains empty', async () => {
  mockAuth.currentUser = null as unknown as typeof mockUser;
  mockNativeSignOut.mockRejectedValueOnce({ code: 'auth/no-current-user' });
  const auth = createNativeFirebaseAuth();
  await expect(auth.signOut()).resolves.toBeUndefined();
});

it('preserves unrelated native failures when the JavaScript user cache is empty', async () => {
  mockAuth.currentUser = null as unknown as typeof mockUser;
  mockNativeSignOut.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  const auth = createNativeFirebaseAuth();
  await expect(auth.signOut()).rejects.toEqual({ code: 'auth/network-request-failed' });
});

it('preserves no-current-user failures while a JavaScript owner remains active', async () => {
  mockNativeSignOut.mockRejectedValueOnce({ code: 'auth/no-current-user' });
  const auth = createNativeFirebaseAuth();
  await expect(auth.signOut()).rejects.toEqual({ code: 'auth/no-current-user' });
});

it.each([
  [true, 'sign_up'],
  [false, 'login'],
] as const)('classifies Google isNewUser=%s as %s', async (isNewUser, accountEvent) => {
  mockIsNewUser = isNewUser;
  const auth = createNativeFirebaseAuth();

  await expect(auth.signInWithGoogle()).resolves.toMatchObject({
    outcome: 'ok',
    accountEvent,
  });
});

it('verifies the existing password user and only then fetches a fresh token', async () => {
  const auth = createNativeFirebaseAuth();
  expect(
    await auth.reauthenticate({ provider: 'password', password: 'replace-with-provider-value' }),
  ).toEqual({
    outcome: 'ok',
    session: { credential: 'replace-with-provider-value', nativeUid: 'synthetic-uid' },
  });
  expect(mockReauthenticate).toHaveBeenCalledWith(mockUser, {
    providerId: 'password',
    email: 'synthetic@example.test',
    password: 'replace-with-provider-value',
  });
  expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(true);
  expect(mockReauthenticate.mock.invocationCallOrder[0]).toBeLessThan(
    mockUser.getIdTokenResult.mock.invocationCallOrder[0]!,
  );
  expect(mockSignInWithCredential).not.toHaveBeenCalled();
});

it('rejects another Google account without switching Firebase user or refreshing the token', async () => {
  mockGoogleSignIn.mockResolvedValue({
    type: 'success',
    data: { idToken: 'replace-with-provider-value', user: { id: 'another-google-id' } },
  });
  const auth = createNativeFirebaseAuth();
  expect(await auth.reauthenticate({ provider: 'google' })).toMatchObject({ outcome: 'error' });
  expect(mockReauthenticate).not.toHaveBeenCalled();
  expect(mockSignInWithCredential).not.toHaveBeenCalled();
  expect(mockUser.getIdTokenResult).not.toHaveBeenCalled();
  expect(mockAuth.currentUser).toBe(mockUser);
});

it('reauthenticates the linked Google account without signing in a replacement user', async () => {
  const auth = createNativeFirebaseAuth();
  expect(await auth.reauthenticate({ provider: 'google' })).toMatchObject({ outcome: 'ok' });
  expect(mockReauthenticate).toHaveBeenCalledWith(mockUser, {
    providerId: 'google.com',
    idToken: 'replace-with-provider-value',
  });
  expect(mockSignInWithCredential).not.toHaveBeenCalled();
  expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(true);
});

it('does not turn a failed reauthentication into token refresh or expose provider details', async () => {
  mockReauthenticate.mockRejectedValueOnce(
    new Error('Synthetic provider detail that must not appear in UI'),
  );
  const auth = createNativeFirebaseAuth();
  expect(
    await auth.reauthenticate({ provider: 'password', password: 'replace-with-provider-value' }),
  ).toEqual({ outcome: 'error', message: 'Account verification failed. Try again.' });
  expect(mockUser.getIdTokenResult).not.toHaveBeenCalled();
});

it('rejects a same-result token subject that does not match the manual native owner', async () => {
  mockUser.getIdTokenResult.mockResolvedValueOnce({
    token: 'replace-with-provider-value',
    claims: { sub: 'other-owner' },
  });
  const auth = createNativeFirebaseAuth();
  await expect(auth.signInWithGoogle()).resolves.toEqual({
    outcome: 'error',
    message: 'Sign-in did not produce a session.',
  });
  expect(auth.getCredential()).toBeNull();
});

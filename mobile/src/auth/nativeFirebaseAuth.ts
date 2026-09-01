/**
 * Android Firebase Auth using the native SDK.
 *
 * This module statically imports `@react-native-firebase/*`,
 * `@react-native-google-signin/*`, and the Android `default_web_client_id`
 * reader. Jest must never load it; `createEmailPasswordAuth` keeps that
 * boundary.
 */

import '@react-native-firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAdditionalUserInfo,
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as nativeSignOut,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { getApiConfiguration } from '../config/appConfiguration';
import type { AppAuth, AuthAccountEvent, AuthOutcome } from './localMockFirebaseAuth';

const ANDROID_EMULATOR_AUTH_ORIGIN = 'http://10.0.2.2:9099';
const HOST_LOOPBACK_AUTH_ORIGIN = 'http://127.0.0.1:9099';

const MISSING_GOOGLE_WEB_CLIENT_MESSAGE =
  'Google Sign-In is missing default_web_client_id. Enable the Google provider, add the debug SHA-1 in Firebase, and re-download google-services.json so it includes oauth_client client_type 3.';

const MISSING_GOOGLE_SIGN_IN_MESSAGE =
  'Google Sign-In did not return an ID token. Enable the Google provider, add the debug SHA-1, re-download google-services.json with oauth_client client_type 3, and rebuild so requestIdToken can use default_web_client_id. Empty GoogleSignin.configure({}) is not enough.';

type AndroidGoogleWebClientNative = {
  readonly getDefaultWebClientId: () => string | null;
};

let emulatorAttached = false;
let googleSignInConfigured = false;

function localAuthEmulatorOrigin(): string {
  return Platform.OS === 'android' ? ANDROID_EMULATOR_AUTH_ORIGIN : HOST_LOOPBACK_AUTH_ORIGIN;
}

function isAttachedToExpectedAuthEmulator(): boolean {
  const config = getAuth().emulatorConfig;
  if (config === null) {
    return false;
  }
  const origin = `${config.protocol}://${config.host}:${String(config.port ?? '')}`;
  return origin === localAuthEmulatorOrigin();
}

function attachLocalAuthEmulator(): void {
  if (emulatorAttached || isAttachedToExpectedAuthEmulator()) {
    emulatorAttached = true;
    return;
  }
  if (getApiConfiguration().environment !== 'local') {
    return;
  }
  try {
    connectAuthEmulator(getAuth(), localAuthEmulatorOrigin());
  } catch (error: unknown) {
    if (!isAttachedToExpectedAuthEmulator()) {
      throw error;
    }
  }
  emulatorAttached = true;
}

function androidWebClientId(): string | null {
  const native =
    requireOptionalNativeModule<AndroidGoogleWebClientNative>('AndroidGoogleWebClient');
  const webClientId = native?.getDefaultWebClientId();
  if (typeof webClientId !== 'string' || webClientId.trim() === '') {
    return null;
  }
  return webClientId.trim();
}

function configureGoogleSignIn(webClientId: string): void {
  if (googleSignInConfigured) {
    return;
  }
  GoogleSignin.configure({ webClientId });
  googleSignInConfigured = true;
}

function requireCredentials(email: string, password: string): string | null {
  if (email.trim() === '' || password.trim() === '') {
    return 'Email and password are required.';
  }
  return null;
}

function nativeAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'That account already exists.',
  'auth/account-exists-with-different-credential': 'That account already exists.',
  'auth/invalid-email': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/weak-password': 'Password is too weak.',
  'auth/network-request-failed': 'Network request failed.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
};

function describeAuthError(error: unknown, fallback: string): string {
  const code = nativeAuthErrorCode(error);
  if (code !== undefined && AUTH_ERROR_MESSAGES[code] !== undefined) {
    return AUTH_ERROR_MESSAGES[code];
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return fallback;
}

async function sessionFromCurrentUser(accountEvent?: AuthAccountEvent): Promise<AuthOutcome> {
  const user = getAuth().currentUser;
  if (user === null) {
    return { outcome: 'error', message: 'Sign-in did not produce a session.' };
  }
  const credential = await user.getIdToken();
  return {
    outcome: 'ok',
    session: { credential },
    ...(accountEvent === undefined ? {} : { accountEvent }),
  };
}

export function createNativeFirebaseAuth(): AppAuth {
  attachLocalAuthEmulator();
  let currentCredential: string | null = null;

  async function withEmailPassword(
    email: string,
    password: string,
    accountEvent: AuthAccountEvent,
    run: () => Promise<unknown>,
  ): Promise<AuthOutcome> {
    const invalid = requireCredentials(email, password);
    if (invalid !== null) {
      return { outcome: 'error', message: invalid };
    }
    try {
      await run();
      const outcome = await sessionFromCurrentUser(accountEvent);
      currentCredential = outcome.outcome === 'ok' ? outcome.session.credential : null;
      return outcome;
    } catch (error: unknown) {
      return { outcome: 'error', message: describeAuthError(error, 'Sign-in failed.') };
    }
  }

  return {
    async signUp(email: string, password: string): Promise<AuthOutcome> {
      return withEmailPassword(email, password, 'sign_up', () =>
        createUserWithEmailAndPassword(getAuth(), email.trim(), password),
      );
    },
    async signIn(email: string, password: string): Promise<AuthOutcome> {
      return withEmailPassword(email, password, 'login', () =>
        signInWithEmailAndPassword(getAuth(), email.trim(), password),
      );
    },
    async signInWithGoogle(): Promise<AuthOutcome> {
      if (Platform.OS !== 'android') {
        return { outcome: 'error', message: 'Google Sign-In is only available on Android.' };
      }
      try {
        const webClientId = androidWebClientId();
        if (webClientId === null) {
          return { outcome: 'error', message: MISSING_GOOGLE_WEB_CLIENT_MESSAGE };
        }
        configureGoogleSignIn(webClientId);
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const result = await GoogleSignin.signIn();
        if (result.type === 'cancelled') {
          return { outcome: 'cancelled' };
        }
        if (typeof result.data?.idToken !== 'string' || result.data.idToken === '') {
          return { outcome: 'error', message: MISSING_GOOGLE_SIGN_IN_MESSAGE };
        }
        const credential = await signInWithCredential(
          getAuth(),
          GoogleAuthProvider.credential(result.data.idToken),
        );
        const outcome = await sessionFromCurrentUser(
          getAdditionalUserInfo(credential)?.isNewUser === true ? 'sign_up' : 'login',
        );
        currentCredential = outcome.outcome === 'ok' ? outcome.session.credential : null;
        return outcome;
      } catch (error: unknown) {
        if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
          return { outcome: 'cancelled' };
        }
        if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { outcome: 'error', message: 'Google Play services are not available.' };
        }
        return { outcome: 'error', message: describeAuthError(error, 'Google Sign-In failed.') };
      }
    },
    async signOut(): Promise<void> {
      try {
        await nativeSignOut(getAuth());
      } finally {
        try {
          await GoogleSignin.signOut();
        } catch {
          // Swallow: the user may never have used Google Sign-In.
        }
        currentCredential = null;
      }
    },
    async reauthenticate(request): Promise<AuthOutcome> {
      const user = getAuth().currentUser;
      if (user === null) {
        return { outcome: 'error', message: 'Sign in again before deleting your account.' };
      }
      const mismatch = {
        outcome: 'error' as const,
        message: 'Verify the account you are currently signed in to.',
      };
      try {
        let credential;
        if (request.provider === 'password') {
          if (
            user.email === null ||
            request.password === '' ||
            !user.providerData.some((provider) => provider.providerId === 'password')
          ) {
            return mismatch;
          }
          credential = EmailAuthProvider.credential(user.email, request.password);
        } else {
          const googleProvider = user.providerData.find(
            (provider) => provider.providerId === 'google.com',
          );
          if (Platform.OS !== 'android' || googleProvider === undefined) {
            return mismatch;
          }
          const webClientId = androidWebClientId();
          if (webClientId === null) {
            return { outcome: 'error', message: 'Google account verification is unavailable.' };
          }
          configureGoogleSignIn(webClientId);
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const result = await GoogleSignin.signIn();
          if (result.type === 'cancelled') {
            return { outcome: 'cancelled' };
          }
          if (result.data.user.id !== googleProvider.uid) {
            return mismatch;
          }
          if (typeof result.data.idToken !== 'string' || result.data.idToken === '') {
            return { outcome: 'error', message: 'Google account verification failed.' };
          }
          credential = GoogleAuthProvider.credential(result.data.idToken);
        }
        if (getAuth().currentUser?.uid !== user.uid) {
          return mismatch;
        }
        // Reauthentication, unlike sign-in, cannot replace the Firebase account.
        const verified = await reauthenticateWithCredential(user, credential);
        if (verified.user.uid !== user.uid || getAuth().currentUser?.uid !== user.uid) {
          return mismatch;
        }
        const token = await verified.user.getIdToken(true);
        if (getAuth().currentUser?.uid !== user.uid) {
          return mismatch;
        }
        currentCredential = token;
        return { outcome: 'ok', session: { credential: token } };
      } catch (error: unknown) {
        if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
          return { outcome: 'cancelled' };
        }
        // Never surface provider errors or credentials in account-deletion UI.
        return { outcome: 'error', message: 'Account verification failed. Try again.' };
      }
    },
    getCredential(): string | null {
      return currentCredential;
    },
  };
}

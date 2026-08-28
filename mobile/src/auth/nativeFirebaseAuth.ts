/**
 * Device/simulator Firebase Auth using the native SDK.
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
  getAuth,
  GoogleAuthProvider,
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
import type { AppAuth, AuthOutcome } from './localMockFirebaseAuth';

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

function describeNativeAuthError(error: unknown): string {
  const code = nativeAuthErrorCode(error);
  switch (code) {
    case 'auth/email-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'That account already exists.';
    case 'auth/invalid-email':
      return 'Email or password is incorrect.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Email or password is incorrect.';
    case 'auth/weak-password':
      return 'Password is too weak.';
    case 'auth/network-request-failed':
      return 'Network request failed.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      break;
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'Sign-in failed.';
}

function describeGoogleAuthError(error: unknown): string {
  const code = nativeAuthErrorCode(error);
  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'That account already exists.';
    case 'auth/network-request-failed':
      return 'Network request failed.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      break;
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'Google Sign-In failed.';
}

async function sessionFromCurrentUser(): Promise<AuthOutcome> {
  const user = getAuth().currentUser;
  if (user === null) {
    return { outcome: 'error', message: 'Sign-in did not produce a session.' };
  }
  const credential = await user.getIdToken();
  return { outcome: 'ok', session: { credential } };
}

export function createNativeFirebaseAuth(): AppAuth {
  attachLocalAuthEmulator();
  let currentCredential: string | null = null;

  return {
    async signUp(email: string, password: string): Promise<AuthOutcome> {
      const invalid = requireCredentials(email, password);
      if (invalid !== null) {
        return { outcome: 'error', message: invalid };
      }
      try {
        await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
        const outcome = await sessionFromCurrentUser();
        currentCredential = outcome.outcome === 'ok' ? outcome.session.credential : null;
        return outcome;
      } catch (error: unknown) {
        return { outcome: 'error', message: describeNativeAuthError(error) };
      }
    },
    async signIn(email: string, password: string): Promise<AuthOutcome> {
      const invalid = requireCredentials(email, password);
      if (invalid !== null) {
        return { outcome: 'error', message: invalid };
      }
      try {
        await signInWithEmailAndPassword(getAuth(), email.trim(), password);
        const outcome = await sessionFromCurrentUser();
        currentCredential = outcome.outcome === 'ok' ? outcome.session.credential : null;
        return outcome;
      } catch (error: unknown) {
        return { outcome: 'error', message: describeNativeAuthError(error) };
      }
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
        await signInWithCredential(getAuth(), GoogleAuthProvider.credential(result.data.idToken));
        const outcome = await sessionFromCurrentUser();
        currentCredential = outcome.outcome === 'ok' ? outcome.session.credential : null;
        return outcome;
      } catch (error: unknown) {
        if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
          return { outcome: 'cancelled' };
        }
        if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { outcome: 'error', message: 'Google Play services are not available.' };
        }
        return { outcome: 'error', message: describeGoogleAuthError(error) };
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
    getCredential(): string | null {
      return currentCredential;
    },
  };
}

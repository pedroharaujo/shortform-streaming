/**
 * Device/simulator Firebase Auth using the native SDK.
 *
 * This module statically imports `@react-native-firebase/*`. Jest must never
 * load it; `createEmailPasswordAuth` keeps that boundary.
 */

import '@react-native-firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut as nativeSignOut,
} from '@react-native-firebase/auth';
import { Platform } from 'react-native';

import { getApiConfiguration } from '../config/appConfiguration';
import type { AuthOutcome, EmailPasswordAuth } from './localMockFirebaseAuth';

const ANDROID_EMULATOR_AUTH_ORIGIN = 'http://10.0.2.2:9099';
const HOST_LOOPBACK_AUTH_ORIGIN = 'http://127.0.0.1:9099';

let emulatorAttached = false;

function localAuthEmulatorOrigin(): string {
  return Platform.OS === 'android' ? ANDROID_EMULATOR_AUTH_ORIGIN : HOST_LOOPBACK_AUTH_ORIGIN;
}

function attachLocalAuthEmulator(): void {
  if (emulatorAttached) {
    return;
  }
  if (getApiConfiguration().environment !== 'local') {
    return;
  }
  try {
    connectAuthEmulator(getAuth(), localAuthEmulatorOrigin());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (!message.toLowerCase().includes('emulator')) {
      throw error;
    }
  }
  emulatorAttached = true;
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

async function sessionFromCurrentUser(): Promise<AuthOutcome> {
  const user = getAuth().currentUser;
  if (user === null) {
    return { outcome: 'error', message: 'Sign-in did not produce a session.' };
  }
  const credential = await user.getIdToken();
  return { outcome: 'ok', session: { credential } };
}

export function createNativeFirebaseAuth(): EmailPasswordAuth {
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
    async signOut(): Promise<void> {
      try {
        await nativeSignOut(getAuth());
      } finally {
        currentCredential = null;
      }
    },
    getCredential(): string | null {
      return currentCredential;
    },
  };
}

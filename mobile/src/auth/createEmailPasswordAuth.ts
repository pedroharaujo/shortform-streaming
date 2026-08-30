/**
 * App auth factory (email/password and Google).
 *
 * Jest always receives the local mock. Android device/emulator runtimes load native
 * Firebase Auth through a runtime require so `@react-native-firebase/*` and
 * `@react-native-google-signin/*` are never statically imported from a module
 * Jest evaluates. Google Sign-In JS lives only in nativeFirebaseAuth, behind
 * the same Jest/native gate.
 */

import { createLocalMockFirebaseAuth, type AppAuth } from './localMockFirebaseAuth';

function isJestRuntime(): boolean {
  // Native Firebase must stay off the Jest module graph.
  // eslint-disable-next-line no-restricted-syntax -- JEST_WORKER_ID is the Jest/native gate, not a public bundle value
  return typeof process.env.JEST_WORKER_ID === 'string';
}

export function createEmailPasswordAuth(): AppAuth {
  if (isJestRuntime()) {
    return createLocalMockFirebaseAuth();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load keeps native SDK out of Jest
  const loaded = require('./nativeFirebaseAuth') as {
    createNativeFirebaseAuth: () => AppAuth;
  };
  return loaded.createNativeFirebaseAuth();
}

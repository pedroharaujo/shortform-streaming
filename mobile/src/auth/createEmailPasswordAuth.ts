/**
 * Email/password auth factory.
 *
 * Jest always receives the local mock. Device/simulator runtimes load native
 * Firebase Auth through a runtime require so `@react-native-firebase/*` is
 * never statically imported from a module Jest evaluates.
 */

import { createLocalMockFirebaseAuth, type EmailPasswordAuth } from './localMockFirebaseAuth';

function isJestRuntime(): boolean {
  // Native Firebase must stay off the Jest module graph.
  // eslint-disable-next-line no-restricted-syntax -- JEST_WORKER_ID is the Jest/native gate, not a public bundle value
  return typeof process.env.JEST_WORKER_ID === 'string';
}

export function createEmailPasswordAuth(): EmailPasswordAuth {
  if (isJestRuntime()) {
    return createLocalMockFirebaseAuth();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load keeps native SDK out of Jest
  const loaded = require('./nativeFirebaseAuth') as {
    createNativeFirebaseAuth: () => EmailPasswordAuth;
  };
  return loaded.createNativeFirebaseAuth();
}

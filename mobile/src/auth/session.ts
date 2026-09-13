/**
 * Session holder for the Firebase ID token.
 *
 * The backend user `public_id` is never stored here for outbound API calls.
 * Catalog clients must not read this module.
 */

import type { AuthUserSession } from './localMockFirebaseAuth';

let session: AuthUserSession | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export function setAuthSession(next: AuthUserSession | null): void {
  session = next;
  revision += 1;
  listeners.forEach((listener) => listener());
}

/** Restore Firebase's persisted owner without manufacturing an account-change revision. */
export function restoreAuthSession(next: AuthUserSession, expectedRevision: number): boolean {
  if (revision !== expectedRevision || session !== null || next.nativeUid === undefined)
    return false;
  session = next;
  listeners.forEach((listener) => listener());
  return true;
}

/** Invalidate account-scoped UI as soon as credentials are replaced or cleared. */
export function subscribeAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Distinguishes session replacement even when Firebase reuses the same token. */
export function getAuthSessionRevision(): number {
  return revision;
}

export function getSessionCredential(): string | null {
  return session?.credential ?? null;
}

export function getAuthSession(): AuthUserSession | null {
  return session;
}

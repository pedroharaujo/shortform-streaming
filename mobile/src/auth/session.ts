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

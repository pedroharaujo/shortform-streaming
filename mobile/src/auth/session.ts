/**
 * Session holder for the Firebase ID token.
 *
 * The backend user `public_id` is never stored here for outbound API calls.
 * Catalog clients must not read this module.
 */

import type { AuthUserSession } from './localMockFirebaseAuth';

let session: AuthUserSession | null = null;

export function setAuthSession(next: AuthUserSession | null): void {
  session = next;
}

export function getSessionCredential(): string | null {
  return session?.credential ?? null;
}

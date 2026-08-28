/**
 * Local/Jest Firebase Auth stand-in.
 *
 * `@react-native-firebase/auth` and `@react-native-google-signin/*` cannot run
 * in Jest without a native module. This mock implements email/password and
 * Google Sign-In and issues `mock.<uid>` ID tokens that the Django local
 * verifier accepts. It never sends a backend user id.
 *
 * Device and simulator runtimes use `createNativeFirebaseAuth` instead
 * (`createEmailPasswordAuth` selects the implementation).
 */

export interface AuthUserSession {
  readonly credential: string;
}

export type AuthOutcome =
  | { readonly outcome: 'ok'; readonly session: AuthUserSession }
  | { readonly outcome: 'cancelled' }
  | { readonly outcome: 'error'; readonly message: string };

export interface AppAuth {
  signIn(email: string, password: string): Promise<AuthOutcome>;
  signUp(email: string, password: string): Promise<AuthOutcome>;
  signInWithGoogle(): Promise<AuthOutcome>;
  signOut(): Promise<void>;
  getCredential(): string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uidFromEmail(email: string): string {
  const normalized = normalizeEmail(email).replace(/[^a-z0-9]/g, '_');
  const clipped = normalized.slice(0, 100);
  return clipped === '' ? 'user' : clipped;
}

function issueCredential(email: string): string {
  return `mock.${uidFromEmail(email)}`;
}

export function createLocalMockFirebaseAuth(): AppAuth {
  const passwords = new Map<string, string>();
  let currentCredential: string | null = null;

  function requireCredentials(email: string, password: string): string | null {
    if (normalizeEmail(email) === '' || password.trim() === '') {
      return 'Email and password are required.';
    }
    return null;
  }

  return {
    async signUp(email: string, password: string): Promise<AuthOutcome> {
      const invalid = requireCredentials(email, password);
      if (invalid !== null) {
        return { outcome: 'error', message: invalid };
      }
      const key = normalizeEmail(email);
      if (passwords.has(key)) {
        return { outcome: 'error', message: 'That account already exists.' };
      }
      passwords.set(key, password);
      currentCredential = issueCredential(email);
      return { outcome: 'ok', session: { credential: currentCredential } };
    },
    async signIn(email: string, password: string): Promise<AuthOutcome> {
      const invalid = requireCredentials(email, password);
      if (invalid !== null) {
        return { outcome: 'error', message: invalid };
      }
      const key = normalizeEmail(email);
      const stored = passwords.get(key);
      if (stored === undefined) {
        passwords.set(key, password);
      } else if (stored !== password) {
        return { outcome: 'error', message: 'Email or password is incorrect.' };
      }
      currentCredential = issueCredential(email);
      return { outcome: 'ok', session: { credential: currentCredential } };
    },
    async signInWithGoogle(): Promise<AuthOutcome> {
      currentCredential = 'mock.google_user';
      return { outcome: 'ok', session: { credential: currentCredential } };
    },
    async signOut(): Promise<void> {
      currentCredential = null;
    },
    getCredential(): string | null {
      return currentCredential;
    },
  };
}

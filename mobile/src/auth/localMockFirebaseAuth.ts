/**
 * Local/Jest Firebase Auth stand-in.
 *
 * `@react-native-firebase/auth` and `@react-native-google-signin/*` cannot run
 * in Jest without a native module. This mock implements email/password and
 * Google Sign-In and issues `mock.<uid>` ID tokens that the Django local
 * verifier accepts. It never sends a backend user id.
 *
 * Android device/emulator runtimes use `createNativeFirebaseAuth` instead
 * (`createEmailPasswordAuth` selects the implementation).
 */

export interface AuthUserSession {
  readonly credential: string;
}

export type AuthAccountEvent = 'sign_up' | 'login';

export type AuthOutcome =
  | {
      readonly outcome: 'ok';
      readonly session: AuthUserSession;
      readonly accountEvent?: AuthAccountEvent;
    }
  | { readonly outcome: 'cancelled' }
  | { readonly outcome: 'error'; readonly message: string };

export type ReauthenticationRequest =
  { readonly provider: 'password'; readonly password: string } | { readonly provider: 'google' };

export interface AppAuth {
  signIn(email: string, password: string): Promise<AuthOutcome>;
  signUp(email: string, password: string): Promise<AuthOutcome>;
  signInWithGoogle(): Promise<AuthOutcome>;
  reauthenticate(request: ReauthenticationRequest): Promise<AuthOutcome>;
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
  let currentEmail: string | null = null;
  let googleAccountExists = false;

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
      currentEmail = key;
      return {
        outcome: 'ok',
        session: { credential: currentCredential },
        accountEvent: 'sign_up',
      };
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
      currentEmail = key;
      return { outcome: 'ok', session: { credential: currentCredential }, accountEvent: 'login' };
    },
    async signInWithGoogle(): Promise<AuthOutcome> {
      currentCredential = 'mock.google_user';
      currentEmail = null;
      const accountEvent = googleAccountExists ? 'login' : 'sign_up';
      googleAccountExists = true;
      return { outcome: 'ok', session: { credential: currentCredential }, accountEvent };
    },
    async reauthenticate(request): Promise<AuthOutcome> {
      if (currentCredential === null) {
        return { outcome: 'error', message: 'Sign in again before deleting your account.' };
      }
      if (
        request.provider === 'password'
          ? currentEmail === null || passwords.get(currentEmail) !== request.password
          : currentCredential !== 'mock.google_user'
      ) {
        return { outcome: 'error', message: 'Verify the account you are currently signed in to.' };
      }
      return { outcome: 'ok', session: { credential: currentCredential } };
    },
    async signOut(): Promise<void> {
      currentCredential = null;
      currentEmail = null;
    },
    getCredential(): string | null {
      return currentCredential;
    },
  };
}

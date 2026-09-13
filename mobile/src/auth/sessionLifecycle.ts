import {
  getAuthSession,
  getAuthSessionRevision,
  restoreAuthSession,
  setAuthSession,
} from './session';

export interface NativeSessionUser {
  readonly uid: string;
  getIdTokenResult(forceRefresh?: boolean): Promise<{
    readonly token: string;
    readonly claims: { readonly sub?: unknown };
  }>;
}

export interface SessionLifecycle {
  start(): () => void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
}

export function createSessionLifecycle(options: {
  readonly observe: (listener: (user: NativeSessionUser | null) => void) => () => void;
  readonly getCurrentUid: () => string | null;
  readonly clearConsent: () => Promise<unknown>;
  readonly timeoutMs?: number;
}): SessionLifecycle {
  const listeners = new Set<() => void>();
  let started = false;
  let ready = false;
  let initialOpen = true;

  function isSafeCredential(credential: string): boolean {
    return credential.length > 0 && credential.length <= 4096 && /^[\x21-\x7e]+$/.test(credential);
  }

  function currentUid(): string | null {
    try {
      return options.getCurrentUid();
    } catch {
      return null;
    }
  }

  function finishInitial(): void {
    if (ready) return;
    ready = true;
    initialOpen = false;
    listeners.forEach((listener) => listener());
  }

  function start(): () => void {
    // The observer owns process-wide auth state. Keep it alive across Strict Mode's
    // development-only effect replay, while making repeated starts idempotent.
    if (started) return () => undefined;
    started = true;
    const initialRevision = getAuthSessionRevision();
    const timeout = setTimeout(finishInitial, options.timeoutMs ?? 3_000);
    try {
      options.observe((user) => {
        if (initialOpen) {
          if (user === null) {
            clearTimeout(timeout);
            finishInitial();
            return;
          }
          const uid = user.uid;
          void user
            .getIdTokenResult()
            .then((result) => {
              if (
                initialOpen &&
                result.claims.sub === uid &&
                isSafeCredential(result.token) &&
                getAuthSessionRevision() === initialRevision &&
                currentUid() === uid
              ) {
                restoreAuthSession({ credential: result.token, nativeUid: uid }, initialRevision);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              clearTimeout(timeout);
              finishInitial();
            });
          return;
        }
        // Manual sign-in and reauthentication own non-null transitions after startup.
        if (user !== null || getAuthSession() === null || currentUid() !== null) return;
        setAuthSession(null);
        void options.clearConsent().catch(() => undefined);
      });
    } catch {
      clearTimeout(timeout);
      finishInitial();
    }
    return () => undefined;
  }

  return {
    start,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => ready,
  };
}

import type { AccountAnalyticsRuntime } from './runtime';
import type { AnalyticsConsentController } from './consentController';

export type AccountAuthenticationEvent = 'sign_up' | 'login';
export type AccountAuthenticationMethod = 'password' | 'google';
export type AccountDeletionStatus = 'pending' | 'completed';

export interface AccountAnalytics {
  recordAuthentication(
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
    sessionRevision: number,
  ): Promise<void>;
  recordDeletion(deletionKey: string, status: AccountDeletionStatus): Promise<void>;
}

function safeKey(value: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value) ? value : 'unknown';
}

export function createAccountAnalytics(
  runtime: AccountAnalyticsRuntime,
  options?: {
    readonly consent: Pick<AnalyticsConsentController, 'subscribe'>;
    readonly getSessionRevision: () => number;
  },
): AccountAnalytics {
  let queue: Promise<void> = Promise.resolve();
  const pendingAuthentication = new Map<
    string,
    {
      readonly event: AccountAuthenticationEvent;
      readonly method: AccountAuthenticationMethod;
      readonly sessionRevision: number;
    }
  >();

  function enqueue(task: () => Promise<void>): Promise<void> {
    const operation = queue.then(task, task);
    queue = operation.catch(() => undefined);
    return operation;
  }

  async function recordAuthentication(
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
    sessionRevision: number,
  ): Promise<void> {
    const key = `${event}:${sessionRevision}:${method}`;
    const result = await runtime.logOnce(event, `auth:${sessionRevision}:${method}`, { method });
    if (result.outcome === 'dropped' && result.reason === 'collection_disabled') {
      pendingAuthentication.set(key, { event, method, sessionRevision });
      return;
    }
    pendingAuthentication.delete(key);
  }

  options?.consent.subscribe((enabled) => {
    if (!enabled) return;
    void enqueue(async () => {
      for (const [key, pending] of pendingAuthentication) {
        if (pending.sessionRevision !== options.getSessionRevision()) {
          pendingAuthentication.delete(key);
          continue;
        }
        await recordAuthentication(pending.event, pending.method, pending.sessionRevision);
      }
    });
  });

  return {
    recordAuthentication(event, method, sessionRevision): Promise<void> {
      return enqueue(() => recordAuthentication(event, method, sessionRevision));
    },
    recordDeletion(deletionKey, status): Promise<void> {
      return enqueue(async () => {
        await runtime.logAccountDeletionOnce(
          safeKey(deletionKey),
          status === 'completed' ? 'completed' : 'provider_cleanup_pending',
        );
      });
    },
  };
}

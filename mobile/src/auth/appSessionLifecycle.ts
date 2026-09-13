import { createSessionLifecycle, type SessionLifecycle } from './sessionLifecycle';

let lifecycle: SessionLifecycle | null = null;

function isJestRuntime(): boolean {
  // eslint-disable-next-line no-restricted-syntax -- preserves the native Firebase/Jest boundary
  return typeof process.env.JEST_WORKER_ID === 'string';
}

export function getAppSessionLifecycle(): SessionLifecycle {
  if (lifecycle !== null) return lifecycle;
  if (isJestRuntime()) {
    lifecycle = createSessionLifecycle({
      observe: (listener) => {
        listener(null);
        return () => undefined;
      },
      getCurrentUid: () => null,
      clearConsent: async () => undefined,
    });
    return lifecycle;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- native Firebase stays out of Jest
    const loaded = require('./nativeSessionLifecycle') as {
      nativeSessionLifecycle: SessionLifecycle;
    };
    lifecycle = loaded.nativeSessionLifecycle;
  } catch {
    lifecycle = createSessionLifecycle({
      observe: (listener) => {
        listener(null);
        return () => undefined;
      },
      getCurrentUid: () => null,
      clearConsent: async () => undefined,
    });
  }
  return lifecycle;
}

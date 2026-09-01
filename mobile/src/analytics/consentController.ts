export interface AnalyticsConsentAdapter {
  setCollectionEnabled(enabled: boolean): Promise<void>;
  setConsent(settings: {
    readonly analyticsStorage: boolean;
    readonly adStorage: false;
    readonly adUserData: false;
    readonly adPersonalization: false;
  }): Promise<void>;
  setUserId(profileId: string | null): Promise<void>;
  resetData(): Promise<void>;
}

export interface AnalyticsSessionSnapshot {
  readonly revision: number;
  readonly authenticated: boolean;
}

export interface AnalyticsConsentController {
  applyProfile(options: {
    readonly profileId: string;
    readonly analyticsConsent: boolean;
    readonly sessionRevision: number;
  }): Promise<boolean>;
  clear(): Promise<boolean>;
}

type ActiveIdentity = { readonly profileId: string; readonly sessionRevision: number };

const DENIED_CONSENT = Object.freeze({
  analyticsStorage: false,
  adStorage: false,
  adUserData: false,
  adPersonalization: false,
} as const);

const ANALYTICS_ONLY_CONSENT = Object.freeze({
  analyticsStorage: true,
  adStorage: false,
  adUserData: false,
  adPersonalization: false,
} as const);

function safeProfileId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
}

export function createAnalyticsConsentController(options: {
  readonly adapter: AnalyticsConsentAdapter;
  readonly getSession: () => AnalyticsSessionSnapshot;
}): AnalyticsConsentController {
  const { adapter, getSession } = options;
  let active: ActiveIdentity | null = null;
  let queue: Promise<void> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function isCurrent(sessionRevision: number): boolean {
    const session = getSession();
    return session.authenticated && session.revision === sessionRevision;
  }

  async function attempt(task: () => Promise<void>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch {
      return false;
    }
  }

  async function disableAndReset(): Promise<boolean> {
    let succeeded = await attempt(() => adapter.setCollectionEnabled(false));
    if (!(await attempt(() => adapter.setConsent(DENIED_CONSENT)))) succeeded = false;
    if (!(await attempt(() => adapter.setUserId(null)))) succeeded = false;
    if (!(await attempt(() => adapter.resetData()))) succeeded = false;
    active = null;
    return succeeded;
  }

  async function stopIfSessionChanged(sessionRevision: number): Promise<boolean> {
    if (isCurrent(sessionRevision)) return false;
    await disableAndReset();
    return true;
  }

  return {
    applyProfile({ profileId, analyticsConsent, sessionRevision }): Promise<boolean> {
      return enqueue(async () => {
        if (!isCurrent(sessionRevision)) {
          if (active === null || active.sessionRevision === sessionRevision) {
            await disableAndReset();
          }
          return false;
        }
        if (!analyticsConsent || !safeProfileId(profileId)) {
          await disableAndReset();
          return false;
        }
        if (active?.profileId === profileId && active.sessionRevision === sessionRevision) {
          return true;
        }

        if (!(await disableAndReset()) || (await stopIfSessionChanged(sessionRevision))) {
          return false;
        }
        if (!(await attempt(() => adapter.setConsent(ANALYTICS_ONLY_CONSENT)))) {
          await disableAndReset();
          return false;
        }
        if (await stopIfSessionChanged(sessionRevision)) return false;
        if (!(await attempt(() => adapter.setUserId(profileId)))) {
          await disableAndReset();
          return false;
        }
        if (await stopIfSessionChanged(sessionRevision)) return false;
        if (!(await attempt(() => adapter.setCollectionEnabled(true)))) {
          await disableAndReset();
          return false;
        }
        if (await stopIfSessionChanged(sessionRevision)) return false;

        active = { profileId, sessionRevision };
        return true;
      });
    },
    clear(): Promise<boolean> {
      return enqueue(disableAndReset);
    },
  };
}

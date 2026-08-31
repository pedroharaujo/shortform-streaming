import {
  createAnalyticsConsentController,
  type AnalyticsConsentAdapter,
  type AnalyticsSessionSnapshot,
} from './consentController';

function setup() {
  const calls: string[] = [];
  let session: AnalyticsSessionSnapshot = { revision: 1, authenticated: true };
  let hook: ((call: string) => void) | undefined;
  const record = async (call: string) => {
    calls.push(call);
    hook?.(call);
  };
  const adapter: AnalyticsConsentAdapter = {
    setCollectionEnabled: async (enabled) => record(`collection:${String(enabled)}`),
    setConsent: async (settings) =>
      record(
        `consent:${String(settings.analyticsStorage)}:${String(settings.adStorage)}:${String(settings.adUserData)}:${String(settings.adPersonalization)}`,
      ),
    setUserId: async (profileId) => record(`user:${profileId ?? 'null'}`),
    resetData: async () => record('reset'),
  };
  const controller = createAnalyticsConsentController({ adapter, getSession: () => session });
  return {
    adapter,
    calls,
    controller,
    setHook(next: ((call: string) => void) | undefined) {
      hook = next;
    },
    setSession(next: AnalyticsSessionSnapshot) {
      session = next;
    },
  };
}

const CLEANUP = ['collection:false', 'consent:false:false:false:false', 'user:null', 'reset'];

it('keeps collection denied and clears identity when consent is off', async () => {
  const { calls, controller } = setup();

  await expect(
    controller.applyProfile({
      profileId: 'usr_synthetic',
      analyticsConsent: false,
      sessionRevision: 1,
    }),
  ).resolves.toBe(false);

  expect(calls).toEqual(CLEANUP);
});

it('cleans old state before enabling analytics-only consent for the server profile', async () => {
  const { calls, controller } = setup();

  await expect(
    controller.applyProfile({
      profileId: 'usr_synthetic',
      analyticsConsent: true,
      sessionRevision: 1,
    }),
  ).resolves.toBe(true);

  expect(calls).toEqual([
    ...CLEANUP,
    'consent:true:false:false:false',
    'user:usr_synthetic',
    'collection:true',
  ]);
});

it('does not reset or relink the same active profile in the same session', async () => {
  const { calls, controller } = setup();
  const options = {
    profileId: 'usr_synthetic',
    analyticsConsent: true,
    sessionRevision: 1,
  } as const;

  await controller.applyProfile(options);
  calls.length = 0;
  await expect(controller.applyProfile(options)).resolves.toBe(true);

  expect(calls).toEqual([]);
});

it('never enables a stale or signed-out session', async () => {
  const { calls, controller, setSession } = setup();
  setSession({ revision: 2, authenticated: false });

  await expect(
    controller.applyProfile({
      profileId: 'usr_old',
      analyticsConsent: true,
      sessionRevision: 1,
    }),
  ).resolves.toBe(false);

  expect(calls).toEqual(CLEANUP);
  expect(calls).not.toContain('collection:true');
  expect(calls).not.toContain('user:usr_old');
});

it('stops and cleans up when the session changes during activation', async () => {
  const { calls, controller, setHook, setSession } = setup();
  setHook((call) => {
    if (call === 'user:usr_old') setSession({ revision: 2, authenticated: true });
  });

  await expect(
    controller.applyProfile({
      profileId: 'usr_old',
      analyticsConsent: true,
      sessionRevision: 1,
    }),
  ).resolves.toBe(false);

  expect(calls).toEqual([...CLEANUP, 'consent:true:false:false:false', 'user:usr_old', ...CLEANUP]);
  expect(calls).not.toContain('collection:true');
});

it('cleans the previous identity before a replacement session is enabled', async () => {
  const { calls, controller, setSession } = setup();
  await controller.applyProfile({
    profileId: 'usr_first',
    analyticsConsent: true,
    sessionRevision: 1,
  });
  calls.length = 0;
  setSession({ revision: 2, authenticated: true });

  await expect(
    controller.applyProfile({
      profileId: 'usr_second',
      analyticsConsent: true,
      sessionRevision: 2,
    }),
  ).resolves.toBe(true);

  expect(calls).toEqual([
    ...CLEANUP,
    'consent:true:false:false:false',
    'user:usr_second',
    'collection:true',
  ]);
});

it('rejects unsafe profile identifiers before they reach the provider', async () => {
  const { calls, controller } = setup();

  await expect(
    controller.applyProfile({
      profileId: 'person@example.com',
      analyticsConsent: true,
      sessionRevision: 1,
    }),
  ).resolves.toBe(false);

  expect(calls).toEqual(CLEANUP);
  expect(calls).not.toContain('user:person@example.com');
});

it('contains provider failures and completes every cleanup step', async () => {
  const { adapter, calls, controller } = setup();
  adapter.setCollectionEnabled = async (enabled) => {
    calls.push(`collection:${String(enabled)}`);
    if (!enabled) throw new Error('native failure');
  };

  await expect(
    controller.applyProfile({
      profileId: 'usr_synthetic',
      analyticsConsent: false,
      sessionRevision: 1,
    }),
  ).resolves.toBe(false);

  expect(calls).toEqual(CLEANUP);
});

it('explicitly clears collection, consent, identity, and local analytics data', async () => {
  const { calls, controller } = setup();

  await expect(controller.clear()).resolves.toBe(true);

  expect(calls).toEqual(CLEANUP);
});

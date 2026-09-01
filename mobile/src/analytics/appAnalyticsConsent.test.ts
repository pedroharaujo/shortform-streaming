import type { AnalyticsConsentAdapter } from './consentController';
import { selectAnalyticsConsentAdapter } from './appAnalyticsConsent';

function adapterDouble(): AnalyticsConsentAdapter {
  return {
    setCollectionEnabled: jest.fn(async () => undefined),
    setConsent: jest.fn(async () => undefined),
    setUserId: jest.fn(async () => undefined),
    resetData: jest.fn(async () => undefined),
  };
}

it('never constructs the native Analytics adapter for production', async () => {
  const createNativeAdapter = jest.fn(adapterDouble);
  const adapter = selectAnalyticsConsentAdapter({ environment: 'production', createNativeAdapter });

  await adapter.setCollectionEnabled(true);
  await adapter.setConsent({
    analyticsStorage: true,
    adStorage: false,
    adUserData: false,
    adPersonalization: false,
  });
  await adapter.setUserId('usr_synthetic');
  await adapter.resetData();

  expect(createNativeAdapter).not.toHaveBeenCalled();
});

it.each(['local', 'staging'] as const)(
  'uses the native Analytics adapter for consent validation in %s',
  (environment) => {
    const nativeAdapter = adapterDouble();
    const createNativeAdapter = jest.fn(() => nativeAdapter);

    expect(selectAnalyticsConsentAdapter({ environment, createNativeAdapter })).toBe(nativeAdapter);
    expect(createNativeAdapter).toHaveBeenCalledTimes(1);
  },
);

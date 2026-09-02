import {
  readAdsConfiguration,
  readAnalyticsEnabled,
  readApiConfiguration,
} from './appConfiguration';

describe('readApiConfiguration', () => {
  it('reads the configuration frozen into the Expo manifest', () => {
    expect(
      readApiConfiguration({
        api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000' },
      }),
    ).toEqual({ environment: 'local', baseUrl: 'http://10.0.2.2:8000' });
  });
});

it('reads the fail-closed ad and analytics switches frozen into the manifest', () => {
  const extra = {
    ads: {
      mode: 'disabled',
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',
      rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
    },
    analytics: { enabled: false },
  };
  expect(readAdsConfiguration(extra, 'production').mode).toBe('disabled');
  expect(readAnalyticsEnabled(extra)).toBe(false);
});

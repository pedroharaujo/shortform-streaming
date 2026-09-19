import {
  readAdsConfiguration,
  readAnalyticsEnabled,
  readAppCheckConfiguration,
  readApiConfiguration,
  readFirebaseAuthConfiguration,
  readPurchaseConfiguration,
} from './appConfiguration';
import {
  EnvironmentConfigurationError,
  resolveApiConfiguration,
  resolveFirebaseAuthConfiguration,
  resolvePurchaseConfiguration,
} from '../../app.config';

describe('readApiConfiguration', () => {
  it('reads the configuration frozen into the Expo manifest', () => {
    expect(
      readApiConfiguration({
        api: { environment: 'local', baseUrl: 'http://10.0.2.2:8000' },
      }),
    ).toEqual({ environment: 'local', baseUrl: 'http://10.0.2.2:8000' });
  });
});

describe('Firebase auth configuration', () => {
  it.each([
    ['local', 'emulator'],
    ['staging', 'cloud'],
    ['production', 'cloud'],
  ] as const)('preserves the %s default', (environment, mode) => {
    expect(resolveFirebaseAuthConfiguration({}, environment)).toEqual({ mode });
    for (const extra of [undefined, null, {}]) {
      expect(readFirebaseAuthConfiguration(extra, environment)).toEqual({ mode });
    }
  });

  it('allows cloud Auth with the local API', () => {
    expect(
      resolveFirebaseAuthConfiguration({ EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'cloud' }, 'local'),
    ).toEqual({ mode: 'cloud' });
    expect(readFirebaseAuthConfiguration({ auth: { mode: 'cloud' } }, 'local')).toEqual({
      mode: 'cloud',
    });
  });

  it.each(['staging', 'production'] as const)('rejects emulator Auth in %s', (environment) => {
    expect(() =>
      resolveFirebaseAuthConfiguration({ EXPO_PUBLIC_FIREBASE_AUTH_MODE: 'emulator' }, environment),
    ).toThrow('local');
    expect(() =>
      readFirebaseAuthConfiguration({ auth: { mode: 'emulator' } }, environment),
    ).toThrow('local');
  });

  it.each(['', 'invalid', 'Cloud', 'cloud ', ' emulator'])(
    'rejects explicit invalid mode %j',
    (mode) => {
      expect(() =>
        resolveFirebaseAuthConfiguration({ EXPO_PUBLIC_FIREBASE_AUTH_MODE: mode }, 'local'),
      ).toThrow('EXPO_PUBLIC_FIREBASE_AUTH_MODE');
    },
  );

  it.each([undefined, null, [], 'cloud', {}, { mode: null }, { mode: true }, { mode: 'invalid' }])(
    'rejects a present malformed manifest auth field %j',
    (auth) => {
      expect(() => readFirebaseAuthConfiguration({ auth }, 'local')).toThrow(
        EnvironmentConfigurationError,
      );
    },
  );
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
  expect(readAppCheckConfiguration({ appCheck: { mode: 'disabled' } })).toEqual({
    mode: 'disabled',
  });
});

describe('local Android purchase configuration', () => {
  const androidSdk = 'goog_SyntheticPublicAndroidSdk12345';
  const enabled = { mode: 'revenuecat_sandbox', androidSdk };
  const source = {
    EXPO_PUBLIC_COIN_PURCHASE_MODE: 'revenuecat_sandbox',
    EXPO_PUBLIC_REVENUECAT_ANDROID_SDK: androidSdk,
  };

  it('keeps absent and older manifests disabled', () => {
    expect(resolvePurchaseConfiguration({}, 'local')).toEqual({ mode: 'disabled' });
    for (const extra of [undefined, null, {}, { purchases: undefined }]) {
      expect(readPurchaseConfiguration(extra, 'local')).toEqual({ mode: 'disabled' });
    }
    expect(readPurchaseConfiguration({ purchases: { mode: 'disabled' } }, 'local')).toEqual({
      mode: 'disabled',
    });
  });

  it('accepts only an explicit local opt-in with a public Google SDK identifier', () => {
    expect(resolvePurchaseConfiguration(source, 'local')).toEqual(enabled);
    expect(readPurchaseConfiguration({ purchases: enabled }, 'local')).toEqual(enabled);
    expect(() =>
      resolveApiConfiguration({
        ...source,
        EXPO_PUBLIC_API_ENVIRONMENT: 'local',
        EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8000',
      }),
    ).not.toThrow();
  });

  it.each([
    '',
    'appl_SyntheticPublicSdk12345',
    'sk_SyntheticPrivateMaterial',
    'goog_short',
    'goog_ spaced',
    androidSdk + '\n',
    'goog_' + 'a'.repeat(129),
  ])('rejects an invalid SDK identifier without echoing it: %s', (value) => {
    expect(() =>
      resolvePurchaseConfiguration(
        { ...source, EXPO_PUBLIC_REVENUECAT_ANDROID_SDK: value },
        'local',
      ),
    ).toThrow('public Google Android SDK identifier');
    expect(
      readPurchaseConfiguration({ purchases: { ...enabled, androidSdk: value } }, 'local'),
    ).toEqual({ mode: 'disabled' });
  });

  it.each(['staging', 'production'] as const)('rejects activation in %s', (environment) => {
    expect(() => resolvePurchaseConfiguration(source, environment)).toThrow('local development');
    expect(readPurchaseConfiguration({ purchases: enabled }, environment)).toEqual({
      mode: 'disabled',
    });
  });

  it('rejects release builds and malformed modes while retaining the public-secret guard', () => {
    expect(() =>
      resolvePurchaseConfiguration({ ...source, NODE_ENV: 'production' }, 'local'),
    ).toThrow('local development');
    expect(() =>
      resolvePurchaseConfiguration(
        { ...source, EXPO_PUBLIC_COIN_PURCHASE_MODE: 'production' },
        'local',
      ),
    ).toThrow('disabled or revenuecat_sandbox');
    for (const purchases of [
      null,
      [],
      'enabled',
      {},
      { mode: true },
      { mode: 'production' },
      { ...enabled, androidSdk: 123 },
    ]) {
      expect(readPurchaseConfiguration({ purchases }, 'local')).toEqual({ mode: 'disabled' });
    }
    expect(() =>
      resolveApiConfiguration({
        EXPO_PUBLIC_API_ENVIRONMENT: 'local',
        EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8000',
        EXPO_PUBLIC_REVENUECAT_API_KEY: 'replace-with-provider-value',
      }),
    ).toThrow('Refusing to build');
  });
});

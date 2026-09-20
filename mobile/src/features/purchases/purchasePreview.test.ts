import { Platform } from 'react-native';
import { getApiConfiguration, getPurchaseConfiguration } from '../../config/appConfiguration';
import { isPurchasePreviewEnabled } from './purchasePreview';

jest.mock('../../config/appConfiguration', () => ({
  getApiConfiguration: jest.fn(),
  getPurchaseConfiguration: jest.fn(),
}));

afterEach(() => jest.restoreAllMocks());

it.each([
  [true, 'android', 'local', 'disabled', true],
  [false, 'android', 'local', 'disabled', false],
  [true, 'ios', 'local', 'disabled', false],
  [true, 'android', 'staging', 'disabled', false],
  [true, 'android', 'production', 'disabled', false],
  [true, 'android', 'local', 'revenuecat_sandbox', false],
] as const)(
  'gates preview for dev=%s platform=%s environment=%s checkout=%s',
  (development, platform, environment, mode, expected) => {
    jest.replaceProperty(
      globalThis as typeof globalThis & { __DEV__: boolean },
      '__DEV__',
      development,
    );
    jest.replaceProperty(Platform, 'OS', platform);
    jest
      .mocked(getApiConfiguration)
      .mockReturnValue({ environment, baseUrl: 'http://localhost:8000' });
    jest
      .mocked(getPurchaseConfiguration)
      .mockReturnValue(
        mode === 'disabled' ? { mode } : { mode, androidSdk: 'goog_syntheticpreviewtest' },
      );
    expect(isPurchasePreviewEnabled()).toBe(expected);
  },
);

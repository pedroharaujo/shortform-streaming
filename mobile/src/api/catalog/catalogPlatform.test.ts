import { resolveCatalogPlatform } from './catalogPlatform';
import { CatalogPlatformError } from './types';

describe('resolveCatalogPlatform', () => {
  it('maps ios and android', () => {
    expect(resolveCatalogPlatform('ios')).toBe('ios');
    expect(resolveCatalogPlatform('android')).toBe('android');
  });

  it('fails closed on web and any other OS', () => {
    expect(() => resolveCatalogPlatform('web')).toThrow(CatalogPlatformError);
    expect(() => resolveCatalogPlatform('windows')).toThrow(/ios or android/);
    expect(() => resolveCatalogPlatform('macos')).toThrow(CatalogPlatformError);
  });
});

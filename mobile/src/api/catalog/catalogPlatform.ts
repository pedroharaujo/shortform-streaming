import { CatalogPlatformError, type CatalogPlatform } from './types';

export function resolveCatalogPlatform(os: string): CatalogPlatform {
  if (os === 'ios' || os === 'android') {
    return os;
  }
  throw new CatalogPlatformError(
    `Catalog requests require ios or android; received ${JSON.stringify(os)}.`,
  );
}

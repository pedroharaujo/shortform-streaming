import { Platform } from 'react-native';

import { createCatalogClient } from '../../api/catalog/catalogClient';
import { resolveCatalogPlatform } from '../../api/catalog/catalogPlatform';
import type { CatalogClient } from '../../api/catalog/types';
import { getApiConfiguration } from '../../config/appConfiguration';

export function createAppCatalogClient(): CatalogClient {
  const configuration = getApiConfiguration();
  return createCatalogClient({
    baseUrl: configuration.baseUrl,
    territory: configuration.catalogTerritory,
    platform: resolveCatalogPlatform(Platform.OS),
  });
}

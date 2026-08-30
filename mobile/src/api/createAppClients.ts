/**
 * Android app API clients. Routes should call these instead of assembling
 * catalog/playback/progress/me options from Platform.OS or public config.
 */

import { getSessionCredential } from '../auth/session';
import { getApiConfiguration } from '../config/appConfiguration';
import { getOrCreateDeviceId } from '../device/deviceId';
import { createAccountClient } from './account/accountClient';
import type { AccountClient } from './account/types';
import { createCatalogClient } from './catalog/catalogClient';
import type { CatalogClient } from './catalog/types';
import { MVP_CLIENT_PLATFORM } from './context';
import { createHealthClient } from './health/healthClient';
import type { HealthClient } from './health/types';
import { createMeClient } from './me/meClient';
import type { MeClient } from './me/types';
import { createPlaybackClient } from './playback/playbackClient';
import type { PlaybackClient } from './playback/types';
import { createProgressClient } from './progress/progressClient';
import type { ProgressClient } from './progress/types';

function appCatalogOptions() {
  const configuration = getApiConfiguration();
  return {
    baseUrl: configuration.baseUrl,
    territory: configuration.catalogTerritory,
    platform: MVP_CLIENT_PLATFORM,
  };
}

export function createAppCatalogClient(): CatalogClient {
  return createCatalogClient(appCatalogOptions());
}

export function createAppPlaybackClient(
  options?: Pick<Parameters<typeof createPlaybackClient>[0], 'getCredential'>,
): PlaybackClient {
  return createPlaybackClient({ ...appCatalogOptions(), ...options });
}

export function createAppPlayerClients(): {
  readonly catalog: CatalogClient;
  readonly playback: PlaybackClient;
  readonly progress: ProgressClient;
} {
  const options = appCatalogOptions();
  return {
    catalog: createCatalogClient(options),
    playback: createPlaybackClient({ ...options, getCredential: getSessionCredential }),
    progress: createProgressClient({
      ...options,
      getCredential: getSessionCredential,
      getDeviceId: getOrCreateDeviceId,
    }),
  };
}

export function createAppMeClient(): MeClient {
  return createMeClient({
    baseUrl: getApiConfiguration().baseUrl,
    getCredential: getSessionCredential,
  });
}

export function createAppHealthClient(): HealthClient {
  return createHealthClient({ baseUrl: getApiConfiguration().baseUrl });
}

export function createAppAccountClient(): AccountClient {
  return createAccountClient({
    baseUrl: getApiConfiguration().baseUrl,
    getCredential: getSessionCredential,
  });
}

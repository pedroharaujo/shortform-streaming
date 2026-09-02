/**
 * Android app API clients. Routes should call these instead of assembling
 * catalog/playback/progress/me options from the public API base URL.
 */

import { getSessionCredential } from '../auth/session';
import { createAppCheckFetch } from '../appCheck/appCheckFetch';
import { getNativeAppCheckToken } from '../appCheck/nativeAppCheck';
import { getApiConfiguration, getAppCheckConfiguration } from '../config/appConfiguration';
import { getOrCreateDeviceId } from '../device/deviceId';
import { createAccountClient } from './account/accountClient';
import type { AccountClient } from './account/types';
import { createCatalogClient } from './catalog/catalogClient';
import type { CatalogClient } from './catalog/types';
import { createMeClient } from './me/meClient';
import type { MeClient } from './me/types';
import { createPlaybackClient } from './playback/playbackClient';
import type { PlaybackClient } from './playback/types';
import { createProgressClient } from './progress/progressClient';
import type { ProgressClient } from './progress/types';
import { createRewardsClient } from './rewards/rewardsClient';
import type { RewardsClient } from './rewards/types';

function appApiOptions() {
  const appCheck = getAppCheckConfiguration();
  return {
    baseUrl: getApiConfiguration().baseUrl,
    fetchImplementation:
      appCheck.mode === 'enforce' ? createAppCheckFetch(getNativeAppCheckToken) : globalThis.fetch,
  };
}

export function createAppCatalogClient(): CatalogClient {
  return createCatalogClient(appApiOptions());
}

export function createAppPlaybackClient(
  options?: Pick<Parameters<typeof createPlaybackClient>[0], 'getCredential'>,
): PlaybackClient {
  return createPlaybackClient({ ...appApiOptions(), ...options });
}

export function createAppPlayerClients(): {
  readonly catalog: CatalogClient;
  readonly playback: PlaybackClient;
  readonly progress: ProgressClient;
} {
  const options = appApiOptions();
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
    ...appApiOptions(),
    getCredential: getSessionCredential,
  });
}

export function createAppAccountClient(): AccountClient {
  return createAccountClient({
    ...appApiOptions(),
    getCredential: getSessionCredential,
  });
}

export function createAppRewardsClient(): RewardsClient {
  return createRewardsClient({ ...appApiOptions(), getCredential: getSessionCredential });
}

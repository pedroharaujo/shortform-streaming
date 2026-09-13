/**
 * Android app API clients. Routes should call these instead of assembling
 * catalog/playback/progress/me options from the public API base URL.
 */

import { getSessionCredential } from '../auth/session';
import { createAuthenticatedFetch } from '../auth/authenticatedFetch';
import type { NativeSessionUser } from '../auth/sessionLifecycle';
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
import { createPurchaseCheckoutClient } from './purchases/purchaseCheckoutClient';
import type { PurchaseCheckoutClient } from './purchases/checkoutTypes';
import { createPurchasesClient } from './purchases/purchasesClient';
import type { PurchasesClient } from './purchases/types';
import { createRewardsClient } from './rewards/rewardsClient';
import type { RewardsClient } from './rewards/types';
import { createWalletClient } from './wallet/walletClient';
import type { WalletClient } from './wallet/types';

function appApiOptions() {
  const appCheck = getAppCheckConfiguration();
  const getAppCheckToken = appCheck.mode === 'enforce' ? getNativeAppCheckToken : undefined;
  let fetchImplementation: typeof fetch;
  // eslint-disable-next-line no-restricted-syntax -- native Firebase stays outside Jest's module graph
  if (typeof process.env.JEST_WORKER_ID === 'string') {
    fetchImplementation =
      getAppCheckToken === undefined
        ? globalThis.fetch
        : createAppCheckFetch(getAppCheckToken, globalThis.fetch);
  } else {
    let getCurrentUser: () => NativeSessionUser | null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- native Firebase runtime only
      const native = require('../auth/nativeSessionLifecycle') as {
        getCurrentNativeSessionUser: () => NativeSessionUser | null;
      };
      getCurrentUser = native.getCurrentNativeSessionUser;
    } catch {
      getCurrentUser = () => null;
    }
    fetchImplementation = createAuthenticatedFetch({
      getCurrentUser,
      getAppCheckToken,
      fetchImplementation: globalThis.fetch,
    });
  }
  return {
    baseUrl: getApiConfiguration().baseUrl,
    fetchImplementation,
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

export function createAppWalletClient(): WalletClient {
  return createWalletClient({ ...appApiOptions(), getCredential: getSessionCredential });
}

export function createAppPurchasesClient(): PurchasesClient {
  return createPurchasesClient({ ...appApiOptions(), getCredential: getSessionCredential });
}

export function createAppPurchaseCheckoutClient(
  mode: 'synthetic' | 'revenuecat_sandbox' = 'synthetic',
): PurchaseCheckoutClient {
  return createPurchaseCheckoutClient({
    ...appApiOptions(),
    getCredential: getSessionCredential,
    mode,
  });
}

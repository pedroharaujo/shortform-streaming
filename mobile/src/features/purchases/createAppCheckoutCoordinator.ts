/* eslint-disable @typescript-eslint/no-require-imports -- disabled checkout must not load native/account dependencies */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApiConfiguration, getPurchaseConfiguration } from '../../config/appConfiguration';
import { isAndroidApplication } from '../../api/purchases/checkoutValidation';
import { getAuthSessionRevision } from '../../auth/session';
import type { CheckoutCoordinator } from './types';
export function createAppCheckoutCoordinator(): CheckoutCoordinator {
  const configuration = getPurchaseConfiguration();
  const applicationId = Constants.expoConfig?.android?.package;
  if (
    Platform.OS === 'android' &&
    configuration.mode === 'revenuecat_sandbox' &&
    isAndroidApplication(applicationId) &&
    (getApiConfiguration().environment === 'staging' ||
      (__DEV__ && getApiConfiguration().environment === 'local'))
  ) {
    // Keep native modules and account dependencies outside the disabled path.
    const { createAppPurchaseCheckoutClient, createAppWalletClient } =
      require('../../api/createAppClients') as typeof import('../../api/createAppClients');
    const { createRevenueCatProvider } =
      require('./revenueCatProvider') as typeof import('./revenueCatProvider');
    const { createCheckoutCoordinator } =
      require('./checkoutCoordinator') as typeof import('./checkoutCoordinator');
    const { pendingPurchaseStorage } =
      require('./pendingPurchaseAttempt') as typeof import('./pendingPurchaseAttempt');
    const revision = getAuthSessionRevision();
    return createCheckoutCoordinator({
      mode: configuration.mode,
      environment: getApiConfiguration().environment,
      development: __DEV__,
      applicationId,
      api: createAppPurchaseCheckoutClient(configuration.mode),
      wallet: createAppWalletClient(),
      provider: createRevenueCatProvider({
        androidSdk: configuration.androidSdk,
        applicationId,
        isCurrent: () => getAuthSessionRevision() === revision,
      }),
      storage: pendingPurchaseStorage,
    });
  }
  return {
    load: async () => ({ status: 'unavailable' }),
    purchase: async () => ({ status: 'unavailable' }),
    sync: async () => ({ status: 'unavailable' }),
  };
}

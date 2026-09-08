import type { CheckoutCoordinator } from './types';
/** Deliberately constructs no API, storage or native provider dependencies. */
export function createAppCheckoutCoordinator(): CheckoutCoordinator {
  return {
    load: async () => ({ status: 'unavailable' }),
    purchase: async () => ({ status: 'unavailable' }),
    sync: async () => ({ status: 'unavailable' }),
  };
}

import Purchases, {
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import type { ProviderIdentity, ProviderPurchase, PurchaseProvider } from './types';

const PROVIDER_UNAVAILABLE = 'Purchase provider unavailable';

interface RevenueCatProviderOptions {
  readonly androidSdk: string;
  readonly applicationId: string;
  readonly isCurrent: () => boolean;
}

interface StoredOffer {
  readonly ownerId: string;
  readonly applicationId: string;
  readonly price: string;
  readonly product: PurchasesStoreProduct;
}

function unavailable(): Error {
  return new Error(PROVIDER_UNAVAILABLE);
}

function guardCurrent(isCurrent: () => boolean): void {
  if (!isCurrent()) throw unavailable();
}

function definitePurchaseFailure(
  error: unknown,
): 'cancelled' | 'product_unavailable' | 'purchase_not_allowed' | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  if (error.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
  // Android 10.20.0: receipt/consume/ack failures do not surface as this native rejection.
  // Recheck that assumption on SDK upgrades; see the declined-payment diagnosis plan.
  if (error.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR)
    return 'purchase_not_allowed';
  if (error.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR)
    return 'product_unavailable';
  return null;
}

function sameApplication(identity: ProviderIdentity, applicationId: string): boolean {
  return identity.applicationId === applicationId;
}

function comparablePrice(product: PurchasesStoreProduct) {
  return Number.isFinite(product.price) &&
    product.price > 0 &&
    typeof product.currencyCode === 'string' &&
    /^[A-Z]{3}$/.test(product.currencyCode)
    ? { priceAmount: product.price, currencyCode: product.currencyCode }
    : {};
}

async function assertIdentity(
  ownerId: string,
  isCurrent: () => boolean,
  customerInfo?: CustomerInfo,
): Promise<CustomerInfo> {
  const boundary = async <T>(operation: () => Promise<T>): Promise<T> => {
    guardCurrent(isCurrent);
    try {
      const result = await operation();
      guardCurrent(isCurrent);
      return result;
    } catch (error) {
      guardCurrent(isCurrent);
      throw error;
    }
  };
  if (customerInfo && customerInfo.originalAppUserId !== ownerId) throw unavailable();
  if ((await boundary(() => Purchases.getAppUserID())) !== ownerId) throw unavailable();
  if (await boundary(() => Purchases.isAnonymous())) throw unavailable();
  const current = customerInfo ?? (await boundary(() => Purchases.getCustomerInfo()));
  if (current.originalAppUserId !== ownerId) throw unavailable();
  // Recheck after every awaited provider response so a process-wide identity switch fails closed.
  if ((await boundary(() => Purchases.getAppUserID())) !== ownerId) throw unavailable();
  if (await boundary(() => Purchases.isAnonymous())) throw unavailable();
  return current;
}

export function createRevenueCatProvider(options: RevenueCatProviderOptions): PurchaseProvider {
  const offers = new Map<string, StoredOffer>();
  const boundary = async <T>(operation: () => Promise<T>): Promise<T> => {
    guardCurrent(options.isCurrent);
    try {
      const result = await operation();
      guardCurrent(options.isCurrent);
      return result;
    } catch (error) {
      guardCurrent(options.isCurrent);
      throw error;
    }
  };

  async function prepare(identity: ProviderIdentity): Promise<unknown> {
    try {
      if (!sameApplication(identity, options.applicationId)) throw unavailable();
      if (!(await boundary(() => Purchases.isConfigured()))) {
        guardCurrent(options.isCurrent);
        Purchases.setLogHandler(() => undefined);
        guardCurrent(options.isCurrent);
        Purchases.configure({
          apiKey: options.androidSdk,
          appUserID: identity.ownerId,
          diagnosticsEnabled: false,
          automaticDeviceIdentifierCollectionEnabled: false,
        });
      } else {
        const currentOwner = await boundary(() => Purchases.getAppUserID());
        if (await boundary(() => Purchases.isAnonymous())) throw unavailable();
        if (currentOwner !== identity.ownerId) {
          const result = await boundary(() => Purchases.logIn(identity.ownerId));
          await assertIdentity(identity.ownerId, options.isCurrent, result.customerInfo);
        }
      }
      await assertIdentity(identity.ownerId, options.isCurrent);
      offers.clear();
      return Object.freeze({ ownerId: identity.ownerId, applicationId: identity.applicationId });
    } catch {
      throw unavailable();
    }
  }

  async function getOffers(
    identity: ProviderIdentity & { readonly productIds: readonly string[] },
  ): Promise<unknown> {
    try {
      if (!sameApplication(identity, options.applicationId)) throw unavailable();
      await assertIdentity(identity.ownerId, options.isCurrent);
      if (new Set(identity.productIds).size !== identity.productIds.length) throw unavailable();
      const products = await boundary(() =>
        Purchases.getProducts([...identity.productIds], PRODUCT_CATEGORY.NON_SUBSCRIPTION),
      );
      await assertIdentity(identity.ownerId, options.isCurrent);
      if (products.length !== identity.productIds.length) throw unavailable();

      const requested = new Set(identity.productIds);
      const projected = products.map((product) => {
        if (
          !requested.delete(product.identifier) ||
          product.productCategory !== PRODUCT_CATEGORY.NON_SUBSCRIPTION ||
          typeof product.priceString !== 'string' ||
          product.priceString.trim().length === 0
        )
          throw unavailable();
        offers.set(product.identifier, {
          ownerId: identity.ownerId,
          applicationId: identity.applicationId,
          price: product.priceString,
          product,
        });
        return Object.freeze({
          ownerId: identity.ownerId,
          applicationId: identity.applicationId,
          productId: product.identifier,
          productType: 'consumable',
          store: 'PLAY_STORE',
          environment: 'SANDBOX',
          price: product.priceString,
          ...comparablePrice(product),
        });
      });
      if (requested.size !== 0) throw unavailable();
      return Object.freeze(projected);
    } catch {
      offers.clear();
      throw unavailable();
    }
  }

  async function purchase(request: ProviderPurchase): Promise<unknown> {
    const base = Object.freeze({
      ownerId: request.ownerId,
      applicationId: request.applicationId,
      productId: request.productId,
      store: request.store,
      environment: request.environment,
    });
    const pending = () => Object.freeze({ ...base, outcome: 'pending' });
    try {
      if (!sameApplication(request, options.applicationId)) return pending();
      const offered = offers.get(request.productId);
      if (
        !offered ||
        offered.ownerId !== request.ownerId ||
        offered.applicationId !== request.applicationId ||
        offered.product.priceString !== offered.price
      )
        return pending();
      await assertIdentity(request.ownerId, options.isCurrent);
      let result: MakePurchaseResult;
      try {
        result = await boundary(() => Purchases.purchaseStoreProduct(offered.product));
      } catch (error) {
        // Only explicit native cancellation or purchase/product rejection can clear an attempt.
        // Identity/network failures after a completed purchase must remain pending.
        const outcome = definitePurchaseFailure(error);
        if (!outcome) return pending();
        await assertIdentity(request.ownerId, options.isCurrent);
        return Object.freeze({ ...base, outcome });
      }
      if (
        result.productIdentifier !== request.productId ||
        result.transaction.productIdentifier !== request.productId ||
        result.customerInfo.originalAppUserId !== request.ownerId
      )
        return pending();
      await assertIdentity(request.ownerId, options.isCurrent, result.customerInfo);
      if (
        typeof result.transaction.transactionIdentifier !== 'string' ||
        result.transaction.transactionIdentifier.length === 0
      )
        return pending();
      return Object.freeze({
        ...base,
        outcome: 'completed',
        transactionId: result.transaction.transactionIdentifier,
      });
    } catch {
      return pending();
    }
  }

  return { prepare, getOffers, purchase };
}

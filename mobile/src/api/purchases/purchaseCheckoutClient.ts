import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type { JsonRequestResult } from '../http';
import type {
  CheckoutOutcome,
  PurchaseCatalog,
  PurchaseCheckoutClient,
  PurchaseIdentity,
  PurchaseStatus,
} from './checkoutTypes';
import {
  isCoins,
  isAndroidApplication,
  isAndroidProduct,
  isRecord,
  isSyntheticApplication,
  isSyntheticProduct,
  isTransactionId,
  isTransactionFingerprint,
  isUuid,
} from './checkoutValidation';
const message = 'The checkout request could not be verified.';
const unavailable = { outcome: 'unavailable', message } as const;
function identity(value: unknown): PurchaseIdentity | null {
  return isRecord(value) && isUuid(value.app_user_id)
    ? { app_user_id: value.app_user_id.toLowerCase() }
    : null;
}
function catalog(
  value: unknown,
  validProduct: (value: unknown) => value is string,
): PurchaseCatalog | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.products) ||
    value.products.length < 1 ||
    value.products.length > 32
  )
    return null;
  const products: PurchaseCatalog['products'] = [];
  const ids = new Set<string>();
  for (const row of value.products) {
    if (
      !isRecord(row) ||
      !validProduct(row.product_id) ||
      !isCoins(row.coins) ||
      row.product_type !== 'consumable' ||
      row.store !== 'PLAY_STORE' ||
      row.environment !== 'SANDBOX' ||
      row.price_source !== 'store' ||
      ids.has(row.product_id)
    )
      return null;
    ids.add(row.product_id);
    products.push({
      product_id: row.product_id,
      coins: row.coins,
      product_type: 'consumable',
      store: 'PLAY_STORE',
      environment: 'SANDBOX',
      price_source: 'store',
    });
  }
  return { products };
}
function status(value: unknown): PurchaseStatus | null {
  if (!isRecord(value)) return null;
  if (
    value.status === 'awaiting_verification' &&
    value.historical_credited_coins === 0 &&
    value.support_reference === null
  )
    return {
      status: 'awaiting_verification',
      historical_credited_coins: 0,
      support_reference: null,
    };
  if (
    (value.status === 'credited' || value.status === 'review_required') &&
    isCoins(value.historical_credited_coins) &&
    isUuid(value.support_reference)
  )
    return {
      status: value.status,
      historical_credited_coins: value.historical_credited_coins,
      support_reference: value.support_reference,
    };
  return null;
}
function project<T>(
  result: JsonRequestResult<T>,
  validate: (value: unknown) => T | null,
): CheckoutOutcome<T> {
  if (result.outcome !== 'ok') return unavailable;
  const data = validate(result.data);
  return data === null ? unavailable : { outcome: 'ok', data };
}
export function createPurchaseCheckoutClient(options: {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly fetchImplementation?: typeof fetch;
  readonly mode?: 'synthetic' | 'revenuecat_sandbox';
}): PurchaseCheckoutClient {
  const api = createOpenApiClient(options);
  const native = options.mode === 'revenuecat_sandbox';
  const validApplication = native ? isAndroidApplication : isSyntheticApplication;
  const validProduct = native ? isAndroidProduct : isSyntheticProduct;
  const transactionRequest = async (
    path: '/v1/purchases/status' | '/v1/purchases/sync',
    request: Parameters<PurchaseCheckoutClient['getStatus']>[0],
  ) => {
    if (
      !isRecord(request) ||
      !validApplication(request.application_id) ||
      !validProduct(request.product_id) ||
      !isTransactionId(request.transaction_id)
    )
      return unavailable;
    return project(
      await mapJsonRequest<PurchaseStatus>(DEFAULT_TIMEOUT_MS, message, (signal) =>
        api.POST(path, {
          body: {
            application_id: request.application_id,
            product_id: request.product_id,
            transaction_id: request.transaction_id,
          },
          headers: bearerHeaders(options.getCredential),
          signal,
        }),
      ),
      status,
    );
  };
  return {
    async getIdentity() {
      return project(
        await mapJsonRequest<PurchaseIdentity>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.POST('/v1/purchases/identity', {
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        identity,
      );
    },
    async getCatalog(applicationId) {
      if (!validApplication(applicationId)) return unavailable;
      return project(
        await mapJsonRequest<PurchaseCatalog>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.POST('/v1/purchases/catalog', {
            body: { application_id: applicationId },
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        (value) => catalog(value, validProduct),
      );
    },
    getStatus: (request) => transactionRequest('/v1/purchases/status', request),
    sync: (request) =>
      native ? transactionRequest('/v1/purchases/sync', request) : Promise.resolve(unavailable),
    async recover(request) {
      if (
        !native ||
        !isRecord(request) ||
        !validApplication(request.application_id) ||
        !validProduct(request.product_id) ||
        !isTransactionFingerprint(request.transaction_fingerprint)
      )
        return unavailable;
      return project(
        await mapJsonRequest<PurchaseStatus>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.POST('/v1/purchases/recover', {
            body: {
              application_id: request.application_id,
              product_id: request.product_id,
              transaction_fingerprint: request.transaction_fingerprint,
            },
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        status,
      );
    },
  };
}

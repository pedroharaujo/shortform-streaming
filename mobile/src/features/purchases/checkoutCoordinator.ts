import { randomUUID } from 'expo-crypto';
import { getAuthSessionRevision } from '../../auth/session';
import {
  isRecord,
  isSyntheticApplication,
  isTransactionId,
} from '../../api/purchases/checkoutValidation';
import { samePurchaseAttempt } from './pendingPurchaseAttempt';
import type { PendingPurchaseAttempt } from './pendingPurchaseAttempt';
import type {
  CheckoutCoordinator,
  CheckoutDependencies,
  CheckoutOffer,
  CheckoutState,
} from './types';
const unavailable = { status: 'unavailable' } as const;
const awaiting = { status: 'awaiting_verification' } as const;
// One SDK identity boundary per process. Busy operations are never queued/replayed.
let operating = false;
class SessionChanged extends Error {}
class StorageUnavailable extends Error {}
export function createCheckoutCoordinator(options: CheckoutDependencies): CheckoutCoordinator {
  const revision = getAuthSessionRevision();
  let invalidated = false;
  let ownerId: string | null = null;
  let offers: readonly CheckoutOffer[] | null = null;
  let completed: { attempt: PendingPurchaseAttempt; transactionId: string } | null = null;
  const enabled =
    options.mode === 'synthetic' &&
    options.environment === 'local' &&
    options.development &&
    isSyntheticApplication(options.applicationId);
  const isCurrent = () => {
    if (getAuthSessionRevision() !== revision) {
      invalidated = true;
      offers = null;
      completed = null;
    }
    return !invalidated;
  };
  function guard() {
    if (!isCurrent()) throw new SessionChanged();
  }
  async function boundary<T>(operation: () => Promise<T>): Promise<T> {
    guard();
    try {
      const result = await operation();
      guard();
      return result;
    } catch (error) {
      guard();
      throw error;
    }
  }
  async function storage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await boundary(operation);
    } catch (error) {
      if (error instanceof SessionChanged) throw error;
      throw new StorageUnavailable();
    }
  }
  async function run(operation: () => Promise<CheckoutState>): Promise<CheckoutState> {
    if (!enabled) return unavailable;
    if (!isCurrent()) return { status: 'session_changed' };
    if (operating) return { status: 'busy' };
    operating = true;
    try {
      const result = await operation();
      guard();
      return result;
    } catch (error) {
      if (!isCurrent() || error instanceof SessionChanged) return { status: 'session_changed' };
      if (error instanceof StorageUnavailable) return { status: 'storage_unavailable' };
      return unavailable;
    } finally {
      operating = false;
    }
  }
  async function identity(): Promise<string | null> {
    const result = await boundary(() => options.api.getIdentity());
    if (result.outcome !== 'ok') return null;
    if (ownerId !== null && ownerId !== result.data.app_user_id) {
      invalidated = true;
      offers = null;
      completed = null;
      throw new SessionChanged();
    }
    ownerId = result.data.app_user_id;
    return ownerId;
  }
  async function freshOffers(owner: string): Promise<readonly CheckoutOffer[] | null> {
    const catalog = await boundary(() => options.api.getCatalog(options.applicationId));
    if (catalog.outcome !== 'ok') return null;
    const scope = { ownerId: owner, applicationId: options.applicationId };
    const prepared = await boundary(() => options.provider.prepare(scope));
    if (
      !isRecord(prepared) ||
      prepared.ownerId !== owner ||
      prepared.applicationId !== scope.applicationId
    )
      return null;
    const providerOffers = await boundary(() => options.provider.getOffers(scope));
    if (!Array.isArray(providerOffers) || providerOffers.length !== catalog.data.products.length)
      return null;
    const byId = new Map<string, string>();
    for (const offer of providerOffers) {
      if (
        !isRecord(offer) ||
        offer.ownerId !== owner ||
        offer.applicationId !== scope.applicationId ||
        offer.productType !== 'consumable' ||
        offer.store !== 'PLAY_STORE' ||
        offer.environment !== 'SANDBOX' ||
        typeof offer.productId !== 'string' ||
        byId.has(offer.productId) ||
        typeof offer.price !== 'string' ||
        offer.price.trim().length === 0 ||
        offer.price.length > 128
      )
        return null;
      byId.set(offer.productId, offer.price);
    }
    const result: CheckoutOffer[] = [];
    for (const product of catalog.data.products) {
      const price = byId.get(product.product_id);
      if (price === undefined) return null;
      result.push(Object.freeze({ productId: product.product_id, coins: product.coins, price }));
    }
    return Object.freeze(result);
  }
  async function verify(attempt: PendingPurchaseAttempt): Promise<CheckoutState> {
    if (!completed || !samePurchaseAttempt(completed.attempt, attempt)) return awaiting;
    const transactionId = completed.transactionId;
    let result;
    try {
      result = await boundary(() =>
        options.api.getStatus({
          application_id: attempt.applicationId,
          product_id: attempt.productId,
          transaction_id: transactionId,
        }),
      );
    } catch (error) {
      if (error instanceof SessionChanged) throw error;
      return awaiting;
    }
    if (
      result.outcome !== 'ok' ||
      result.data.status === 'awaiting_verification' ||
      !result.data.support_reference
    )
      return awaiting;
    const evidence = {
      historicalCreditedCoins: result.data.historical_credited_coins,
      supportReference: result.data.support_reference,
    };
    if (result.data.status === 'review_required') return { status: 'review_required', ...evidence };
    await storage(() => options.storage.clear(attempt, isCurrent));
    completed = null;
    let wallet: Extract<CheckoutState, { status: 'credited' }>['wallet'] = {
      status: 'unavailable',
    };
    try {
      const refreshed = await boundary(() => options.wallet.getWallet());
      if (refreshed.outcome === 'ok')
        wallet = {
          status: 'available',
          data: {
            balance: refreshed.data.balance,
            spending_available: refreshed.data.spending_available,
          },
        };
    } catch (error) {
      if (error instanceof SessionChanged) throw error;
    }
    return { status: 'credited', ...evidence, wallet };
  }
  return {
    load: () =>
      run(async () => {
        offers = null;
        const owner = await identity();
        if (!owner) return unavailable;
        const pending = await storage(() => options.storage.read(owner));
        if (pending) return awaiting;
        offers = await freshOffers(owner);
        return offers ? { status: 'ready', offers } : unavailable;
      }),
    purchase: (productId) =>
      run(async () => {
        const previous = offers?.find((offer) => offer.productId === productId);
        const owner = await identity();
        if (!owner) return unavailable;
        const pending = await storage(() => options.storage.read(owner));
        if (pending) return awaiting;
        if (!previous) return unavailable;
        offers = null;
        const fresh = await freshOffers(owner);
        if (!fresh) return unavailable;
        offers = fresh;
        const selected = fresh.find((offer) => offer.productId === productId);
        if (!selected || selected.price !== previous.price || selected.coins !== previous.coins)
          return { status: 'ready', offers };
        const attempt: PendingPurchaseAttempt = Object.freeze({
          version: 1,
          ownerId: owner,
          applicationId: options.applicationId,
          productId,
          attemptId: randomUUID(),
        });
        await storage(() => options.storage.write(attempt, isCurrent));
        const scope = {
          ownerId: owner,
          applicationId: options.applicationId,
          productId,
          store: 'PLAY_STORE',
          environment: 'SANDBOX',
        } as const;
        let result: unknown;
        try {
          result = await boundary(() => options.provider.purchase(scope));
        } catch (error) {
          if (error instanceof SessionChanged) throw error;
          return awaiting;
        }
        if (
          !isRecord(result) ||
          result.ownerId !== owner ||
          result.applicationId !== scope.applicationId ||
          result.productId !== productId ||
          result.store !== scope.store ||
          result.environment !== scope.environment
        )
          return awaiting;
        if (
          result.outcome === 'cancelled' &&
          Object.keys(result).length === 6 &&
          Object.keys(result).every((key) =>
            ['outcome', 'ownerId', 'applicationId', 'productId', 'store', 'environment'].includes(
              key,
            ),
          )
        ) {
          await storage(() => options.storage.clear(attempt, isCurrent));
          return { status: 'cancelled' };
        }
        if (result.outcome !== 'completed' || !isTransactionId(result.transactionId))
          return awaiting;
        completed = { attempt, transactionId: result.transactionId };
        return verify(attempt);
      }),
    sync: () =>
      run(async () => {
        const owner = await identity();
        if (!owner) return unavailable;
        const pending = await storage(() => options.storage.read(owner));
        if (!pending) return unavailable;
        return verify(pending);
      }),
  };
}

import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type { CheckoutOutcome, PackPresentation } from './checkoutTypes';
import { isCoins, isPackPresentation, isRecord } from './checkoutValidation';

export interface PackPreviewClient {
  getPacks(): Promise<CheckoutOutcome<readonly PackPresentation[]>>;
}

const message = 'Coin packs could not be loaded.';

function packs(value: unknown): readonly PackPresentation[] | null {
  if (!isRecord(value) || !Array.isArray(value.packs) || value.packs.length > 32) return null;
  const result: PackPresentation[] = [];
  const ids = new Set<string>();
  for (const row of value.packs) {
    if (
      !isRecord(row) ||
      typeof row.product_id !== 'string' ||
      !/^[A-Za-z0-9_.:/-]{1,128}$/.test(row.product_id) ||
      ids.has(row.product_id) ||
      !isCoins(row.coins) ||
      !isPackPresentation(row)
    )
      return null;
    ids.add(row.product_id);
    result.push(
      Object.freeze({
        productId: row.product_id,
        coins: row.coins,
        bonusPercent: row.bonus_percent,
        badge: row.badge,
        highlighted: row.highlighted,
      }),
    );
  }
  return Object.freeze(result);
}

/** Local design preview only: Admin packs without prices. */
export function createPackPreviewClient(options: {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly fetchImplementation?: typeof fetch;
}): PackPreviewClient {
  const api = createOpenApiClient(options);
  return {
    async getPacks() {
      const result = await mapJsonRequest<unknown>(DEFAULT_TIMEOUT_MS, message, (signal) =>
        api.GET('/v1/purchases/packs/preview', {
          headers: bearerHeaders(options.getCredential),
          signal,
        }),
      );
      if (result.outcome !== 'ok') return { outcome: 'unavailable', message };
      const data = packs(result.data);
      return data === null ? { outcome: 'unavailable', message } : { outcome: 'ok', data };
    },
  };
}

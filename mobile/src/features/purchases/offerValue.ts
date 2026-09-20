import type { CheckoutOffer } from './types';

function hasComparableMetadata(
  offer: CheckoutOffer,
): offer is CheckoutOffer & { readonly priceAmount: number; readonly currencyCode: string } {
  return (
    Number.isInteger(offer.coins) &&
    offer.coins > 0 &&
    typeof offer.priceAmount === 'number' &&
    Number.isFinite(offer.priceAmount) &&
    offer.priceAmount > 0 &&
    typeof offer.currencyCode === 'string' &&
    /^[A-Z]{3}$/.test(offer.currencyCode)
  );
}

export function coinsPerCurrencyUnit(offer: CheckoutOffer): number | null {
  if (!hasComparableMetadata(offer)) return null;
  const value = offer.coins / offer.priceAmount;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function bestValueProductId(offers: readonly CheckoutOffer[]): string | null {
  if (offers.length < 2 || !offers.every(hasComparableMetadata)) return null;
  const currency = offers[0]!.currencyCode;
  if (offers.some((offer) => offer.currencyCode !== currency)) return null;

  let winner: string | null = null;
  let bestValue = -Infinity;
  let tied = false;
  for (const offer of offers) {
    const value = coinsPerCurrencyUnit(offer);
    if (value === null) return null;
    if (winner === null) {
      bestValue = value;
      winner = offer.productId;
      continue;
    }
    const tolerance = Number.EPSILON * Math.max(Math.abs(value), Math.abs(bestValue)) * 4;
    if (value > bestValue + tolerance) {
      bestValue = value;
      winner = offer.productId;
      tied = false;
    } else if (Math.abs(value - bestValue) <= tolerance) {
      tied = true;
    }
  }
  return tied ? null : winner;
}

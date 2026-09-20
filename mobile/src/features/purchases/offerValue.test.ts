import { bestValueProductId, coinsPerCurrencyUnit } from './offerValue';
import type { CheckoutOffer } from './types';

const offer = (changes: Partial<CheckoutOffer> = {}): CheckoutOffer => ({
  productId: 'coins_100',
  coins: 100,
  price: '$1.00',
  priceAmount: 1,
  currencyCode: 'USD',
  ...changes,
});

test('returns the unique best same-currency offer and a finite per-unit value', () => {
  const offers = [
    offer(),
    offer({ productId: 'coins_250', coins: 250, price: '$2.00', priceAmount: 2 }),
    offer({ productId: 'coins_500', coins: 500, price: '$5.00', priceAmount: 5 }),
  ];

  expect(coinsPerCurrencyUnit(offers[1]!)).toBe(125);
  expect(bestValueProductId(offers)).toBe('coins_250');
});

test.each([
  { name: 'one offer', offers: [offer()] },
  {
    name: 'missing metadata',
    offers: [offer(), { productId: 'coins_200', coins: 200, price: '$2.00', currencyCode: 'USD' }],
  },
  {
    name: 'invalid price',
    offers: [offer(), offer({ productId: 'coins_200', priceAmount: Number.POSITIVE_INFINITY })],
  },
  {
    name: 'invalid coins',
    offers: [offer(), offer({ productId: 'coins_200', coins: 1.5 })],
  },
  {
    name: 'mixed currency',
    offers: [offer(), offer({ productId: 'coins_200', currencyCode: 'EUR' })],
  },
  {
    name: 'tied value',
    offers: [offer(), offer({ productId: 'coins_200', coins: 200, priceAmount: 2 })],
  },
  {
    name: 'floating-point tied value',
    offers: [
      offer({ coins: 1, priceAmount: 0.3 }),
      offer({ productId: 'coins_3', coins: 3, priceAmount: 0.9 }),
    ],
  },
])('omits best value for $name', ({ offers }) => {
  expect(bestValueProductId(offers)).toBeNull();
});

test.each([
  offer({ priceAmount: 0 }),
  offer({ priceAmount: Number.NaN }),
  offer({ coins: 0 }),
  offer({ currencyCode: 'usd' }),
])('returns no per-unit value for invalid comparison metadata %#', (invalid) => {
  expect(coinsPerCurrencyUnit(invalid)).toBeNull();
});

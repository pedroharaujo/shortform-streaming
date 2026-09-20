import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { renderWithSafeArea } from '../../testUtils';
import { CoinPacksScreen } from './CoinPacksScreen';
import type { CheckoutCoordinator, CheckoutOffer, CheckoutState } from './types';

const reference = '44444444-4444-4444-8444-444444444444';
const offers: readonly CheckoutOffer[] = [
  { productId: 'coins_100', coins: 100, price: '$1.00', priceAmount: 1, currencyCode: 'USD' },
  { productId: 'coins_200', coins: 200, price: '$1.50', priceAmount: 1.5, currencyCode: 'USD' },
  { productId: 'coins_300', coins: 300, price: '$4.00', priceAmount: 4, currencyCode: 'USD' },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function coordinator(load: CheckoutState): jest.Mocked<CheckoutCoordinator> {
  return {
    load: jest.fn().mockResolvedValue(load),
    purchase: jest.fn().mockResolvedValue({ status: 'awaiting_verification' }),
    sync: jest.fn().mockResolvedValue({ status: 'awaiting_verification' }),
  };
}

afterEach(() => setAuthSession(null));

it('requires explicit selection, shows the non-largest best value, and refreshes after verification', async () => {
  setAuthSession({ credential: 'mock.synthetic-coin-screen' });
  const checkout = coordinator({ status: 'ready', offers });
  checkout.sync.mockResolvedValue({
    status: 'credited',
    historicalCreditedCoins: 200,
    supportReference: reference,
    wallet: { status: 'available', data: { balance: 220, spending_available: true } },
  });
  const onBalanceRefresh = jest.fn();
  const view = await renderWithSafeArea(
    <CoinPacksScreen coordinator={checkout} onBalanceRefresh={onBalanceRefresh} />,
  );

  await waitFor(() => expect(view.getByText('$1.50')).toBeOnTheScreen());
  expect(view.getByLabelText(englishMessages.coinStore.selectPack)).toBeDisabled();
  expect(view.getByLabelText('200 coins · $1.50')).toHaveProp(
    'accessibilityHint',
    expect.stringContaining(englishMessages.coinStore.bestValue),
  );
  expect(view.getByLabelText('300 coins · $4.00')).not.toHaveProp(
    'accessibilityHint',
    expect.stringContaining(englishMessages.coinStore.bestValue),
  );

  fireEvent.press(view.getByLabelText('200 coins · $1.50'));
  const buy = await view.findByLabelText(englishMessages.coinStore.buy(200, '$1.50'));
  expect(checkout.purchase).not.toHaveBeenCalled();
  await fireEvent.press(buy);
  await waitFor(() => expect(checkout.purchase).toHaveBeenCalledWith('coins_200'));
  expect(onBalanceRefresh).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText(englishMessages.coinPacks.checkPurchase));
  await waitFor(() => expect(onBalanceRefresh).toHaveBeenCalledTimes(1));
  expect(checkout.sync).toHaveBeenCalledTimes(1);
  expect(view.getByText(englishMessages.coinPacks.credited)).toBeOnTheScreen();
});

it('shows loading, an empty catalog, and reloads an unavailable result', async () => {
  setAuthSession({ credential: 'mock.synthetic-coin-screen' });
  const loading = deferred<CheckoutState>();
  const checkout = coordinator({ status: 'unavailable' });
  checkout.load
    .mockReturnValueOnce(loading.promise)
    .mockResolvedValueOnce({ status: 'unavailable' });
  const view = await renderWithSafeArea(
    <CoinPacksScreen coordinator={checkout} onBalanceRefresh={jest.fn()} />,
  );

  expect(view.getByText(englishMessages.coinPacks.loading)).toBeOnTheScreen();
  await act(() => loading.resolve({ status: 'ready', offers: [] }));
  expect(view.getByText(englishMessages.coinStore.empty)).toBeOnTheScreen();
  await fireEvent.press(view.getByLabelText(englishMessages.coinPacks.reload));
  await waitFor(() =>
    expect(view.getByText(englishMessages.coinPacks.unavailable)).toBeOnTheScreen(),
  );
  expect(checkout.load).toHaveBeenCalledTimes(2);
  expect(view.getByLabelText(englishMessages.coinPacks.reload)).toBeOnTheScreen();
});

it.each([
  { status: 'cancelled' as const, message: englishMessages.coinPacks.cancelled, refreshes: false },
  {
    status: 'review_required' as const,
    historicalCreditedCoins: 100,
    supportReference: reference,
    message: englishMessages.purchases.reviewRequired,
    refreshes: true,
  },
])('shows $status purchase feedback and its recovery action', async (result) => {
  setAuthSession({ credential: 'mock.synthetic-coin-screen' });
  const checkout = coordinator({ status: 'ready', offers: [offers[0]!] });
  checkout.purchase.mockResolvedValue(result);
  const onBalanceRefresh = jest.fn();
  const view = await renderWithSafeArea(
    <CoinPacksScreen coordinator={checkout} onBalanceRefresh={onBalanceRefresh} />,
  );

  await waitFor(() => expect(view.getByLabelText('100 coins · $1.00')).toBeOnTheScreen());
  fireEvent.press(view.getByLabelText('100 coins · $1.00'));
  await fireEvent.press(await view.findByLabelText(englishMessages.coinStore.buy(100, '$1.00')));
  await waitFor(() => expect(view.getByText(result.message)).toBeOnTheScreen());
  expect(onBalanceRefresh).toHaveBeenCalledTimes(result.refreshes ? 1 : 0);
  expect(
    view.getByLabelText(
      result.status === 'review_required'
        ? englishMessages.coinPacks.checkPurchase
        : englishMessages.coinPacks.reload,
    ),
  ).toBeOnTheScreen();
});

it('maps an unexpected rejection to pending verification', async () => {
  setAuthSession({ credential: 'mock.synthetic-coin-screen' });
  const checkout = coordinator({ status: 'ready', offers: [offers[0]!] });
  checkout.purchase.mockRejectedValue(new Error('private provider detail'));
  const view = await renderWithSafeArea(
    <CoinPacksScreen coordinator={checkout} onBalanceRefresh={jest.fn()} />,
  );

  await waitFor(() => expect(view.getByLabelText('100 coins · $1.00')).toBeOnTheScreen());
  fireEvent.press(view.getByLabelText('100 coins · $1.00'));
  await fireEvent.press(await view.findByLabelText(englishMessages.coinStore.buy(100, '$1.00')));
  await waitFor(() => expect(view.getByText(englishMessages.coinPacks.pending)).toBeOnTheScreen());
  expect(view.getByLabelText(englishMessages.coinPacks.checkPurchase)).toBeOnTheScreen();
});

it('blocks duplicate submission and hides purchase state after session replacement', async () => {
  setAuthSession({ credential: 'mock.synthetic-coin-screen' });
  const purchase = deferred<CheckoutState>();
  const checkout = coordinator({ status: 'ready', offers: [offers[0]!] });
  checkout.purchase.mockReturnValue(purchase.promise);
  const view = await renderWithSafeArea(
    <CoinPacksScreen coordinator={checkout} onBalanceRefresh={jest.fn()} />,
  );

  await waitFor(() => expect(view.getByLabelText('100 coins · $1.00')).toBeOnTheScreen());
  fireEvent.press(view.getByLabelText('100 coins · $1.00'));
  const buy = await view.findByLabelText(englishMessages.coinStore.buy(100, '$1.00'));
  expect(buy.props.onClick).toEqual(expect.any(Function));
  await act(() => {
    buy.props.onClick();
    buy.props.onClick();
  });
  await waitFor(() => expect(checkout.purchase).toHaveBeenCalledTimes(1));
  expect(view.getByText(englishMessages.coinStore.processing)).toBeOnTheScreen();

  await act(() => setAuthSession({ credential: 'mock.other-coin-screen-owner' }));
  expect(view.getByText(englishMessages.wallet.sessionChanged)).toBeOnTheScreen();
  expect(view.queryByText(englishMessages.coinStore.processing)).toBeNull();
  await act(() => purchase.resolve({ status: 'cancelled' }));
  expect(view.queryByText(englishMessages.coinPacks.cancelled)).toBeNull();
});

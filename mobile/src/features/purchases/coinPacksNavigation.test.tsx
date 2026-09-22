import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import CoinsRoute from '../../../app/coins';
import { setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { renderWithSafeArea } from '../../testUtils';
import { createAppCheckoutCoordinator } from './createAppCheckoutCoordinator';
import type { CheckoutCoordinator, CheckoutState } from './types';

const mockParams = { returnEpisode: 'ep_synthetic' };
let mockFocus: () => void;
let mockPreviewEnabled = false;
jest.mock('./purchasePreview', () => ({ isPurchasePreviewEnabled: () => mockPreviewEnabled }));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      mockFocus = callback;
      callback();
    }, [callback]);
  },
}));
const mockWallet = {
  getActivity: jest.fn(),
  getWallet: jest.fn(),
  unlock: jest.fn(),
  resolve: jest.fn(),
};
jest.mock('../auth/AppSignInScreen', () => ({
  AppSignInScreen: () => {
    const { View } = jest.requireActual('react-native');
    return <View testID="sign-in-screen" />;
  },
}));
function mockPack(
  productId: string,
  coins: number,
  bonusPercent: number,
  badge: string,
  highlighted: boolean,
) {
  return { productId, coins, bonusPercent, badge, highlighted };
}
jest.mock('../../api/createAppClients', () => ({
  createAppWalletClient: () => mockWallet,
  createAppPackPreviewClient: () => ({
    getPacks: async () => ({
      outcome: 'ok',
      data: [
        mockPack('coins_099', 100, 0, 'Quick top-up', false),
        mockPack('coins_499', 550, 10, 'Most popular', false),
        mockPack('coins_999', 1200, 20, 'Best value', true),
        mockPack('coins_1999', 3000, 50, 'Limited time', true),
      ],
    }),
  }),
  createAppMeClient: () => ({
    getMe: async () => ({ outcome: 'ok', data: { public_id: 'usr_preview' } }),
  }),
}));
jest.mock('../wallet/pendingCoinUnlock', () => ({
  readPendingCoinUnlockForProfile: async () => null,
}));
beforeEach(() => {
  mockWallet.getWallet.mockResolvedValue({
    outcome: 'ok',
    data: { balance: 25, spending_available: true },
  });
});
jest.mock('./createAppCheckoutCoordinator', () => ({ createAppCheckoutCoordinator: jest.fn() }));

afterEach(() => {
  mockPreviewEnabled = false;
  setAuthSession(null);
  jest.clearAllMocks();
});

it('previews Admin packs with example prices, selection, cancellation and completion without constructing a checkout coordinator', async () => {
  mockPreviewEnabled = true;
  setAuthSession({ credential: 'mock.preview-owner' });
  const view = await renderWithSafeArea(<CoinsRoute />);
  const copy = englishMessages.purchasePreview;
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toHaveTextContent('25 coins'));
  expect(view.queryByRole('radio')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: englishMessages.wallet.topUp }));
  expect(view.queryByText(copy.badge)).toBeNull();
  expect(
    await view.findByRole('button', { name: englishMessages.coinStore.selectPack }),
  ).toBeDisabled();
  for (const badge of ['Quick top-up', 'Most popular', 'Best value', 'Limited time'])
    expect(view.getByText(badge)).toBeTruthy();
  expect(view.getByText(englishMessages.coinStore.moreCoins(10))).toBeTruthy();
  expect(view.getByText(englishMessages.coinStore.moreCoins(20))).toBeTruthy();
  expect(view.getByText(englishMessages.coinStore.moreCoins(50))).toBeTruthy();
  await fireEvent.press(view.getByRole('radio', { name: copy.packLabel(550, '\u20ac4.99') }));
  await fireEvent.press(
    view.getByRole('button', { name: englishMessages.coinStore.previewBuy(550, '\u20ac4.99') }),
  );
  expect(view.getByRole('header', { name: copy.confirmation })).toBeTruthy();
  expect(view.getByText('550 coins')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: copy.cancel }));
  expect(view.queryByRole('header', { name: copy.confirmation })).toBeNull();
  await fireEvent.press(
    view.getByRole('button', { name: englishMessages.coinStore.previewBuy(550, '\u20ac4.99') }),
  );
  await fireEvent.press(view.getByRole('button', { name: copy.simulate }));
  expect(view.getByText(copy.completeDescription)).toBeTruthy();
  expect(createAppCheckoutCoordinator).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: englishMessages.coinStore.done }));
  expect(view.getByTestId('wallet-balance')).toHaveTextContent('25 coins');
  expect(mockWallet.unlock).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
  expect(router.dismissTo).not.toHaveBeenCalled();
});

it('loads once on initial focus, preserves episode navigation and rebinds after account return', async () => {
  setAuthSession({ credential: 'mock.synthetic-purchase-navigation' });
  let complete!: (state: CheckoutState) => void;
  const firstLoad = new Promise<CheckoutState>((resolve) => {
    complete = resolve;
  });
  const first: CheckoutCoordinator = {
    load: jest.fn(() => firstLoad),
    purchase: jest.fn(),
    sync: jest.fn(),
  };
  jest.mocked(createAppCheckoutCoordinator).mockReturnValue(first);
  const view = await renderWithSafeArea(<CoinsRoute />);
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toBeOnTheScreen());
  expect(first.load).not.toHaveBeenCalled();
  await fireEvent.press(view.getByTestId('wallet-top-up'));
  await waitFor(() => expect(first.load).toHaveBeenCalledTimes(1));
  expect(createAppCheckoutCoordinator).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByTestId('wallet-packs-close'));
  expect(view.queryByTestId('coin-packs-screen')).toBeNull();
  await fireEvent.press(view.getByLabelText(englishMessages.common.back));
  expect(router.replace).toHaveBeenLastCalledWith('/');
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.backToEpisode));
  expect(router.dismissTo).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_synthetic' },
  });
  await act(() => setAuthSession(null));
  expect(view.getByTestId('sign-in-screen')).toBeTruthy();
  expect(view.queryByTestId('wallet-balance')).toBeNull();

  const returned: CheckoutCoordinator = {
    load: jest.fn().mockResolvedValue({
      status: 'ready',
      offers: [{ ...mockPack('coins_synthetic', 25, 0, '', false), price: 'EUR 0.99' }],
    }),
    purchase: jest.fn(),
    sync: jest.fn(),
  };
  jest.mocked(createAppCheckoutCoordinator).mockReturnValue(returned);
  await act(() => {
    setAuthSession({ credential: 'mock.other-purchase-navigation' });
    mockFocus();
  });
  await fireEvent.press(await view.findByTestId('wallet-top-up'));
  await waitFor(() => expect(view.getByText('EUR 0.99')).toBeOnTheScreen());
  expect(returned.load).toHaveBeenCalledTimes(1);
  expect(createAppCheckoutCoordinator).toHaveBeenCalledTimes(2);
  await act(() => complete({ status: 'unavailable' }));
  expect(view.getByText('EUR 0.99')).toBeOnTheScreen();
  expect(first.purchase).not.toHaveBeenCalled();
  expect(returned.purchase).not.toHaveBeenCalled();
});

it('refreshes the unified balance from the server after verification, never from the historical credit', async () => {
  setAuthSession({ credential: 'mock.verified-owner' });
  const coordinator: CheckoutCoordinator = {
    load: jest.fn().mockResolvedValue({
      status: 'ready',
      offers: [{ ...mockPack('coins_test', 100, 0, '', false), price: 'EUR 0.99' }],
    }),
    purchase: jest.fn().mockResolvedValue({
      status: 'credited',
      historicalCreditedCoins: 100,
      supportReference: 'synthetic',
      wallet: { status: 'available', data: { balance: 80, spending_available: true } },
    }),
    sync: jest.fn(),
  };
  jest.mocked(createAppCheckoutCoordinator).mockReturnValue(coordinator);
  const view = await renderWithSafeArea(<CoinsRoute />);
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toHaveTextContent('25 coins'));
  await fireEvent.press(view.getByTestId('wallet-top-up'));
  await fireEvent.press(await view.findByRole('radio', { name: '100 coins · EUR 0.99' }));
  expect(coordinator.purchase).not.toHaveBeenCalled();
  mockWallet.getWallet.mockResolvedValue({
    outcome: 'ok',
    data: { balance: 80, spending_available: true },
  });
  await fireEvent.press(
    view.getByRole('button', { name: englishMessages.coinStore.buy(100, 'EUR 0.99') }),
  );
  await waitFor(() => expect(view.getByText(englishMessages.coinPacks.credited)).toBeOnTheScreen());
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toHaveTextContent('80 coins'));
  expect(mockWallet.getWallet).toHaveBeenCalledTimes(2);
  expect(coordinator.purchase).toHaveBeenCalledWith('coins_test');
  expect(mockWallet.unlock).not.toHaveBeenCalled();
});

it('does not create checkout or expose preview packs for a signed-out visit', async () => {
  mockPreviewEnabled = true;
  setAuthSession(null);
  const view = await renderWithSafeArea(<CoinsRoute />);
  expect(await view.findByTestId('sign-in-screen')).toBeTruthy();
  expect(view.queryByTestId('bottom-nav')).toBeNull();
  expect(view.queryAllByRole('radio')).toHaveLength(0);
  expect(mockWallet.getWallet).not.toHaveBeenCalled();
  expect(createAppCheckoutCoordinator).not.toHaveBeenCalled();
});

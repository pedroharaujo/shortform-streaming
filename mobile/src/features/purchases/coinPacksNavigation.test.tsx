import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import BuyCoinsRoute from '../../../app/buy-coins';
import { setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { renderWithSafeArea } from '../../testUtils';
import { createAppCheckoutCoordinator } from './createAppCheckoutCoordinator';
import type { CheckoutCoordinator, CheckoutState } from './types';

const mockParams = { returnEpisode: 'ep_synthetic' };
let mockFocus: () => void;
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
jest.mock('./createAppCheckoutCoordinator', () => ({ createAppCheckoutCoordinator: jest.fn() }));

afterEach(() => {
  setAuthSession(null);
  jest.clearAllMocks();
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
  const view = await renderWithSafeArea(<BuyCoinsRoute />);
  await waitFor(() => expect(first.load).toHaveBeenCalledTimes(1));
  expect(createAppCheckoutCoordinator).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByLabelText(englishMessages.coinPacks.openWallet));
  expect(router.dismissTo).toHaveBeenLastCalledWith({ pathname: '/wallet', params: mockParams });
  await fireEvent.press(view.getByLabelText(englishMessages.common.back));
  expect(router.replace).toHaveBeenLastCalledWith({ pathname: '/wallet', params: mockParams });
  await fireEvent.press(view.getByLabelText(englishMessages.common.account));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/account', params: mockParams });
  await act(() => setAuthSession(null));
  await fireEvent.press(view.getByLabelText(englishMessages.common.signIn));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/sign-in', params: mockParams });
  await fireEvent.press(view.getByLabelText(englishMessages.purchases.title));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/purchases', params: mockParams });
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.backToEpisode));
  expect(router.dismissTo).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_synthetic' },
  });

  const returned: CheckoutCoordinator = {
    load: jest.fn().mockResolvedValue({
      status: 'ready',
      offers: [{ productId: 'coins_synthetic', coins: 25, price: 'EUR 0.99' }],
    }),
    purchase: jest.fn(),
    sync: jest.fn(),
  };
  jest.mocked(createAppCheckoutCoordinator).mockReturnValue(returned);
  await act(() => {
    setAuthSession({ credential: 'mock.other-purchase-navigation' });
    mockFocus();
  });
  await waitFor(() => expect(view.getByText('EUR 0.99')).toBeOnTheScreen());
  expect(returned.load).toHaveBeenCalledTimes(1);
  expect(createAppCheckoutCoordinator).toHaveBeenCalledTimes(2);
  await act(() => complete({ status: 'unavailable' }));
  expect(view.getByText('EUR 0.99')).toBeOnTheScreen();
  expect(first.purchase).not.toHaveBeenCalled();
  expect(returned.purchase).not.toHaveBeenCalled();
});

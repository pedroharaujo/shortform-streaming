import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { renderWithSafeArea } from '../../testUtils';
import { CoinPacksScreen } from './CoinPacksScreen';
import type { CheckoutCoordinator } from './types';

afterEach(() => setAuthSession(null));

it('routes explicit selection and pending checks, then displays the current wallet balance', async () => {
  setAuthSession({ credential: 'mock.synthetic-coin-screen' });
  const price = '1,99\u00a0€';
  const coordinator: jest.Mocked<CheckoutCoordinator> = {
    load: jest.fn().mockResolvedValue({
      status: 'ready',
      offers: [{ productId: 'coins_synthetic', coins: 50, price }],
    }),
    purchase: jest.fn().mockResolvedValue({ status: 'awaiting_verification' }),
    sync: jest.fn().mockResolvedValue({
      status: 'credited',
      historicalCreditedCoins: 50,
      supportReference: '44444444-4444-4444-8444-444444444444',
      wallet: { status: 'available', data: { balance: 20, spending_available: true } },
    }),
  };
  const onWallet = jest.fn();
  const onReturnToEpisode = jest.fn();
  const view = await renderWithSafeArea(
    <CoinPacksScreen
      coordinator={coordinator}
      onBack={jest.fn()}
      onAccount={jest.fn()}
      onWallet={onWallet}
      onReturnToEpisode={onReturnToEpisode}
    />,
  );
  await waitFor(() => expect(view.getByText(price)).toBeOnTheScreen());
  expect(coordinator.purchase).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText(`50 coins · ${price}`));
  expect(coordinator.purchase).toHaveBeenCalledTimes(1);
  expect(coordinator.purchase).toHaveBeenCalledWith('coins_synthetic');
  await waitFor(() =>
    expect(view.getByLabelText(englishMessages.coinPacks.checkPurchase)).toBeOnTheScreen(),
  );
  expect(view.queryByLabelText(`50 coins · ${price}`)).toBeNull();
  await fireEvent.press(view.getByLabelText(englishMessages.coinPacks.checkPurchase));
  await waitFor(() =>
    expect(view.getByTestId('purchase-wallet-balance')).toHaveTextContent('20 coins'),
  );
  expect(coordinator.sync).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByLabelText(englishMessages.coinPacks.openWallet));
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.backToEpisode));
  expect(onWallet).toHaveBeenCalledTimes(1);
  expect(onReturnToEpisode).toHaveBeenCalledTimes(1);
  await act(() => setAuthSession({ credential: 'mock.other-coin-screen-owner' }));
  expect(view.queryByTestId('purchase-wallet-balance')).toBeNull();
  expect(view.getByText(englishMessages.wallet.sessionChanged)).toBeOnTheScreen();
});

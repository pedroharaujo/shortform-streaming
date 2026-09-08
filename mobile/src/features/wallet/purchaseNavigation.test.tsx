import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import PurchasesRoute from '../../../app/purchases';
import WalletRoute from '../../../app/wallet';
import { setAuthSession } from '../../auth/session';
import type { PurchaseHistoryScreenProps } from './PurchaseHistoryScreen';
import type { WalletScreenProps } from './WalletScreen';

let mockParams: { returnEpisode?: string | string[] } = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/createAppClients', () => ({
  createAppWalletClient: jest.fn(),
  createAppPurchasesClient: jest.fn(),
}));
jest.mock('./WalletScreen', () => ({
  WalletScreen: ({ onPurchases }: WalletScreenProps) => {
    const { Button } = jest.requireActual('react-native');
    return <Button title="Recent purchases" onPress={onPurchases} />;
  },
}));
jest.mock('./PurchaseHistoryScreen', () => ({
  PurchaseHistoryScreen: ({ onAccount, onBack, onReturnToEpisode }: PurchaseHistoryScreenProps) => {
    const { Button } = jest.requireActual('react-native');
    return (
      <>
        <Button title="Account" onPress={onAccount} />
        <Button title="Back" onPress={onBack} />
        {onReturnToEpisode ? <Button title="Back to episode" onPress={onReturnToEpisode} /> : null}
      </>
    );
  },
}));

afterEach(() => {
  setAuthSession(null);
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(false);
});

it('preserves episode context through purchase history, account, sign-in and return navigation', async () => {
  setAuthSession({ credential: 'mock.synthetic-navigation' });
  mockParams = { returnEpisode: 'ep_synthetic' };
  const wallet = await render(<WalletRoute />);
  await fireEvent.press(wallet.getByText('Recent purchases'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/purchases', params: mockParams });
  await wallet.unmount();
  const history = await render(<PurchasesRoute />);
  await fireEvent.press(history.getByText('Account'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/account', params: mockParams });
  setAuthSession(null);
  await fireEvent.press(history.getByText('Account'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/sign-in', params: mockParams });
  await fireEvent.press(history.getByText('Back to episode'));
  expect(router.dismissTo).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_synthetic' },
  });
  await fireEvent.press(history.getByText('Back'));
  expect(router.replace).toHaveBeenLastCalledWith({ pathname: '/wallet', params: mockParams });
  jest.mocked(router.canGoBack).mockReturnValue(true);
  await fireEvent.press(history.getByText('Back'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('opens purchases and falls back to wallet without an episode for a direct visit', async () => {
  mockParams = {};
  const wallet = await render(<WalletRoute />);
  await fireEvent.press(wallet.getByText('Recent purchases'));
  expect(router.push).toHaveBeenLastCalledWith('/purchases');
  await wallet.unmount();
  const history = await render(<PurchasesRoute />);
  expect(history.queryByText('Back to episode')).toBeNull();
  await fireEvent.press(history.getByText('Back'));
  expect(router.replace).toHaveBeenLastCalledWith('/wallet');
});

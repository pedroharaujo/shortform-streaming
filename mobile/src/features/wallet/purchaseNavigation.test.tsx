import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import PurchasesRoute from '../../../app/purchases';
import CoinsRoute from '../../../app/coins';
import WalletRedirect from '../../../app/wallet';
import BuyCoinsRedirect from '../../../app/buy-coins';
import { setAuthSession } from '../../auth/session';
import type { PurchaseHistoryScreenProps } from './PurchaseHistoryScreen';
import type { WalletScreenProps } from './WalletScreen';

let mockParams: { returnEpisode?: string | string[] } = {};
jest.mock('../purchases/purchasePreview', () => ({ isPurchasePreviewEnabled: () => true }));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  Redirect: ({ href }: { href: unknown }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="redirect">{JSON.stringify(href)}</Text>;
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/createAppClients', () => ({
  createAppMeClient: jest.fn(),
  createAppPackPreviewClient: jest.fn(),
  createAppWalletClient: jest.fn(),
  createAppPurchasesClient: jest.fn(),
}));
jest.mock('./WalletScreen', () => ({
  WalletScreen: ({ onPendingUnlock }: WalletScreenProps) => {
    const { Button } = jest.requireActual('react-native');
    return <Button title="Check coin unlock" onPress={() => onPendingUnlock('ep_pending')} />;
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
  const wallet = await render(<CoinsRoute />);
  await fireEvent.press(wallet.getByText('Check coin unlock'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_pending' },
  });
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
  expect(router.replace).toHaveBeenLastCalledWith({ pathname: '/coins', params: mockParams });
  jest.mocked(router.canGoBack).mockReturnValue(true);
  await fireEvent.press(history.getByText('Back'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('falls back to wallet from purchases without an episode for a direct visit', async () => {
  setAuthSession({ credential: 'mock.synthetic-direct' });
  mockParams = {};
  const history = await render(<PurchasesRoute />);
  expect(history.queryByText('Back to episode')).toBeNull();
  await fireEvent.press(history.getByText('Back'));
  expect(router.replace).toHaveBeenLastCalledWith('/coins');
});

it.each([WalletRedirect, BuyCoinsRedirect])(
  'redirects legacy coin links to the unified screen with episode context',
  async (Route) => {
    mockParams = { returnEpisode: 'ep_synthetic' };
    const view = await render(<Route />);
    expect(view.getByTestId('redirect')).toHaveTextContent(
      JSON.stringify({ pathname: '/coins', params: mockParams }),
    );
    mockParams = {};
    await view.rerender(<Route />);
    expect(view.getByTestId('redirect')).toHaveTextContent('"/coins"');
  },
);

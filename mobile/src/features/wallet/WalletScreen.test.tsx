import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { MeClient } from '../../api/me/types';
import type { Wallet, WalletClient, WalletOutcome } from '../../api/wallet/types';
import { setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { compactAndroidMetrics, renderWithSafeArea } from '../../testUtils';
import { minimumTouchTarget } from '../../ui/theme';
import { WalletScreen } from './WalletScreen';
import { writePendingCoinUnlock } from './pendingCoinUnlock';

const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => mockSecureStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => mockSecureStore.delete(key)),
}));

function pendingWallet() {
  let resolve!: (value: WalletOutcome<Wallet>) => void;
  const promise = new Promise<WalletOutcome<Wallet>>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const wallet = (balance: number, spending_available = true): WalletOutcome<Wallet> => ({
  outcome: 'ok',
  data: { balance, spending_available },
});

function clientDouble(): jest.Mocked<WalletClient> {
  return {
    resolve: jest.fn(),
    getWallet: jest.fn<ReturnType<WalletClient['getWallet']>, []>(async () => wallet(25)),
    unlock: jest.fn<ReturnType<WalletClient['unlock']>, Parameters<WalletClient['unlock']>>(
      async () => ({ outcome: 'unreachable', reason: 'Purchases unavailable' }),
    ),
  };
}

function setup(client: WalletClient) {
  const onBack = jest.fn();
  const onAccount = jest.fn();
  const onReturnToEpisode = jest.fn();
  const onPurchases = jest.fn();
  const onPendingUnlock = jest.fn();
  const me: MeClient = {
    getMe: jest.fn<ReturnType<MeClient['getMe']>, Parameters<MeClient['getMe']>>(async () => ({
      outcome: 'ok',
      data: {
        public_id: 'usr_synthetic',
        created_at: '2026-09-07T00:00:00Z',
        updated_at: '2026-09-07T00:00:00Z',
        locale: 'en',
        country: 'FR',
        ads_consent: false,
        analytics_consent: false,
        consent_updated_at: null,
      },
    })),
  };
  const rendered = renderWithSafeArea(
    <WalletScreen
      client={client}
      me={me}
      onBack={onBack}
      onAccount={onAccount}
      onReturnToEpisode={onReturnToEpisode}
      onPurchases={onPurchases}
      onPendingUnlock={onPendingUnlock}
    />,
    { metrics: compactAndroidMetrics },
  );
  return { rendered, onBack, onAccount, onReturnToEpisode, onPurchases, onPendingUnlock, me };
}

beforeEach(() => {
  mockSecureStore.clear();
  setAuthSession({ credential: 'mock.synthetic-wallet-owner' });
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('loads a server balance with accessible navigation and keeps purchases unavailable', async () => {
  const client = clientDouble();
  client.getWallet.mockResolvedValue(wallet(25, false));
  const { rendered, onBack, onAccount, onReturnToEpisode, onPurchases } = setup(client);
  const view = await rendered;
  await waitFor(() =>
    expect(view.getByTestId('wallet-balance')).toHaveTextContent(
      englishMessages.wallet.balance(25),
    ),
  );
  expect(view.getByText(englishMessages.wallet.spendingUnavailable)).toBeOnTheScreen();
  expect(view.getByText(englishMessages.wallet.purchasesUnavailable)).toBeOnTheScreen();
  expect(view.getByTestId('wallet-scroll')).toBeOnTheScreen();
  expect(client.unlock).not.toHaveBeenCalled();
  for (const action of view.getAllByRole('button')) {
    expect(action).toHaveStyle({ minHeight: minimumTouchTarget });
  }
  await fireEvent.press(view.getByLabelText(englishMessages.common.account));
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.backToEpisode));
  await fireEvent.press(view.getByLabelText(englishMessages.common.back));
  await fireEvent.press(view.getByLabelText('Recent purchases'));
  expect(onAccount).toHaveBeenCalledTimes(1);
  expect(onReturnToEpisode).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onPurchases).toHaveBeenCalledTimes(1);
});

it('clears the old balance during manual refresh and permits retry after a failure', async () => {
  const response = pendingWallet();
  const client = clientDouble();
  client.getWallet.mockResolvedValueOnce(wallet(25)).mockReturnValueOnce(response.promise);
  const view = await setup(client).rendered;
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toBeOnTheScreen());
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.refresh));
  expect(view.queryByTestId('wallet-balance')).toBeNull();
  expect(view.getByText(englishMessages.wallet.loading)).toBeOnTheScreen();
  expect(view.getByLabelText(englishMessages.wallet.refresh)).toBeDisabled();
  await act(() => response.resolve({ outcome: 'unreachable', reason: 'Network unavailable' }));
  expect(view.getByText(englishMessages.wallet.unavailable)).toBeOnTheScreen();
  expect(view.queryByTestId('wallet-balance')).toBeNull();
  client.getWallet.mockResolvedValueOnce(wallet(10));
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.refresh));
  await waitFor(() =>
    expect(view.getByTestId('wallet-balance')).toHaveTextContent(
      englishMessages.wallet.balance(10),
    ),
  );
});

it('refreshes on foreground and ignores an older response arriving after the new balance', async () => {
  let changeState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') changeState = listener;
    return { remove };
  });
  const previous = pendingWallet();
  const current = pendingWallet();
  const client = clientDouble();
  client.getWallet
    .mockResolvedValueOnce(wallet(25))
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(current.promise);
  const view = await setup(client).rendered;
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toBeOnTheScreen());
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.refresh));
  await act(() => {
    changeState('background');
    changeState('active');
  });
  await act(() => current.resolve(wallet(10)));
  await act(() => previous.resolve(wallet(100)));
  expect(view.getByTestId('wallet-balance')).toHaveTextContent(englishMessages.wallet.balance(10));
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  'invalidates account replacement immediately, with a pending refresh: %s',
  async (pending) => {
    const response = pendingWallet();
    const client = clientDouble();
    client.getWallet.mockResolvedValueOnce(wallet(25)).mockReturnValueOnce(response.promise);
    const view = await setup(client).rendered;
    await waitFor(() => expect(view.getByTestId('wallet-balance')).toBeOnTheScreen());
    if (pending) await fireEvent.press(view.getByLabelText(englishMessages.wallet.refresh));
    await act(() => setAuthSession({ credential: 'mock.another-wallet-owner' }));
    expect(view.getByText(englishMessages.wallet.sessionChanged)).toBeOnTheScreen();
    expect(view.queryByTestId('wallet-balance')).toBeNull();
    if (pending) await act(() => response.resolve(wallet(25)));
    expect(view.queryByTestId('wallet-balance')).toBeNull();
    expect(view.queryByLabelText(englishMessages.wallet.refresh)).toBeNull();
    expect(view.getByLabelText(englishMessages.common.signIn)).toBeOnTheScreen();
    expect(client.getWallet).toHaveBeenCalledTimes(pending ? 2 : 1);
  },
);

it('shows sign-in without making a wallet request for a signed-out visitor', async () => {
  setAuthSession(null);
  const client = clientDouble();
  const { rendered, onAccount } = setup(client);
  const view = await rendered;
  expect(client.getWallet).not.toHaveBeenCalled();
  expect(view.getByText(englishMessages.wallet.signIn)).toBeOnTheScreen();
  expect(view.queryByTestId('wallet-balance')).toBeNull();
  await fireEvent.press(view.getByLabelText(englishMessages.common.signIn));
  expect(onAccount).toHaveBeenCalledTimes(1);
});

it('clears the previous balance and requires sign-in when the server rejects the session', async () => {
  const client = clientDouble();
  client.getWallet.mockResolvedValueOnce(wallet(25)).mockResolvedValueOnce({
    outcome: 'unauthenticated',
    httpStatus: 401,
    code: 'unauthenticated',
    message: 'Sign in required',
  });
  const view = await setup(client).rendered;
  await waitFor(() => expect(view.getByTestId('wallet-balance')).toBeOnTheScreen());
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.refresh));
  await waitFor(() => expect(view.getByText(englishMessages.wallet.signIn)).toBeOnTheScreen());
  expect(view.queryByTestId('wallet-balance')).toBeNull();
});

it('opens a saved unlock even when balance loading fails', async () => {
  await writePendingCoinUnlock({
    version: 1,
    profileId: 'usr_synthetic',
    request: {
      episode_id: 'ep_removed',
      request_id: '11111111-1111-4111-8111-111111111111',
      expected_policy_version: 'a'.repeat(64),
      expected_coin_price: 5,
    },
  });
  const client = clientDouble();
  client.getWallet.mockResolvedValue({ outcome: 'unreachable', reason: 'offline' });
  const { rendered, onPendingUnlock } = setup(client);
  const view = await rendered;
  const action = await view.findByLabelText(englishMessages.unlock.checkPending);
  await fireEvent.press(action);
  expect(onPendingUnlock).toHaveBeenCalledWith('ep_removed');
  onPendingUnlock.mockClear();
  await act(() => setAuthSession({ credential: 'mock.replacement-wallet-owner' }));
  await fireEvent.press(action);
  expect(onPendingUnlock).not.toHaveBeenCalled();
});

it('shows a separate retry when saved unlock storage cannot be checked', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('unavailable'));
  const client = clientDouble();
  const view = await setup(client).rendered;
  expect(await view.findByText(englishMessages.wallet.recoveryUnavailable)).toBeOnTheScreen();
  expect(view.getByLabelText(englishMessages.wallet.retryRecovery)).toBeOnTheScreen();
});

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { Wallet, WalletClient, WalletOutcome } from '../../api/wallet/types';
import { setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { compactAndroidMetrics, renderWithSafeArea } from '../../testUtils';
import { minimumTouchTarget } from '../../ui/theme';
import { WalletScreen } from './WalletScreen';

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
  const rendered = renderWithSafeArea(
    <WalletScreen
      client={client}
      onBack={onBack}
      onAccount={onAccount}
      onReturnToEpisode={onReturnToEpisode}
    />,
    { metrics: compactAndroidMetrics },
  );
  return { rendered, onBack, onAccount, onReturnToEpisode };
}

beforeEach(() => setAuthSession({ credential: 'mock.synthetic-wallet-owner' }));
afterEach(() => {
  jest.restoreAllMocks();
});

it('loads a server balance with accessible navigation and keeps purchases unavailable', async () => {
  const client = clientDouble();
  client.getWallet.mockResolvedValue(wallet(25, false));
  const { rendered, onBack, onAccount, onReturnToEpisode } = setup(client);
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
  expect(onAccount).toHaveBeenCalledTimes(1);
  expect(onReturnToEpisode).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
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

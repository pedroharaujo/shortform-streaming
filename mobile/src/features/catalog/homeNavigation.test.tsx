import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';

import HomeRoute from '../../../app/index';
import type { Wallet, WalletClient, WalletOutcome } from '../../api/wallet/types';
import { getAuthSessionRevision, restoreAuthSession, setAuthSession } from '../../auth/session';

const mockGetWallet = jest.fn<ReturnType<WalletClient['getWallet']>, []>();
let mockRefocus: () => void;
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => (() => void) | undefined) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      let cleanup = callback();
      mockRefocus = () => {
        cleanup?.();
        cleanup = callback();
      };
      return () => cleanup?.();
    }, [callback]);
  },
}));
jest.mock('../../api/createAppClients', () => ({
  createAppCatalogClient: () => ({ getHome: async () => ({ outcome: 'ok', data: { rails: [] } }) }),
  createAppWalletClient: () => ({ getWallet: mockGetWallet }),
}));

const wallet = (balance: number): WalletOutcome<Wallet> => ({
  outcome: 'ok',
  data: { balance, spending_available: false },
});
function pendingWallet() {
  let resolve!: (result: WalletOutcome<Wallet>) => void;
  const promise = new Promise<WalletOutcome<Wallet>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  setAuthSession(null);
  mockGetWallet.mockReset().mockResolvedValue(wallet(25));
});
afterEach(async () => {
  await act(() => setAuthSession(null));
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

it('replaces Sign in with account access after login, session restore, and logout without remounting', async () => {
  setAuthSession(null);
  const view = await render(<HomeRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
  expect(router.push).toHaveBeenLastCalledWith('/sign-in');
  expect(view.queryByTestId('home-profile')).toBeNull();
  expect(view.queryByTestId('home-wallet')).toBeNull();
  expect(mockGetWallet).not.toHaveBeenCalled();

  await act(() => setAuthSession({ credential: 'mock.synthetic-login' }));
  expect(view.queryByRole('button', { name: 'Sign in' })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Account' }));
  expect(router.push).toHaveBeenLastCalledWith('/account');

  await act(() => setAuthSession(null));
  expect(view.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(view.queryByTestId('home-profile')).toBeNull();
  expect(view.queryByTestId('home-wallet')).toBeNull();

  const revision = getAuthSessionRevision();
  await act(() => {
    expect(
      restoreAuthSession(
        { credential: 'mock.synthetic-restored', nativeUid: 'synthetic-native' },
        revision,
      ),
    ).toBe(true);
  });
  expect(getAuthSessionRevision()).toBe(revision);
  expect(view.queryByRole('button', { name: 'Sign in' })).toBeNull();
  await fireEvent.press(view.getByTestId('home-profile'));
  expect(router.push).toHaveBeenLastCalledWith('/account');
});

it('shows the actual formatted balance including zero and opens the existing wallet', async () => {
  setAuthSession({ credential: 'mock.wallet-owner' });
  mockGetWallet.mockResolvedValueOnce(wallet(1250)).mockResolvedValueOnce(wallet(0));
  const view = await render(<HomeRoute />);
  const button = await view.findByRole('button', { name: 'Coins, 1,250 coins' });
  expect(button).toHaveTextContent('1,250');
  expect(button).toHaveStyle({ minHeight: 48 });
  await fireEvent.press(button);
  expect(router.push).toHaveBeenLastCalledWith('/coins');
  await act(() => mockRefocus());
  expect(await view.findByRole('button', { name: 'Coins, 0 coins' })).toHaveTextContent('0');
  expect(mockGetWallet).toHaveBeenCalledTimes(2);
});

it('refreshes on Home focus and foreground, clears the old balance, and ignores a late response', async () => {
  setAuthSession({ credential: 'mock.wallet-owner' });
  let changeState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    changeState = listener;
    return { remove };
  });
  const previous = pendingWallet();
  const current = pendingWallet();
  mockGetWallet
    .mockResolvedValueOnce(wallet(25))
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(current.promise);
  const view = await render(<HomeRoute />);
  await view.findByRole('button', { name: 'Coins, 25 coins' });
  await act(() => mockRefocus());
  expect(view.queryByText('25')).toBeNull();
  expect(view.getByTestId('home-wallet')).toHaveProp('accessibilityState', { busy: true });
  await act(() => {
    changeState('background');
    changeState('active');
  });
  await act(() => current.resolve(wallet(75)));
  await act(() => previous.resolve(wallet(10)));
  expect(view.getByTestId('home-wallet')).toHaveTextContent('75');
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(2);
});

it('never carries a balance across account replacement or late logout responses', async () => {
  setAuthSession({ credential: 'mock.first-owner' });
  const old = pendingWallet();
  const replacement = pendingWallet();
  const loggedOut = pendingWallet();
  mockGetWallet
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(replacement.promise)
    .mockReturnValueOnce(loggedOut.promise);
  const view = await render(<HomeRoute />);
  await act(() => setAuthSession({ credential: 'mock.next-owner' }));
  await act(() => old.resolve(wallet(999)));
  expect(view.queryByText('999')).toBeNull();
  await act(() => replacement.resolve(wallet(7)));
  expect(view.getByTestId('home-wallet')).toHaveTextContent('7');
  await act(() => mockRefocus());
  await act(() => setAuthSession(null));
  await act(() => loggedOut.resolve(wallet(88)));
  expect(view.queryByTestId('home-wallet')).toBeNull();
  expect(view.queryByText('88')).toBeNull();
});

it.each(['unreachable', 'unauthenticated', 'throw'] as const)(
  'keeps wallet navigation without inventing a zero balance when %s',
  async (failure) => {
    setAuthSession({ credential: 'mock.wallet-owner' });
    if (failure === 'throw') mockGetWallet.mockRejectedValueOnce(new Error('Network failure'));
    else
      mockGetWallet.mockResolvedValueOnce(
        failure === 'unreachable'
          ? { outcome: 'unreachable', reason: 'Network failure' }
          : {
              outcome: 'unauthenticated',
              httpStatus: 401,
              code: 'unauthenticated',
              message: 'Sign in',
            },
      );
    const view = await render(<HomeRoute />);
    await waitFor(() => expect(view.getByTestId('home-wallet')).toHaveTextContent('Coins'));
    expect(view.queryByText('0')).toBeNull();
    expect(view.getByTestId('home-wallet')).toHaveProp('accessibilityState', { busy: false });
    await fireEvent.press(view.getByTestId('home-wallet'));
    expect(router.push).toHaveBeenLastCalledWith('/coins');
  },
);

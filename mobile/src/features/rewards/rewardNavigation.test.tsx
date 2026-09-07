import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import RewardRoute from '../../../app/reward/[id]';
import SignInRoute from '../../../app/sign-in';
import AccountRoute from '../../../app/account';
import UnlockRoute from '../../../app/unlock/[id]';
import WalletRoute from '../../../app/wallet';
import { createAppWalletClient } from '../../api/createAppClients';
import { setAuthSession } from '../../auth/session';
import { createRewardedAdPresenter } from './rewardedAdPresenter';

let mockParams: { id?: string; returnEpisode?: string } = {};
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    dismissTo: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/createAppClients', () => ({
  createAppCatalogClient: jest.fn(),
  createAppMeClient: jest.fn(),
  createAppRewardsClient: jest.fn(),
  createAppPlaybackClient: jest.fn(),
  createAppAccountClient: jest.fn(),
  createAppWalletClient: jest.fn(),
}));
jest.mock('../../auth/createEmailPasswordAuth', () => ({ createEmailPasswordAuth: jest.fn() }));
jest.mock('../../config/appConfiguration', () => ({
  getApiConfiguration: () => ({ environment: 'local' }),
  getAdsConfiguration: () => ({
    mode: 'test',
    rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
  }),
}));
jest.mock('./rewardedAdPresenter', () => ({ createRewardedAdPresenter: jest.fn() }));
jest.mock('../../analytics/appAnalytics', () => ({
  getAppAccountAnalytics: jest.fn(() => ({})),
  getAppAnalyticsRuntime: jest.fn(() => ({})),
}));
jest.mock('./rewardAnalytics', () => ({ createRewardAnalytics: jest.fn(() => ({})) }));
jest.mock('./RewardScreen', () => ({
  RewardScreen: ({ onAccount, onClose }: { onAccount: () => void; onClose: () => void }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <>
        <Pressable onPress={onAccount}>
          <Text>Account action</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
      </>
    );
  },
}));
jest.mock('../auth/SignInScreen', () => ({
  SignInScreen: ({ onFinished }: { onFinished: () => void }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <Pressable onPress={onFinished}>
        <Text>Finish sign-in</Text>
      </Pressable>
    );
  },
}));
jest.mock('../wallet/EpisodeUnlockScreen', () => ({
  EpisodeUnlockScreen: ({
    episodeId,
    onWallet,
    onAd,
    onPlay,
    onClose,
  }: {
    episodeId: string;
    onWallet: () => void;
    onAd: (id: string) => void;
    onPlay: (id: string) => void;
    onClose: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <>
        <Pressable onPress={onWallet}>
          <Text>Open wallet</Text>
        </Pressable>
        <Pressable onPress={() => onAd(episodeId)}>
          <Text>Watch ad</Text>
        </Pressable>
        <Pressable onPress={() => onPlay(episodeId)}>
          <Text>Play unlocked episode</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
      </>
    );
  },
}));
jest.mock('../wallet/WalletScreen', () => ({
  WalletScreen: ({
    onReturnToEpisode,
    onAccount,
    onBack,
  }: {
    onReturnToEpisode?: () => void;
    onAccount: () => void;
    onBack: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <>
        {onReturnToEpisode ? (
          <Pressable onPress={onReturnToEpisode}>
            <Text>Return to episode</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onAccount}>
          <Text>Account action</Text>
        </Pressable>
        <Pressable onPress={onBack}>
          <Text>Close</Text>
        </Pressable>
      </>
    );
  },
}));
jest.mock('../account/AccountScreen', () => ({
  AccountScreen: ({
    onReturnToEpisode,
    onSignIn,
    onWallet,
  }: {
    onReturnToEpisode?: () => void;
    onSignIn: () => void;
    onWallet?: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <>
        <Pressable onPress={onReturnToEpisode}>
          <Text>Return to episode</Text>
        </Pressable>
        <Pressable onPress={onSignIn}>
          <Text>Sign in again</Text>
        </Pressable>
        <Pressable onPress={onWallet}>
          <Text>Open wallet</Text>
        </Pressable>
      </>
    );
  },
}));

afterEach(() => {
  setAuthSession(null);
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(false);
});

it('retains the locked episode through login and preference navigation', async () => {
  setAuthSession(null);
  mockParams = { id: 'ep_synthetic' };
  const reward = await render(<RewardRoute />);
  await fireEvent.press(reward.getByText('Account action'));
  expect(router.replace).toHaveBeenLastCalledWith({
    pathname: '/sign-in',
    params: { returnEpisode: 'ep_synthetic' },
  });
  await reward.unmount();

  mockParams = { returnEpisode: 'ep_synthetic' };
  const signIn = await render(<SignInRoute />);
  setAuthSession({ credential: 'mock.synthetic_navigation' });
  await fireEvent.press(signIn.getByText('Finish sign-in'));
  expect(router.dismissTo).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_synthetic' },
  });
  await signIn.unmount();

  mockParams = { id: 'ep_synthetic' };
  const signedInReward = await render(<RewardRoute />);
  await fireEvent.press(signedInReward.getByText('Account action'));
  expect(router.replace).toHaveBeenLastCalledWith({
    pathname: '/account',
    params: { returnEpisode: 'ep_synthetic' },
  });
  await signedInReward.unmount();

  mockParams = { returnEpisode: 'ep_synthetic' };
  const account = await render(<AccountRoute />);
  await fireEvent.press(account.getByText('Return to episode'));
  expect(router.dismissTo).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_synthetic' },
  });
  await fireEvent.press(account.getByText('Sign in again'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/sign-in',
    params: { returnEpisode: 'ep_synthetic' },
  });
  await fireEvent.press(account.getByText('Open wallet'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/wallet',
    params: { returnEpisode: 'ep_synthetic' },
  });
});

it('retains the exact coin episode through wallet and account without creating another unlock screen', async () => {
  setAuthSession({ credential: 'mock.synthetic_navigation' });
  mockParams = { id: 'ep_coin_synthetic' };
  const unlock = await render(<UnlockRoute />);
  await fireEvent.press(unlock.getByText('Open wallet'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/wallet',
    params: { returnEpisode: 'ep_coin_synthetic' },
  });
  await unlock.unmount();

  mockParams = { returnEpisode: 'ep_coin_synthetic' };
  const wallet = await render(<WalletRoute />);
  expect(createAppWalletClient).toHaveBeenCalledTimes(2);
  await fireEvent.press(wallet.getByText('Account action'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/account',
    params: { returnEpisode: 'ep_coin_synthetic' },
  });
  await fireEvent.press(wallet.getByText('Return to episode'));
  expect(router.dismissTo).toHaveBeenLastCalledWith({
    pathname: '/unlock/[id]',
    params: { id: 'ep_coin_synthetic' },
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(createRewardedAdPresenter).not.toHaveBeenCalled();
});

it('retains the selected episode when choosing an ad or authorized playback', async () => {
  mockParams = { id: 'ep_synthetic' };
  const unlock = await render(<UnlockRoute />);
  await fireEvent.press(unlock.getByText('Watch ad'));
  expect(router.replace).toHaveBeenLastCalledWith({
    pathname: '/reward/[id]',
    params: { id: 'ep_synthetic' },
  });
  await fireEvent.press(unlock.getByText('Play unlocked episode'));
  expect(router.replace).toHaveBeenLastCalledWith({
    pathname: '/play/[id]',
    params: { id: 'ep_synthetic' },
  });
});

it('keeps the episode when signing in from wallet and uses ordinary back navigation when available', async () => {
  mockParams = { returnEpisode: 'ep_synthetic' };
  const wallet = await render(<WalletRoute />);
  await fireEvent.press(wallet.getByText('Account action'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/sign-in',
    params: { returnEpisode: 'ep_synthetic' },
  });
  jest.mocked(router.canGoBack).mockReturnValue(true);
  await fireEvent.press(wallet.getByText('Close'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('provides a safe account fallback for a directly opened wallet without episode context', async () => {
  mockParams = {};
  const wallet = await render(<WalletRoute />);
  expect(wallet.queryByText('Return to episode')).toBeNull();
  await fireEvent.press(wallet.getByText('Close'));
  expect(router.replace).toHaveBeenLastCalledWith('/account');
});

it.each([
  { name: 'reward', Route: RewardRoute },
  { name: 'unlock', Route: UnlockRoute },
])('closes a directly opened $name offer to its episode', async ({ Route }) => {
  mockParams = { id: 'ep_synthetic' };
  const view = await render(<Route />);
  await fireEvent.press(view.getByText('Close'));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/episodes/[id]',
      params: { id: 'ep_synthetic' },
    }),
  );
});

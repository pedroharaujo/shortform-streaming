import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import RewardRoute from '../../../app/reward/[id]';
import SignInRoute from '../../../app/sign-in';
import AccountRoute from '../../../app/account';
import { setAuthSession } from '../../auth/session';

let mockParams: { id?: string; returnEpisode?: string } = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/createAppClients', () => ({
  createAppCatalogClient: jest.fn(),
  createAppMeClient: jest.fn(),
  createAppRewardsClient: jest.fn(),
  createAppPlaybackClient: jest.fn(),
  createAppAccountClient: jest.fn(),
}));
jest.mock('../../auth/createEmailPasswordAuth', () => ({ createEmailPasswordAuth: jest.fn() }));
jest.mock('../../config/appConfiguration', () => ({
  getApiConfiguration: () => ({ environment: 'local' }),
  getRewardedAdUnitId: jest.fn(),
}));
jest.mock('./testAdPresenter', () => ({ createTestAdPresenter: jest.fn() }));
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
jest.mock('../account/AccountScreen', () => ({
  AccountScreen: ({
    onReturnToEpisode,
    onSignIn,
  }: {
    onReturnToEpisode?: () => void;
    onSignIn: () => void;
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
      </>
    );
  },
}));

afterEach(() => {
  setAuthSession(null);
  jest.clearAllMocks();
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
  expect(router.replace).toHaveBeenLastCalledWith({
    pathname: '/reward/[id]',
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
  expect(router.replace).toHaveBeenLastCalledWith({
    pathname: '/reward/[id]',
    params: { id: 'ep_synthetic' },
  });
  await fireEvent.press(account.getByText('Sign in again'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/sign-in',
    params: { returnEpisode: 'ep_synthetic' },
  });
});

it('closes a directly opened offer to its episode instead of leaving a dead back action', async () => {
  mockParams = { id: 'ep_synthetic' };
  const view = await render(<RewardRoute />);
  await fireEvent.press(view.getByText('Close'));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/episodes/[id]',
      params: { id: 'ep_synthetic' },
    }),
  );
});
